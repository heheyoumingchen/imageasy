use super::common::{current_date_stamp, extension, normalized_format, write_dynamic_image};
use anyhow::{Context, Result};
use image::imageops::{self, FilterType};
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;

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
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StitchLayoutCell {
    pub source_path: String,
    pub row: u32,
    pub col: u32,
    pub row_span: u32,
    pub col_span: u32,
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
pub fn inspect_stitching_file(path: String) -> Result<InspectStitchingFileResult, String> {
    inspect_stitching_file_impl(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn inspect_stitching_directory(path: String) -> Result<Vec<InspectStitchingFileResult>, String> {
    inspect_stitching_directory_impl(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn stitch_image_files(request: StitchImageFilesRequest) -> Result<StitchImageFilesResult, String> {
    stitch_image_files_impl(request).map_err(|error| error.to_string())
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
    matches!(extension(path).as_str(), "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif")
}

fn inspect_stitching_file_impl(path: &str) -> Result<InspectStitchingFileResult> {
    let source = PathBuf::from(path);
    let source_name = source_name(&source, path);
    if is_supported_image(&source) {
        let image = image::open(&source).with_context(|| format!("无法打开图片: {}", source.display()))?;
        let (width, height) = image.dimensions();
        return Ok(InspectStitchingFileResult {
            kind: "image".into(),
            source_path: path.into(),
            source_name,
            image_metadata: Some(StitchingImageMetadata { width, height, extension: extension(&source) }),
            error_message: None,
        });
    }

    Ok(InspectStitchingFileResult {
        kind: "unsupported".into(),
        source_path: path.into(),
        source_name,
        image_metadata: None,
        error_message: Some("不支持的文件类型".into()),
    })
}

fn inspect_stitching_directory_impl(path: &str) -> Result<Vec<InspectStitchingFileResult>> {
    let mut items = WalkDir::new(path)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| is_supported_image(entry.path()))
        .map(|entry| inspect_stitching_file_impl(&entry.path().to_string_lossy()))
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

fn layout_rect(request: &StitchImageFilesRequest, cell: &StitchLayoutCell, canvas_width: u32, canvas_height: u32) -> Result<Rect> {
    if cell.row_span == 0 || cell.col_span == 0 || cell.row >= request.rows || cell.col >= request.cols || cell.row + cell.row_span > request.rows || cell.col + cell.col_span > request.cols {
        anyhow::bail!("布局单元格超出画布范围");
    }

    let available_width = canvas_width.checked_sub(request.padding * 2).context("边距过大")?;
    let available_height = canvas_height.checked_sub(request.padding * 2).context("边距过大")?;
    let total_spacing_width = request.spacing.saturating_mul(request.cols.saturating_sub(1));
    let total_spacing_height = request.spacing.saturating_mul(request.rows.saturating_sub(1));
    if available_width <= total_spacing_width || available_height <= total_spacing_height {
        anyhow::bail!("边距或间距过大");
    }

    let cell_width = (available_width - total_spacing_width) as f64 / request.cols as f64;
    let cell_height = (available_height - total_spacing_height) as f64 / request.rows as f64;
    let x = request.padding as f64 + cell.col as f64 * (cell_width + request.spacing as f64);
    let y = request.padding as f64 + cell.row as f64 * (cell_height + request.spacing as f64);
    let width = cell.col_span as f64 * cell_width + cell.col_span.saturating_sub(1) as f64 * request.spacing as f64;
    let height = cell.row_span as f64 * cell_height + cell.row_span.saturating_sub(1) as f64 * request.spacing as f64;

    Ok(Rect {
        x: x.round() as u32,
        y: y.round() as u32,
        width: width.round().max(1.0) as u32,
        height: height.round().max(1.0) as u32,
    })
}

fn inside_rounded_rect(x: u32, y: u32, width: u32, height: u32, radius: u32) -> bool {
    let radius = radius.min(width / 2).min(height / 2);
    if radius == 0 {
        return true;
    }
    let x = x as i64;
    let y = y as i64;
    let width = width as i64;
    let height = height as i64;
    let radius = radius as i64;

    let corner = |cx: i64, cy: i64| {
        let dx = x - cx;
        let dy = y - cy;
        dx * dx + dy * dy <= radius * radius
    };

    if x < radius && y < radius {
        corner(radius, radius)
    } else if x >= width - radius && y < radius {
        corner(width - radius - 1, radius)
    } else if x < radius && y >= height - radius {
        corner(radius, height - radius - 1)
    } else if x >= width - radius && y >= height - radius {
        corner(width - radius - 1, height - radius - 1)
    } else {
        true
    }
}

fn object_cover(image: &DynamicImage, target_width: u32, target_height: u32) -> DynamicImage {
    let scale = (target_width as f32 / image.width() as f32).max(target_height as f32 / image.height() as f32);
    let resize_width = ((image.width() as f32 * scale).ceil() as u32).max(target_width);
    let resize_height = ((image.height() as f32 * scale).ceil() as u32).max(target_height);
    let resized = image.resize(resize_width, resize_height, FilterType::Lanczos3);
    let crop_x = resized.width().saturating_sub(target_width) / 2;
    let crop_y = resized.height().saturating_sub(target_height) / 2;
    resized.crop_imm(crop_x, crop_y, target_width, target_height)
}

fn overlay_rounded(canvas: &mut DynamicImage, image: &DynamicImage, rect: Rect, radius: u32) {
    let mut tile = image.to_rgba8();
    for y in 0..tile.height() {
        for x in 0..tile.width() {
            if !inside_rounded_rect(x, y, tile.width(), tile.height(), radius) {
                tile.get_pixel_mut(x, y).0[3] = 0;
            }
        }
    }
    imageops::overlay(canvas, &DynamicImage::ImageRgba8(tile), rect.x.into(), rect.y.into());
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

fn output_file_name(base_stem: &str, naming_pattern: &str, output_format: &str, index: u32) -> String {
    let extension = output_format_extension(output_format);
    match naming_pattern {
        "source-name-date" => format!("{}-stitch-{}-{:03}.{}", base_stem, current_date_stamp(), index, extension),
        _ => format!("{}-stitch-{:03}.{}", base_stem, index, extension),
    }
}

fn next_output_path(output_directory: &Path, base_stem: &str, request: &StitchImageFilesRequest) -> PathBuf {
    for index in 1..=9999 {
        let candidate = output_directory.join(output_file_name(base_stem, &request.naming_pattern, &request.output_format, index));
        if !candidate.exists() {
            return candidate;
        }
    }
    output_directory.join(output_file_name(base_stem, &request.naming_pattern, &request.output_format, 10_000))
}

fn validate_request(request: &StitchImageFilesRequest) -> Result<()> {
    let filled_count = request.cells.iter().filter(|cell| !cell.source_path.trim().is_empty()).count();
    if filled_count < 2 {
        anyhow::bail!("请至少选择 2 张图片进行拼接");
    }
    if !(1..=16).contains(&request.rows) || !(1..=16).contains(&request.cols) {
        anyhow::bail!("布局行列数必须在 1 到 16 之间");
    }
    if request.padding > 100 || request.spacing > 100 || request.border_radius > 50 {
        anyhow::bail!("边距、间距或圆角参数超出范围");
    }
    if !matches!(normalized_format(&request.output_format).as_str(), "jpg" | "png" | "webp") {
        anyhow::bail!("不支持的输出格式: {}", request.output_format);
    }
    for cell in &request.cells {
        layout_rect(request, cell, canvas_dimensions(&request.canvas_ratio, request.resolution)?.0, canvas_dimensions(&request.canvas_ratio, request.resolution)?.1)?;
    }
    Ok(())
}

fn stitch_image_files_impl(request: StitchImageFilesRequest) -> Result<StitchImageFilesResult> {
    validate_request(&request)?;
    let background = parse_background_color(&request.background_color)?;
    let (canvas_width, canvas_height) = canvas_dimensions(&request.canvas_ratio, request.resolution)?;
    let pixels = (canvas_width as u64).saturating_mul(canvas_height as u64);
    if pixels > MAX_OUTPUT_PIXELS {
        anyhow::bail!("拼接输出尺寸过大，请降低清晰度");
    }

    let mut canvas = DynamicImage::ImageRgba8(ImageBuffer::from_pixel(canvas_width, canvas_height, background));
    let mut first_source: Option<PathBuf> = None;
    let mut stitched_count = 0u32;

    for cell in request.cells.iter().filter(|cell| !cell.source_path.trim().is_empty()) {
        let rect = layout_rect(&request, cell, canvas_width, canvas_height)?;
        let source = PathBuf::from(&cell.source_path);
        if first_source.is_none() {
            first_source = Some(source.clone());
        }
        let image = image::open(&source).with_context(|| format!("无法打开图片: {}", source_name(&source, &cell.source_path)))?;
        let cropped = object_cover(&image, rect.width, rect.height);
        overlay_rounded(&mut canvas, &cropped, rect, request.border_radius);
        stitched_count += 1;
    }

    let output_directory = PathBuf::from(&request.output_directory);
    fs::create_dir_all(&output_directory)
        .with_context(|| format!("无法创建输出目录: {}", output_directory.display()))?;
    let base_stem = first_source.as_ref().map(|path| stem(path)).unwrap_or_else(|| "stitched".into());
    let output_path = next_output_path(&output_directory, &base_stem, &request);
    write_dynamic_image(&output_path, &canvas, &request.output_format, Some(request.quality))?;

    Ok(StitchImageFilesResult {
        output_path: output_path.to_string_lossy().into_owned(),
        stitched_count,
    })
}
