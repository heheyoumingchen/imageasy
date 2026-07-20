use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{
    codecs::jpeg::JpegEncoder, imageops, imageops::FilterType, DynamicImage, GenericImageView,
    ImageBuffer, Rgb, Rgba,
};
use jpeg_decoder::Decoder as JpegDecoder;
use std::{
    collections::HashMap,
    fs,
    io::{BufReader, Cursor},
    path::{Path, PathBuf},
    sync::Mutex,
    time::UNIX_EPOCH,
};

use super::{
    apply_adjustments, apply_saturation, mix_channel, shift_channel, GenerateImagePreviewRequest,
    GenerateImagePreviewResult, PrefetchImagePreviewRequest, PREVIEW_CACHE,
};

#[tauri::command]
pub async fn generate_image_preview(
    request: GenerateImagePreviewRequest,
) -> Result<GenerateImagePreviewResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        generate_image_preview_impl(request).map_err(crate::commands::error_message::to_user_error_string)
    })
    .await
    .map_err(crate::commands::error_message::to_user_error_string)?
}

#[tauri::command]
pub async fn prefetch_image_preview(request: PrefetchImagePreviewRequest) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let preview_width = request.max_width.unwrap_or(760);
        let preview_height = request.max_height.unwrap_or(560);
        generate_image_preview_impl(GenerateImagePreviewRequest {
            path: request.path,
            adjustments: super::default_adjustments(),
            max_width: Some(preview_width),
            max_height: Some(preview_height),
        })
        .map(|_| ())
        .map_err(crate::commands::error_message::to_user_error_string)
    })
    .await
    .map_err(crate::commands::error_message::to_user_error_string)?
}

fn is_identity_adjustments(adjustments: &super::AdjustmentParams) -> bool {
    adjustments.brightness == 0
        && adjustments.contrast == 0
        && adjustments.saturation == 0
        && adjustments.temperature == 0
        && adjustments.tint == 0
        && adjustments.sharpen == 0
        && adjustments.clarity == 0
        && (adjustments.filter_type == "none" || adjustments.filter_intensity == 0)
        && adjustments.rotation.rem_euclid(360) == 0
        && adjustments.crop.is_none()
}

fn preview_cache_key(path: &str, width: u32, height: u32) -> Result<String> {
    let path = Path::new(path);
    let metadata = fs::metadata(path)
        .with_context(|| format!("无法读取预览源文件信息: {}", path.display()))?;
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis())
        .unwrap_or(0);
    Ok(format!(
        "{}::{width}x{height}::{mtime}:{}",
        path.display(),
        metadata.len()
    ))
}

// ─── JPEG 快速降采样解码 ────────────────────────────────────────────────────────

/// 使用 jpeg-decoder 的缩放解码能力，直接按目标预览尺寸解码 JPEG。
/// decoder.scale(w, h) 内部自动选择最佳 DCT 缩放因子（1/1, 1/2, 1/4, 1/8），
/// 产出一张至少覆盖目标尺寸的解码结果。
/// 对于 6000x4000 的图片，目标 760x560 时约使用 1/8 解码，比完整解码快数倍。
fn fast_decode_jpeg_for_preview(
    path: &Path,
    target_width: u32,
    target_height: u32,
) -> Result<DynamicImage> {
    let file =
        fs::File::open(path).with_context(|| format!("无法打开 JPEG: {}", path.display()))?;
    let mut decoder = JpegDecoder::new(BufReader::new(file));

    decoder
        .read_info()
        .with_context(|| format!("无法读取 JPEG 头部: {}", path.display()))?;

    let info = decoder.info().context("JPEG 信息不可用")?;
    let (src_w, src_h) = (info.width as u32, info.height as u32);

    // 仅当源图明显大于目标时才使用 scale，让解码器选择最优 DCT 缩放因子
    if src_w > target_width * 2 || src_h > target_height * 2 {
        let scale_w = target_width.min(u16::MAX as u32) as u16;
        let scale_h = target_height.min(u16::MAX as u32) as u16;
        decoder
            .scale(scale_w, scale_h)
            .with_context(|| format!("无法设置 JPEG 缩放: {}x{}", scale_w, scale_h))?;
    }

    let pixels = decoder
        .decode()
        .with_context(|| format!("JPEG 解码失败: {}", path.display()))?;

    let decoded_info = decoder.info().context("解码后信息不可用")?;
    let (decoded_w, decoded_h) = (decoded_info.width as u32, decoded_info.height as u32);

    let dynamic_image = match decoded_info.pixel_format {
        jpeg_decoder::PixelFormat::RGB24 => {
            let buffer = ImageBuffer::<Rgb<u8>, _>::from_raw(decoded_w, decoded_h, pixels)
                .context("无法构建 RGB 图像缓冲")?;
            DynamicImage::ImageRgb8(buffer)
        }
        jpeg_decoder::PixelFormat::L8 => {
            let buffer =
                image::ImageBuffer::<image::Luma<u8>, _>::from_raw(decoded_w, decoded_h, pixels)
                    .context("无法构建灰度图像缓冲")?;
            DynamicImage::ImageLuma8(buffer)
        }
        _ => {
            // CMYK 等罕见格式，回退到 image crate 完整解码
            image::open(path).with_context(|| format!("无法打开图片: {}", path.display()))?
        }
    };

    // 如果降采样后仍大于目标，做最终 resize
    if decoded_w > target_width || decoded_h > target_height {
        Ok(dynamic_image.resize(target_width, target_height, FilterType::Triangle))
    } else {
        Ok(dynamic_image)
    }
}

// ─── 磁盘预览缓存 ──────────────────────────────────────────────────────────────

/// 为默认预览（无调整）生成稳定的缓存文件路径。
fn default_preview_file_path(path: &str, width: u32, height: u32) -> Result<PathBuf> {
    let cache_key = preview_cache_key(path, width, height)?;
    let hash = super::simple_hash(&cache_key);
    let stem = Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("preview");
    let file_name = format!("{stem}_{hash}_{width}x{height}.jpg");
    let cache_dir = super::editor_preview_cache_dir();
    Ok(cache_dir.join(file_name))
}

/// 为带调整参数的预览生成 base64 data URL（跳过磁盘 I/O）。
fn encode_preview_to_data_url(image: &DynamicImage) -> Result<String> {
    let mut buffer = Cursor::new(Vec::new());
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, 75);
    encoder.encode_image(image)?;
    let encoded = STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/jpeg;base64,{encoded}"))
}

fn write_preview_jpeg(path: &Path, image: &DynamicImage) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("无法创建预览缓存目录: {}", parent.display()))?;
    }
    let file =
        fs::File::create(path).with_context(|| format!("无法创建预览文件: {}", path.display()))?;
    let mut writer = std::io::BufWriter::new(file);
    let mut encoder = JpegEncoder::new_with_quality(&mut writer, 75);
    encoder.encode_image(image)?;
    Ok(())
}

// ─── 预览生成主逻辑 ─────────────────────────────────────────────────────────────

fn generate_image_preview_impl(
    request: GenerateImagePreviewRequest,
) -> Result<GenerateImagePreviewResult> {
    let preview_width = request.max_width.unwrap_or(760);
    let preview_height = request.max_height.unwrap_or(560);

    // 默认预览（无调整）：检查磁盘缓存
    if is_identity_adjustments(&request.adjustments) {
        let cached_path = default_preview_file_path(&request.path, preview_width, preview_height)?;
        if cached_path.exists() {
            let dimensions = image::image_dimensions(&cached_path)
                .with_context(|| format!("无法读取缓存预览尺寸: {}", cached_path.display()))?;
            return Ok(GenerateImagePreviewResult {
                preview_path: Some(cached_path.to_string_lossy().into_owned()),
                data_url: None,
                width: dimensions.0,
                height: dimensions.1,
            });
        }
    }

    // 获取或生成基础预览图（内存缓存）
    let prepared = get_or_prepare_preview_image(&request.path, preview_width, preview_height)?;

    // 应用调整参数
    let is_identity = is_identity_adjustments(&request.adjustments);
    let processed = if is_identity {
        prepared
    } else {
        apply_adjustments(prepared, &request.adjustments)
    };

    let (width, height) = processed.dimensions();

    if is_identity {
        // 默认预览：写磁盘缓存，返回路径
        let p = default_preview_file_path(&request.path, preview_width, preview_height)?;
        write_preview_jpeg(&p, &processed)?;
        Ok(GenerateImagePreviewResult {
            preview_path: Some(p.to_string_lossy().into_owned()),
            data_url: None,
            width,
            height,
        })
    } else {
        // 调整预览：直接 base64 返回，跳过磁盘 I/O
        let data_url = encode_preview_to_data_url(&processed)?;
        Ok(GenerateImagePreviewResult {
            preview_path: None,
            data_url: Some(data_url),
            width,
            height,
        })
    }
}

fn get_or_prepare_preview_image(path: &str, width: u32, height: u32) -> Result<DynamicImage> {
    let cache_key = preview_cache_key(path, width, height)?;
    let cache = PREVIEW_CACHE.get_or_init(|| Mutex::new(HashMap::new()));

    if let Some(image) = cache
        .lock()
        .map_err(|_| anyhow::anyhow!("预览缓存不可用"))?
        .get(&cache_key)
        .cloned()
    {
        return Ok(image);
    }

    let source_path = Path::new(path);
    let extension = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    // JPEG 使用快速降采样解码
    let prepared = if matches!(extension.as_str(), "jpg" | "jpeg") {
        fast_decode_jpeg_for_preview(source_path, width, height).unwrap_or_else(|_| {
            // 降采样解码失败时回退到完整解码
            image::open(path)
                .map(|img| img.resize(width, height, FilterType::Triangle))
                .unwrap_or_else(|_| DynamicImage::new_rgb8(1, 1))
        })
    } else {
        let source_image = image::open(path).with_context(|| format!("无法打开图片: {path}"))?;
        source_image.resize(width, height, FilterType::Triangle)
    };

    cache
        .lock()
        .map_err(|_| anyhow::anyhow!("预览缓存不可用"))?
        .insert(cache_key, prepared.clone());

    Ok(prepared)
}

// ─── 滤镜效果 ───────────────────────────────────────────────────────────────────

pub(crate) fn apply_filter(image: DynamicImage, filter_type: &str, intensity: f32) -> DynamicImage {
    let amount = intensity.clamp(0.0, 1.0);

    match filter_type {
        "none" => image,
        "grayscale" => apply_grayscale_filter(image, amount),
        "warm" => apply_channel_mix_filter(image, amount, 28.0, 10.0, -24.0),
        "cool" => apply_channel_mix_filter(image, amount, -18.0, 6.0, 28.0),
        "vintage" => apply_vintage_filter(image, amount),
        "sepia" => apply_sepia_filter(image, amount),
        "vivid" => apply_vivid_filter(image, amount),
        "fade" => apply_fade_filter(image, amount),
        "cinematic" => apply_cinematic_filter(image, amount),
        "noir" => apply_noir_filter(image, amount),
        "polaroid" => apply_polaroid_filter(image, amount),
        "dreamy" => apply_dreamy_filter(image, amount),
        "summer" => apply_summer_filter(image, amount),
        "forest" => apply_forest_filter(image, amount),
        _ => image,
    }
}

pub(crate) fn apply_sharpen(image: DynamicImage, amount: f32) -> DynamicImage {
    if amount.abs() < f32::EPSILON {
        return image;
    }

    let sigma = (1.0 + amount.abs() * 1.5).max(0.1);
    let threshold = (amount.abs() * 12.0).round() as i32;
    DynamicImage::ImageRgba8(imageops::unsharpen(&image.to_rgba8(), sigma, threshold))
}

pub(crate) fn apply_clarity(image: DynamicImage, amount: f32) -> DynamicImage {
    if amount.abs() < f32::EPSILON {
        return image;
    }

    let blurred = image.blur(1.6).to_rgba8();
    let mut rgba = image.to_rgba8();
    let mix_amount = amount.clamp(-1.0, 1.0) * 0.6;

    for (pixel, blurred_pixel) in rgba.pixels_mut().zip(blurred.pixels()) {
        let [r, g, b, a] = pixel.0;
        let [br, bg, bb, _] = blurred_pixel.0;

        let nr = ((r as f32) + (r as f32 - br as f32) * mix_amount)
            .round()
            .clamp(0.0, 255.0) as u8;
        let ng = ((g as f32) + (g as f32 - bg as f32) * mix_amount)
            .round()
            .clamp(0.0, 255.0) as u8;
        let nb = ((b as f32) + (b as f32 - bb as f32) * mix_amount)
            .round()
            .clamp(0.0, 255.0) as u8;
        *pixel = Rgba([nr, ng, nb, a]);
    }

    DynamicImage::ImageRgba8(rgba)
}

fn apply_grayscale_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let mut rgba = image.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let [r, g, b, a] = pixel.0;
        let gray = (0.299 * r as f32 + 0.587 * g as f32 + 0.114 * b as f32).round();
        let nr = mix_channel(r as f32, gray, amount);
        let ng = mix_channel(g as f32, gray, amount);
        let nb = mix_channel(b as f32, gray, amount);
        *pixel = Rgba([nr, ng, nb, a]);
    }
    DynamicImage::ImageRgba8(rgba)
}

fn apply_channel_mix_filter(
    image: DynamicImage,
    amount: f32,
    red_shift: f32,
    green_shift: f32,
    blue_shift: f32,
) -> DynamicImage {
    let mut rgba = image.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let [r, g, b, a] = pixel.0;
        let nr = shift_channel(r, red_shift, amount);
        let ng = shift_channel(g, green_shift, amount);
        let nb = shift_channel(b, blue_shift, amount);
        *pixel = Rgba([nr, ng, nb, a]);
    }
    DynamicImage::ImageRgba8(rgba)
}

fn apply_vintage_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_grayscale_filter(image, amount * 0.35);
    let image = apply_channel_mix_filter(image, amount, 24.0, 8.0, -18.0);
    apply_saturation(image, -amount * 0.2)
}

fn apply_sepia_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let mut rgba = image.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let [r, g, b, a] = pixel.0;
        let sr = (r as f32 * 0.393 + g as f32 * 0.769 + b as f32 * 0.189).clamp(0.0, 255.0);
        let sg = (r as f32 * 0.349 + g as f32 * 0.686 + b as f32 * 0.168).clamp(0.0, 255.0);
        let sb = (r as f32 * 0.272 + g as f32 * 0.534 + b as f32 * 0.131).clamp(0.0, 255.0);
        *pixel = Rgba([
            mix_channel(r as f32, sr, amount),
            mix_channel(g as f32, sg, amount),
            mix_channel(b as f32, sb, amount),
            a,
        ]);
    }
    DynamicImage::ImageRgba8(rgba)
}

fn apply_vivid_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_saturation(image, amount * 0.45);
    image.adjust_contrast(amount * 18.0)
}

fn apply_fade_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = image.brighten((amount * 14.0).round() as i32);
    let image = image.adjust_contrast(-(amount * 18.0));
    apply_saturation(image, -amount * 0.25)
}

fn apply_cinematic_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_channel_mix_filter(image, amount, 10.0, 4.0, -20.0);
    let image = image.adjust_contrast(amount * 14.0);
    apply_saturation(image, -amount * 0.08)
}

fn apply_noir_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_grayscale_filter(image, amount);
    image.adjust_contrast(amount * 30.0)
}

fn apply_polaroid_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_channel_mix_filter(image, amount, 12.0, 6.0, -8.0);
    let image = image.brighten((amount * 8.0).round() as i32);
    apply_saturation(image, -amount * 0.15)
}

fn apply_dreamy_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = image.brighten((amount * 12.0).round() as i32);
    let image = image.adjust_contrast(-(amount * 10.0));
    apply_channel_mix_filter(image, amount, 8.0, 4.0, 14.0)
}

fn apply_summer_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_channel_mix_filter(image, amount, 18.0, 12.0, -10.0);
    apply_saturation(image, amount * 0.2)
}

fn apply_forest_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_channel_mix_filter(image, amount, -12.0, 16.0, 6.0);
    apply_saturation(image, -amount * 0.1)
}
