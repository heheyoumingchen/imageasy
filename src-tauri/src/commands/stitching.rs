use super::{
    common::{
        apply_color_mode, current_date_stamp, extension, normalized_format, write_dynamic_image,
    },
    path_guard::ensure_output_directory,
};
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, ImageBuffer, Rgb, Rgba};
use jpeg_decoder::Decoder as JpegDecoder;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{BufReader, Cursor},
    path::{Path, PathBuf},
};
use walkdir::WalkDir;

mod geometry;
mod image_pipeline;

const MAX_OUTPUT_PIXELS: u64 = 100_000_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StitchingImageMetadata {
    pub width: u32,
    pub height: u32,
    pub extension: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectStitchingFileResult {
    pub kind: String,
    pub source_path: String,
    pub source_name: String,
    pub image_metadata: Option<StitchingImageMetadata>,
    pub thumbnail: Option<String>,
    pub error_message: Option<String>,
}

fn default_scale() -> f32 {
    1.0
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StitchLayoutCell {
    pub source_path: String,
    pub row: u32,
    pub col: u32,
    pub row_span: u32,
    pub col_span: u32,
    // 方格内图片的缩放与位移（编辑模式）。scale>=1，offset 以方格尺寸的比例表示（-1~1）。
    #[serde(default = "default_scale")]
    pub scale: f32,
    #[serde(default)]
    pub offset_x: f32,
    #[serde(default)]
    pub offset_y: f32,
}

/// 拼接缩略图缓存目录
pub fn stitching_thumbnail_cache_dir() -> PathBuf {
    if let Some(cache) = crate::portable::portable_cache_dir() {
        cache.join("stitching-thumbnails")
    } else {
        std::env::temp_dir()
            .join("imageasy")
            .join("stitching-thumbnails")
    }
}

/// 简单哈希函数（FNV-1a）
fn simple_hash(input: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in input.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// 生成缩略图缓存文件名（基于源文件路径 + mtime + size）
fn stitching_thumbnail_cache_key(path: &Path) -> Option<String> {
    let metadata = fs::metadata(path).ok()?;
    let mtime = metadata
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();
    let size = metadata.len();
    let path_str = path.to_string_lossy();
    let hash = simple_hash(&format!("{path_str}_{mtime}_{size}"));
    let stem = path.file_stem()?.to_str()?;
    Some(format!("{stem}_{hash}_360.jpg"))
}

/// JPEG 缩略图快速解码：利用 DCT 缩放因子直接产出小图
fn fast_decode_jpeg_thumbnail_stitching(path: &Path, size: u32) -> Result<DynamicImage> {
    let file =
        fs::File::open(path).with_context(|| format!("无法打开 JPEG: {}", path.display()))?;
    let mut decoder = JpegDecoder::new(BufReader::new(file));

    decoder
        .read_info()
        .with_context(|| format!("无法读取 JPEG 头部: {}", path.display()))?;

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
            image.resize(size, size, FilterType::CatmullRom)
        }
    };

    if w > size || h > size {
        Ok(dynamic_image.resize(size, size, FilterType::CatmullRom))
    } else {
        Ok(dynamic_image)
    }
}

fn create_stitching_thumbnail_data_url(path: &Path) -> Result<String> {
    let cache_dir = stitching_thumbnail_cache_dir();

    // 检查磁盘缓存
    if let Some(cache_name) = stitching_thumbnail_cache_key(path) {
        let cached_path = cache_dir.join(&cache_name);
        if cached_path.exists() {
            // 返回缓存文件的绝对路径（前端通过 convertFileSrc 转为 asset URL）
            return Ok(cached_path.to_string_lossy().into_owned());
        }
    }

    // JPEG 使用快速解码，非 JPEG 使用完整解码
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let thumbnail = if matches!(extension.as_str(), "jpg" | "jpeg") {
        fast_decode_jpeg_thumbnail_stitching(path, 360)?
    } else {
        let image =
            image::open(path).with_context(|| format!("无法生成拼接缩略图: {}", path.display()))?;
        image.resize(360, 360, FilterType::CatmullRom)
    };

    // 写入磁盘缓存
    if let Some(cache_name) = stitching_thumbnail_cache_key(path) {
        let _ = fs::create_dir_all(&cache_dir);
        let cached_path = cache_dir.join(&cache_name);
        let file = fs::File::create(&cached_path)
            .with_context(|| format!("无法创建缩略图缓存: {}", cached_path.display()))?;
        let mut writer = std::io::BufWriter::new(file);
        let mut encoder = JpegEncoder::new_with_quality(&mut writer, 58);
        encoder.encode_image(&thumbnail)?;
        return Ok(cached_path.to_string_lossy().into_owned());
    }

    // 降级：无法生成缓存 key 时返回 base64
    let mut buffer = Cursor::new(Vec::new());
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, 58);
    encoder.encode_image(&thumbnail)?;
    let encoded = STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/jpeg;base64,{encoded}"))
}

fn inspect_image_metadata(path: &Path, source_name: String) -> Result<InspectStitchingFileResult> {
    let dimensions = image::image_dimensions(path)
        .with_context(|| format!("无法读取图片尺寸: {}", source_name))?;
    Ok(InspectStitchingFileResult {
        kind: "image".into(),
        source_path: path.to_string_lossy().into_owned(),
        source_name,
        image_metadata: Some(StitchingImageMetadata {
            width: dimensions.0,
            height: dimensions.1,
            extension: extension(path),
        }),
        // 禁止用 Tauri asset URL 直接预览本地图片；导入阶段返回小尺寸 data URL 缩略图。
        thumbnail: Some(create_stitching_thumbnail_data_url(path)?),
        error_message: None,
    })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StitchImageFilesRequest {
    pub cells: Vec<StitchLayoutCell>,
    pub rows: u32,
    pub cols: u32,
    pub canvas_ratio: String,
    pub resolution: u32,
    pub padding: u32,
    pub spacing: u32,
    pub border_radius: u32,
    pub background_color: String,
    pub quality: u8,
    pub color_mode: String,
    pub output_directory: String,
    pub output_format: String,
    pub naming_pattern: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StitchImageFilesResult {
    pub output_path: String,
    pub stitched_count: u32,
}

#[tauri::command]
pub async fn inspect_stitching_file(path: String) -> Result<InspectStitchingFileResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        inspect_stitching_file_impl(&path)
            .map_err(crate::commands::error_message::to_user_error_string)
    })
    .await
    .map_err(crate::commands::error_message::to_user_error_string)?
}

#[tauri::command]
pub async fn inspect_stitching_directory(
    path: String,
) -> Result<Vec<InspectStitchingFileResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        inspect_stitching_directory_impl(&path)
            .map_err(crate::commands::error_message::to_user_error_string)
    })
    .await
    .map_err(crate::commands::error_message::to_user_error_string)?
}

#[tauri::command]
pub async fn stitch_image_files(
    request: StitchImageFilesRequest,
) -> Result<StitchImageFilesResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        stitch_image_files_impl(request)
            .map_err(crate::commands::error_message::to_user_error_string)
    })
    .await
    .map_err(crate::commands::error_message::to_user_error_string)?
}

fn source_name(path: &Path, fallback: &str) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(fallback)
        .to_string()
}

fn stem(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("stitched")
        .to_string()
}

fn is_supported_image(path: &Path) -> bool {
    matches!(
        extension(path).as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif"
    )
}

fn inspect_stitching_file_impl(path: &str) -> Result<InspectStitchingFileResult> {
    let source = PathBuf::from(path);
    let source_name = source_name(&source, path);
    if is_supported_image(&source) {
        return inspect_image_metadata(&source, source_name);
    }

    Ok(InspectStitchingFileResult {
        kind: "unsupported".into(),
        source_path: path.into(),
        source_name,
        image_metadata: None,
        thumbnail: None,
        error_message: Some("不支持的文件类型".into()),
    })
}

fn inspect_stitching_directory_impl(path: &str) -> Result<Vec<InspectStitchingFileResult>> {
    // 先收集候选路径，再用 rayon 并行解码生成缩略图，加速大目录导入。
    let candidates: Vec<PathBuf> = WalkDir::new(path)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| is_supported_image(entry.path()))
        .map(|entry| entry.into_path())
        .collect();

    let mut items = candidates
        .par_iter()
        .map(|candidate| inspect_stitching_file_impl(&candidate.to_string_lossy()))
        .collect::<Result<Vec<_>>>()?;

    items.sort_by(|left, right| left.source_name.cmp(&right.source_name));
    Ok(items)
}

fn output_format_extension(output_format: &str) -> String {
    match normalized_format(output_format).as_str() {
        "jpg" => "jpg".to_string(),
        "png" => "png".to_string(),
        "webp" => "webp".to_string(),
        other => other.to_string(),
    }
}

#[derive(Debug, Clone, Copy)]
struct Rect {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}

fn canvas_dimensions(canvas_ratio: &str, resolution: u32) -> Result<(u32, u32)> {
    let (ratio_width, ratio_height) = match canvas_ratio {
        "1:1" => (1u32, 1u32),
        "3:4" => (3, 4),
        "9:16" => (9, 16),
        "4:3" => (4, 3),
        "16:9" => (16, 9),
        other => anyhow::bail!("不支持的画幅比例: {other}"),
    };
    if !matches!(resolution, 768 | 1080 | 1536 | 2160) {
        anyhow::bail!("不支持的清晰度: {resolution}");
    }
    if ratio_width >= ratio_height {
        Ok((resolution * ratio_width / ratio_height, resolution))
    } else {
        Ok((resolution, resolution * ratio_height / ratio_width))
    }
}

fn layout_rect(
    request: &StitchImageFilesRequest,
    cell: &StitchLayoutCell,
    canvas_width: u32,
    canvas_height: u32,
) -> Result<Rect> {
    if cell.row_span == 0
        || cell.col_span == 0
        || cell.row >= request.rows
        || cell.col >= request.cols
        || cell.row + cell.row_span > request.rows
        || cell.col + cell.col_span > request.cols
    {
        anyhow::bail!("布局单元格超出画布范围");
    }

    let available_width = canvas_width
        .checked_sub(request.padding * 2)
        .context("边距过大")?;
    let available_height = canvas_height
        .checked_sub(request.padding * 2)
        .context("边距过大")?;
    let total_spacing_width = request
        .spacing
        .saturating_mul(request.cols.saturating_sub(1));
    let total_spacing_height = request
        .spacing
        .saturating_mul(request.rows.saturating_sub(1));
    if available_width <= total_spacing_width || available_height <= total_spacing_height {
        anyhow::bail!("边距或间距过大");
    }

    let cell_width = (available_width - total_spacing_width) as f64 / request.cols as f64;
    let cell_height = (available_height - total_spacing_height) as f64 / request.rows as f64;
    let x = request.padding as f64 + cell.col as f64 * (cell_width + request.spacing as f64);
    let y = request.padding as f64 + cell.row as f64 * (cell_height + request.spacing as f64);
    let width = cell.col_span as f64 * cell_width
        + cell.col_span.saturating_sub(1) as f64 * request.spacing as f64;
    let height = cell.row_span as f64 * cell_height
        + cell.row_span.saturating_sub(1) as f64 * request.spacing as f64;

    Ok(Rect {
        x: x.round() as u32,
        y: y.round() as u32,
        width: width.round().max(1.0) as u32,
        height: height.round().max(1.0) as u32,
    })
}

// 将 cover 后的粘贴偏移夹紧，使缩放后的图片始终完整覆盖方格，避免拖动到边缘时露出透明白边。
// resized_size 恒 >= target_size（cover 保证），因此合法粘贴范围是 [target_size - resized_size, 0]。
#[cfg(test)]
fn clamp_cover_paste_offset(
    center: f32,
    requested_offset: f32,
    target_size: u32,
    resized_size: u32,
) -> i64 {
    let raw = center + requested_offset * target_size as f32;
    let min = target_size as i64 - resized_size as i64;
    let max = 0i64;
    (raw.round() as i64).clamp(min.min(max), max)
}

// 在 cover（等比铺满、超出不显示）基础上应用缩放与自由位移。
// 默认 scale=1 时图片等比缩放使短边贴合方格，长边超出方格并被 tile 边界隐藏。
// 示例：原图 50x150，方格 25x25 → 缩放为 25x75（宽度贴合，高度上下超出并隐藏）。
// scale>1 进一步放大；offset_x/offset_y 以方格尺寸的比例平移调整可视区域。
#[cfg(test)]
fn object_cover_transform(
    image: &DynamicImage,
    target_width: u32,
    target_height: u32,
    scale: f32,
    offset_x: f32,
    offset_y: f32,
) -> image::RgbaImage {
    let scale = scale.clamp(1.0, 6.0);
    let offset_x = offset_x.clamp(-1.0, 1.0);
    let offset_y = offset_y.clamp(-1.0, 1.0);

    // cover: 使用 max 使短边贴合，长边超出后由 tile 边界隐藏
    let cover_scale = (target_width as f32 / image.width() as f32)
        .max(target_height as f32 / image.height() as f32)
        * scale;
    let resize_width = ((image.width() as f32 * cover_scale).round() as u32).max(1);
    let resize_height = ((image.height() as f32 * cover_scale).round() as u32).max(1);
    let resized = image.resize_exact(resize_width, resize_height, FilterType::Lanczos3);

    let mut tile = ImageBuffer::from_pixel(target_width, target_height, Rgba([0, 0, 0, 0]));
    let center_x = (target_width as f32 - resize_width as f32) / 2.0;
    let center_y = (target_height as f32 - resize_height as f32) / 2.0;
    let paste_x = clamp_cover_paste_offset(center_x, offset_x, target_width, resize_width);
    let paste_y = clamp_cover_paste_offset(center_y, offset_y, target_height, resize_height);
    image::imageops::overlay(&mut tile, &resized.to_rgba8(), paste_x, paste_y);
    tile
}

fn parse_background_color(value: &str) -> Result<Rgba<u8>> {
    let value = value.trim();
    if value == "transparent" {
        return Ok(Rgba([255, 255, 255, 255]));
    }
    if value.len() != 7 || !value.starts_with('#') {
        anyhow::bail!("背景色必须是 #RRGGBB 格式");
    }
    let red = u8::from_str_radix(&value[1..3], 16).context("背景色红色通道无效")?;
    let green = u8::from_str_radix(&value[3..5], 16).context("背景色绿色通道无效")?;
    let blue = u8::from_str_radix(&value[5..7], 16).context("背景色蓝色通道无效")?;
    Ok(Rgba([red, green, blue, 255]))
}

fn output_file_name(
    base_stem: &str,
    naming_pattern: &str,
    output_format: &str,
    index: u32,
) -> String {
    let extension = output_format_extension(output_format);
    match naming_pattern {
        "source-name-original" => format!("{}.{}", base_stem, extension),
        "source-name-date" => format!(
            "{}-stitch-{}-{:03}.{}",
            base_stem,
            current_date_stamp(),
            index,
            extension
        ),
        _ => format!("{}-stitch-{:03}.{}", base_stem, index, extension),
    }
}

fn next_output_path(
    output_directory: &Path,
    base_stem: &str,
    request: &StitchImageFilesRequest,
) -> PathBuf {
    for index in 1..=9999 {
        let candidate = output_directory.join(output_file_name(
            base_stem,
            &request.naming_pattern,
            &request.output_format,
            index,
        ));
        if !candidate.exists() {
            return candidate;
        }
    }
    output_directory.join(output_file_name(
        base_stem,
        &request.naming_pattern,
        &request.output_format,
        10_000,
    ))
}

fn validate_request(request: &StitchImageFilesRequest) -> Result<()> {
    let filled_count = request
        .cells
        .iter()
        .filter(|cell| !cell.source_path.trim().is_empty())
        .count();
    if filled_count < 2 {
        anyhow::bail!("请至少选择 2 张图片进行拼接");
    }
    if !(1..=16).contains(&request.rows) || !(1..=16).contains(&request.cols) {
        anyhow::bail!("布局行列数必须在 1 到 16 之间");
    }
    if request.padding > 100 || request.spacing > 100 || request.border_radius > 50 {
        anyhow::bail!("边距、间距或圆角参数超出范围");
    }
    if !matches!(
        normalized_format(&request.output_format).as_str(),
        "jpg" | "png" | "webp"
    ) {
        anyhow::bail!("不支持的输出格式: {}", request.output_format);
    }
    for cell in &request.cells {
        layout_rect(
            request,
            cell,
            canvas_dimensions(&request.canvas_ratio, request.resolution)?.0,
            canvas_dimensions(&request.canvas_ratio, request.resolution)?.1,
        )?;
    }
    Ok(())
}

fn stitch_image_files_impl(request: StitchImageFilesRequest) -> Result<StitchImageFilesResult> {
    validate_request(&request)?;
    let background = parse_background_color(&request.background_color)?;
    let (canvas_width, canvas_height) =
        canvas_dimensions(&request.canvas_ratio, request.resolution)?;
    let pixels = (canvas_width as u64).saturating_mul(canvas_height as u64);
    if pixels > MAX_OUTPUT_PIXELS {
        anyhow::bail!("拼接输出尺寸过大，请降低清晰度");
    }

    let mut canvas = DynamicImage::ImageRgba8(ImageBuffer::from_pixel(
        canvas_width,
        canvas_height,
        background,
    ));

    struct PreparedCell {
        source: PathBuf,
        source_label: String,
        rect: Rect,
        scale: f32,
        offset_x: f32,
        offset_y: f32,
    }

    let prepared: Vec<PreparedCell> = request
        .cells
        .iter()
        .filter(|cell| !cell.source_path.trim().is_empty())
        .map(|cell| {
            let rect = layout_rect(&request, cell, canvas_width, canvas_height)?;
            let source = PathBuf::from(&cell.source_path);
            let source_label = source_name(&source, &cell.source_path);
            Ok(PreparedCell {
                source,
                source_label,
                rect,
                scale: cell.scale,
                offset_x: cell.offset_x,
                offset_y: cell.offset_y,
            })
        })
        .collect::<Result<Vec<_>>>()?;

    let first_source = prepared.first().map(|cell| cell.source.clone());
    let stitched_count = prepared.len() as u32;

    // 解码/裁剪/缩放互不依赖，并行出 tile 后再按原顺序合成。
    let tiles = prepared
        .par_iter()
        .map(|cell| {
            let dimensions = image::image_dimensions(&cell.source)
                .with_context(|| format!("无法读取图片尺寸: {}", cell.source_label))?;
            let placed = image_pipeline::render_cover_tile(
                &cell.source,
                geometry::Size {
                    width: dimensions.0,
                    height: dimensions.1,
                },
                geometry::Size {
                    width: cell.rect.width,
                    height: cell.rect.height,
                },
                cell.scale,
                cell.offset_x,
                cell.offset_y,
            )?;
            Ok((cell.rect, placed))
        })
        .collect::<Result<Vec<_>>>()?;

    {
        let canvas = canvas.as_mut_rgba8().context("拼接画布不是 RGBA 图像")?;
        for (rect, placed) in tiles {
            image_pipeline::composite_tile(
                canvas,
                placed,
                image_pipeline::DestinationPlacement {
                    x: rect.x.into(),
                    y: rect.y.into(),
                },
                request.border_radius,
            );
        }
    }

    let output_directory = ensure_output_directory(Path::new(&request.output_directory))?;
    let base_stem = first_source
        .as_ref()
        .map(|path| stem(path))
        .unwrap_or_else(|| "stitched".into());
    let output_path = next_output_path(&output_directory, &base_stem, &request);
    let canvas = apply_color_mode(canvas, &request.color_mode);
    write_dynamic_image(
        &output_path,
        &canvas,
        &request.output_format,
        Some(request.quality),
        &request.color_mode,
    )?;

    Ok(StitchImageFilesResult {
        output_path: output_path.to_string_lossy().into_owned(),
        stitched_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, ImageBuffer, Rgb};

    #[test]
    fn object_cover_transform_clamps_positive_offset_to_keep_cell_covered() {
        // 竖长图导入方格后被拖到极端位置，方格边缘不应出现透明像素（白边）。
        let source = DynamicImage::ImageRgb8(ImageBuffer::<Rgb<u8>, _>::from_pixel(
            50,
            150,
            Rgb([20, 40, 60]),
        ));
        let placed = object_cover_transform(&source, 25, 25, 1.0, 1.0, 1.0);

        for x in 0..25 {
            assert_ne!(placed.get_pixel(x, 0).0[3], 0);
            assert_ne!(placed.get_pixel(x, 24).0[3], 0);
        }
        for y in 0..25 {
            assert_ne!(placed.get_pixel(0, y).0[3], 0);
            assert_ne!(placed.get_pixel(24, y).0[3], 0);
        }
    }

    #[test]
    fn object_cover_transform_clamps_negative_offset_to_keep_cell_covered() {
        let source = DynamicImage::ImageRgb8(ImageBuffer::<Rgb<u8>, _>::from_pixel(
            150,
            50,
            Rgb([20, 40, 60]),
        ));
        let placed = object_cover_transform(&source, 25, 25, 1.0, -1.0, -1.0);

        for x in 0..25 {
            assert_ne!(placed.get_pixel(x, 0).0[3], 0);
            assert_ne!(placed.get_pixel(x, 24).0[3], 0);
        }
        for y in 0..25 {
            assert_ne!(placed.get_pixel(0, y).0[3], 0);
            assert_ne!(placed.get_pixel(24, y).0[3], 0);
        }
    }

    #[test]
    fn stitching_original_name_uses_first_source_stem() {
        assert_eq!(
            output_file_name("first", "source-name-original", "png", 1),
            "first.png"
        );
        assert_eq!(
            output_file_name("first", "source-name-index", "png", 1),
            "first-stitch-001.png"
        );
    }
}
