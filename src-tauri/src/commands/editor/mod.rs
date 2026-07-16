pub mod crop;
pub mod filters;
pub mod save;

pub use crop::commit_crop_to_working_image;
pub use filters::{generate_image_preview, prefetch_image_preview};
pub use save::save_image_as_jpg;

use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{
    codecs::jpeg::JpegEncoder, imageops::FilterType, DynamicImage, ImageBuffer, Rgb, Rgba,
};
use jpeg_decoder::Decoder as JpegDecoder;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::Cursor,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::UNIX_EPOCH,
};

pub(crate) const SUPPORTED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "bmp"];

type PreviewCacheKey = String;

pub(crate) static PREVIEW_CACHE: OnceLock<Mutex<HashMap<PreviewCacheKey, DynamicImage>>> =
    OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CropRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustmentParams {
    pub brightness: i32,
    pub contrast: i32,
    pub saturation: i32,
    #[serde(default)]
    pub temperature: i32,
    #[serde(default)]
    pub tint: i32,
    pub sharpen: i32,
    pub clarity: i32,
    pub quality: i32,
    pub filter_type: String,
    pub filter_intensity: i32,
    pub rotation: i32,
    pub crop: Option<CropRect>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorImageSummary {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub width: u32,
    pub height: u32,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorDirectoryImage {
    pub index: usize,
    pub thumbnail_data_url: String,
    #[serde(flatten)]
    pub summary: EditorImageSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenImageSessionResult {
    pub current_image: EditorImageSummary,
    pub directory_images: Vec<EditorDirectoryImage>,
    pub current_index: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateImagePreviewRequest {
    pub path: String,
    pub adjustments: AdjustmentParams,
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrefetchImagePreviewRequest {
    pub path: String,
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateImagePreviewResult {
    /// 磁盘缓存路径（默认预览使用，前端通过 convertFileSrc 转为 asset URL）
    pub preview_path: Option<String>,
    /// base64 data URL（调整预览使用，跳过磁盘 I/O 直接返回）
    pub data_url: Option<String>,
    pub width: u32,
    pub height: u32,
}

pub(crate) fn default_adjustments() -> AdjustmentParams {
    AdjustmentParams {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        temperature: 0,
        tint: 0,
        sharpen: 0,
        clarity: 0,
        quality: 100,
        filter_type: "none".into(),
        filter_intensity: 0,
        rotation: 0,
        crop: None,
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageAsJpgRequest {
    pub source_path: String,
    pub target_path: String,
    pub adjustments: AdjustmentParams,
    pub quality: Option<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageAsJpgResult {
    pub saved_path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitCropRequest {
    pub source_path: String,
    pub rotation: i32,
    pub crop: CropRect,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitCropResult {
    pub working_image: EditorImageSummary,
}

#[tauri::command]
pub async fn open_image_session(path: String) -> Result<OpenImageSessionResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        open_image_session_impl(&path).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

// 胶片栏缩略图按需生成：前端并行懒加载，避免打开目录时一次性解码全部图片。
#[tauri::command]
pub async fn generate_editor_thumbnail(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        create_thumbnail_data_url(Path::new(&path), 128, 58).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

fn open_image_session_impl(path: &str) -> Result<OpenImageSessionResult> {
    let selected_path = PathBuf::from(path);
    let selected_path = selected_path
        .canonicalize()
        .with_context(|| format!("无法访问文件: {path}"))?;

    if !is_supported_image(&selected_path) {
        anyhow::bail!("不支持的图片格式");
    }

    let parent = selected_path.parent().context("无法定位图片所在目录")?;
    let mut sibling_paths = fs::read_dir(parent)
        .with_context(|| format!("无法读取目录: {}", parent.display()))?
        .filter_map(|entry| entry.ok().map(|item| item.path()))
        .filter(|entry_path| entry_path.is_file() && is_supported_image(entry_path))
        .collect::<Vec<_>>();

    sibling_paths.sort_by(|left, right| {
        let left_name = left
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default();
        let right_name = right
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default();
        left_name.cmp(right_name)
    });

    let directory_images: Vec<EditorDirectoryImage> = sibling_paths
        .par_iter()
        .enumerate()
        .map(|(index, sibling_path)| {
            Ok(EditorDirectoryImage {
                index,
                thumbnail_data_url: String::new(),
                summary: read_image_summary(sibling_path)?,
            })
        })
        .collect::<Result<Vec<_>>>()?;

    let current_index = sibling_paths
        .iter()
        .position(|entry| entry == &selected_path)
        .context("未能在目录列表中定位当前图片")?;

    let current_image = directory_images[current_index].summary.clone();

    Ok(OpenImageSessionResult {
        current_image,
        directory_images,
        current_index,
    })
}

pub fn editor_thumbnail_cache_dir() -> PathBuf {
    if let Some(cache) = crate::portable::portable_cache_dir() {
        cache.join("editor-thumbs")
    } else {
        std::env::temp_dir().join("imageasy").join("editor-thumbs")
    }
}

pub fn editor_working_cache_dir() -> PathBuf {
    if let Some(cache) = crate::portable::portable_cache_dir() {
        cache.join("editor-work")
    } else {
        std::env::temp_dir().join("imageasy").join("editor-work")
    }
}

pub fn editor_preview_cache_dir() -> PathBuf {
    if let Some(cache) = crate::portable::portable_cache_dir() {
        cache.join("editor-previews")
    } else {
        std::env::temp_dir()
            .join("imageasy")
            .join("editor-previews")
    }
}

fn thumbnail_cache_key(path: &Path) -> Option<String> {
    let metadata = fs::metadata(path).ok()?;
    let mtime = metadata
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_millis();
    let size = metadata.len();
    let name = path.file_name()?.to_string_lossy();
    let hash_input = format!("{}:{}:{}", path.display(), mtime, size);
    let hash = simple_hash(&hash_input);
    Some(format!("{name}_{hash}.jpg"))
}

fn simple_hash(input: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in input.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn create_thumbnail_data_url(path: &Path, size: u32, quality: u8) -> Result<String> {
    let cache_dir = editor_thumbnail_cache_dir();

    if let Some(cache_name) = thumbnail_cache_key(path) {
        let cached_path = cache_dir.join(&cache_name);
        if cached_path.exists() {
            let bytes = fs::read(&cached_path)
                .with_context(|| format!("无法读取缓存缩略图: {}", cached_path.display()))?;
            let encoded = STANDARD.encode(&bytes);
            return Ok(format!("data:image/jpeg;base64,{encoded}"));
        }
    }

    // JPEG 使用 DCT 快速降采样解码，非 JPEG 使用完整解码
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let thumbnail = if matches!(extension.as_str(), "jpg" | "jpeg") {
        fast_decode_jpeg_thumbnail(path, size)?
    } else {
        let image = image::open(path)
            .with_context(|| format!("无法打开缩略图源文件: {}", path.display()))?;
        image.resize(size, size, FilterType::Nearest)
    };

    let mut buffer = Cursor::new(Vec::new());
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, quality);
    encoder.encode_image(&thumbnail)?;
    let jpeg_bytes = buffer.into_inner();

    if let Some(cache_name) = thumbnail_cache_key(path) {
        let _ = fs::create_dir_all(&cache_dir);
        let cached_path = cache_dir.join(&cache_name);
        let _ = fs::write(&cached_path, &jpeg_bytes);
    }

    let encoded = STANDARD.encode(&jpeg_bytes);
    Ok(format!("data:image/jpeg;base64,{encoded}"))
}

/// JPEG 缩略图快速解码：利用 DCT 缩放因子直接产出小图。
fn fast_decode_jpeg_thumbnail(path: &Path, size: u32) -> Result<DynamicImage> {
    let file =
        fs::File::open(path).with_context(|| format!("无法打开 JPEG: {}", path.display()))?;
    let mut decoder = JpegDecoder::new(std::io::BufReader::new(file));

    decoder
        .read_info()
        .with_context(|| format!("无法读取 JPEG 头部: {}", path.display()))?;

    // 设置目标尺寸，解码器自动选择最优 DCT 缩放因子（1/8 最快）
    let scale = size.min(u16::MAX as u32) as u16;
    decoder
        .scale(scale, scale)
        .with_context(|| format!("无法设置 JPEG 缩放: {}", path.display()))?;

    let pixels = decoder
        .decode()
        .with_context(|| format!("JPEG 解码失败: {}", path.display()))?;

    let info = decoder.info().context("解码后信息不可用")?;
    let (w, h) = (info.width as u32, info.height as u32);

    let dynamic_image = match info.pixel_format {
        jpeg_decoder::PixelFormat::RGB24 => {
            let buffer = ImageBuffer::<Rgb<u8>, _>::from_raw(w, h, pixels)
                .context("无法构建 RGB 图像缓冲")?;
            DynamicImage::ImageRgb8(buffer)
        }
        jpeg_decoder::PixelFormat::L8 => {
            let buffer = image::ImageBuffer::<image::Luma<u8>, _>::from_raw(w, h, pixels)
                .context("无法构建灰度图像缓冲")?;
            DynamicImage::ImageLuma8(buffer)
        }
        _ => {
            let image =
                image::open(path).with_context(|| format!("无法打开图片: {}", path.display()))?;
            image.resize(size, size, FilterType::Nearest)
        }
    };

    // 如果解码后仍大于目标尺寸，做最终 resize
    if w > size || h > size {
        Ok(dynamic_image.resize(size, size, FilterType::Nearest))
    } else {
        Ok(dynamic_image)
    }
}

pub(crate) fn read_image_summary(path: &Path) -> Result<EditorImageSummary> {
    let metadata =
        fs::metadata(path).with_context(|| format!("无法读取文件信息: {}", path.display()))?;
    let dimensions = image::image_dimensions(path)
        .with_context(|| format!("无法读取图片尺寸: {}", path.display()))?;

    Ok(EditorImageSummary {
        path: path.to_string_lossy().into_owned(),
        name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string(),
        extension: path
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase(),
        width: dimensions.0,
        height: dimensions.1,
        size_bytes: metadata.len(),
    })
}

pub(crate) fn is_supported_image(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| SUPPORTED_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

pub(crate) fn apply_adjustments(
    source: DynamicImage,
    adjustments: &AdjustmentParams,
) -> DynamicImage {
    let mut image = source.brighten(adjustments.brightness);
    image = image.adjust_contrast(adjustments.contrast as f32);
    image = apply_saturation(image, adjustments.saturation as f32 / 100.0);
    image = apply_temperature_and_tint(
        image,
        adjustments.temperature as f32 / 100.0,
        adjustments.tint as f32 / 100.0,
    );
    image = filters::apply_sharpen(image, adjustments.sharpen as f32 / 100.0);
    image = filters::apply_clarity(image, adjustments.clarity as f32 / 100.0);
    image = filters::apply_filter(
        image,
        &adjustments.filter_type,
        adjustments.filter_intensity as f32 / 100.0,
    );
    image = apply_rotation(image, adjustments.rotation);
    apply_crop(image, adjustments.crop.as_ref())
}

pub(crate) fn apply_rotation(image: DynamicImage, rotation: i32) -> DynamicImage {
    match rotation.rem_euclid(360) {
        90 => image.rotate90(),
        180 => image.rotate180(),
        270 => image.rotate270(),
        _ => image,
    }
}

pub(crate) fn apply_crop(image: DynamicImage, crop: Option<&CropRect>) -> DynamicImage {
    let Some(crop) = crop else {
        return image;
    };

    let width = image.width();
    let height = image.height();

    if crop.width == 0 || crop.height == 0 || crop.x >= width || crop.y >= height {
        return image;
    }

    let crop_width = crop.width.min(width.saturating_sub(crop.x));
    let crop_height = crop.height.min(height.saturating_sub(crop.y));

    image.crop_imm(crop.x, crop.y, crop_width, crop_height)
}

pub(crate) fn apply_saturation(image: DynamicImage, amount: f32) -> DynamicImage {
    if amount.abs() < f32::EPSILON {
        return image;
    }

    let mut rgba = image.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let [r, g, b, a] = pixel.0;
        let gray = 0.299 * r as f32 + 0.587 * g as f32 + 0.114 * b as f32;
        let factor = 1.0 + amount;
        let nr = ((gray + (r as f32 - gray) * factor).round()).clamp(0.0, 255.0) as u8;
        let ng = ((gray + (g as f32 - gray) * factor).round()).clamp(0.0, 255.0) as u8;
        let nb = ((gray + (b as f32 - gray) * factor).round()).clamp(0.0, 255.0) as u8;
        *pixel = Rgba([nr, ng, nb, a]);
    }
    DynamicImage::ImageRgba8(rgba)
}

pub(crate) fn apply_temperature_and_tint(
    image: DynamicImage,
    temperature: f32,
    tint: f32,
) -> DynamicImage {
    if temperature.abs() < f32::EPSILON && tint.abs() < f32::EPSILON {
        return image;
    }

    let mut rgba = image.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let [r, g, b, a] = pixel.0;
        let nr = shift_channel(r, 38.0, temperature);
        let ng = shift_channel(g, -26.0, tint);
        let nb = shift_channel(b, -38.0, temperature);
        *pixel = Rgba([nr, ng, nb, a]);
    }
    DynamicImage::ImageRgba8(rgba)
}

pub(crate) fn mix_channel(source: f32, target: f32, amount: f32) -> u8 {
    (source + (target - source) * amount)
        .round()
        .clamp(0.0, 255.0) as u8
}

pub(crate) fn shift_channel(source: u8, shift: f32, amount: f32) -> u8 {
    (source as f32 + shift * amount).round().clamp(0.0, 255.0) as u8
}

pub(crate) fn write_jpeg_image(path: &Path, image: &DynamicImage, quality: u8) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("无法创建输出目录: {}", parent.display()))?;
    }

    let file =
        fs::File::create(path).with_context(|| format!("无法创建输出文件: {}", path.display()))?;
    let mut writer = std::io::BufWriter::new(file);
    let mut encoder = JpegEncoder::new_with_quality(&mut writer, quality);
    encoder.encode_image(image)?;
    drop(writer);

    Ok(())
}
