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
pub struct StitchImageFilesRequest {
    pub source_paths: Vec<String>,
    pub output_directory: String,
    pub output_format: String,
    pub columns: u32,
    pub background_color: String,
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

fn parse_background_color(value: &str) -> Result<Rgba<u8>> {
    let value = value.trim();
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
    if request.source_paths.len() < 2 {
        anyhow::bail!("请至少选择 2 张图片进行拼接");
    }
    if !(1..=12).contains(&request.columns) {
        anyhow::bail!("列数必须在 1 到 12 之间");
    }
    if !matches!(normalized_format(&request.output_format).as_str(), "jpg" | "png" | "webp") {
        anyhow::bail!("不支持的输出格式: {}", request.output_format);
    }
    Ok(())
}

fn stitch_image_files_impl(request: StitchImageFilesRequest) -> Result<StitchImageFilesResult> {
    validate_request(&request)?;
    let background = parse_background_color(&request.background_color)?;

    let mut images = Vec::new();
    for source_path in &request.source_paths {
        let source = PathBuf::from(source_path);
        let image = image::open(&source).with_context(|| format!("无法打开图片: {}", source_name(&source, source_path)))?;
        images.push((source, image));
    }

    let cell_width = images.iter().map(|(_, image)| image.width()).max().context("没有可拼接图片")?;
    let cell_height = images.iter().map(|(_, image)| image.height()).max().context("没有可拼接图片")?;
    let columns = request.columns.min(images.len() as u32);
    let rows = ((images.len() as u32) + columns - 1) / columns;
    let canvas_width = columns.checked_mul(cell_width).context("拼接宽度过大")?;
    let canvas_height = rows.checked_mul(cell_height).context("拼接高度过大")?;
    let pixels = (canvas_width as u64).saturating_mul(canvas_height as u64);
    if pixels > MAX_OUTPUT_PIXELS {
        anyhow::bail!("拼接输出尺寸过大，请减少图片数量或列数");
    }

    let mut canvas = DynamicImage::ImageRgba8(ImageBuffer::from_pixel(canvas_width, canvas_height, background));

    for (index, (_source, image)) in images.iter().enumerate() {
        let column = (index as u32) % columns;
        let row = (index as u32) / columns;
        let scale = (cell_width as f32 / image.width() as f32).min(cell_height as f32 / image.height() as f32);
        let target_width = ((image.width() as f32 * scale).round() as u32).max(1);
        let target_height = ((image.height() as f32 * scale).round() as u32).max(1);
        let resized = image.resize(target_width, target_height, FilterType::Lanczos3);
        let x = column * cell_width + (cell_width - target_width) / 2;
        let y = row * cell_height + (cell_height - target_height) / 2;
        imageops::overlay(&mut canvas, &resized, x.into(), y.into());
    }

    let output_directory = PathBuf::from(&request.output_directory);
    fs::create_dir_all(&output_directory)
        .with_context(|| format!("无法创建输出目录: {}", output_directory.display()))?;
    let base_stem = stem(&images[0].0);
    let output_path = next_output_path(&output_directory, &base_stem, &request);
    write_dynamic_image(&output_path, &canvas, &request.output_format, Some(90))?;

    Ok(StitchImageFilesResult {
        output_path: output_path.to_string_lossy().into_owned(),
        stitched_count: images.len() as u32,
    })
}
