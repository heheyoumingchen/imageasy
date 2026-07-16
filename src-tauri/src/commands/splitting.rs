use super::{
    common::{
        apply_color_mode, current_date_stamp, extension, normalized_format, write_dynamic_image,
    },
    pdf_rendering::render_pdf_pages_with_callback,
};
use anyhow::{Context, Result};
use image::{DynamicImage, GenericImageView};
use lopdf::Document as LoDocument;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::Manager;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplittingImageMetadata {
    pub width: u32,
    pub height: u32,
    pub extension: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplittingPdfMetadata {
    pub page_count: u32,
    pub extension: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectSplittingFileResult {
    pub kind: String,
    pub source_path: String,
    pub source_name: String,
    pub image_metadata: Option<SplittingImageMetadata>,
    pub pdf_metadata: Option<SplittingPdfMetadata>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitImageFileRequest {
    pub source_path: String,
    pub output_directory: String,
    pub output_format: String,
    pub color_mode: String,
    pub columns: u32,
    pub rows: u32,
    pub quality: u8,
    pub naming_pattern: String,
    #[serde(default)]
    pub include_output_paths: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitImageFileResult {
    pub output_paths: Vec<String>,
    pub split_count: u32,
    pub skipped_count: u32,
}

#[tauri::command]
pub async fn inspect_splitting_file(path: String) -> Result<InspectSplittingFileResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        inspect_splitting_file_impl(&path).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn inspect_splitting_directory(
    path: String,
) -> Result<Vec<InspectSplittingFileResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        inspect_splitting_directory_impl(&path).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn split_image_file(
    app: tauri::AppHandle,
    request: SplitImageFileRequest,
) -> Result<SplitImageFileResult, String> {
    let resource_dir = app.path().resource_dir().ok();
    tauri::async_runtime::spawn_blocking(move || {
        split_image_file_impl(request, resource_dir).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

pub fn split_image_file_with_resource_dir(
    request: SplitImageFileRequest,
    resource_dir: Option<PathBuf>,
) -> Result<SplitImageFileResult> {
    split_image_file_impl(request, resource_dir)
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
        .unwrap_or("output")
        .to_string()
}

fn is_supported_image(path: &Path) -> bool {
    matches!(
        extension(path).as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif"
    )
}

fn is_supported_source(path: &Path) -> bool {
    is_supported_image(path) || extension(path) == "pdf"
}

fn pdf_page_count(path: &Path) -> Result<u32> {
    let document =
        LoDocument::load(path).with_context(|| format!("无法读取 PDF 文档: {}", path.display()))?;
    Ok(document.get_pages().len() as u32)
}

fn inspect_splitting_file_impl(path: &str) -> Result<InspectSplittingFileResult> {
    let source = PathBuf::from(path);
    let source_name = source_name(&source, path);
    let ext = extension(&source);

    if is_supported_image(&source) {
        // 仅读取图片尺寸而不完整解码，避免大图导入时卡顿。
        let (width, height) = image::image_dimensions(&source)
            .with_context(|| format!("无法读取图片尺寸: {}", source.display()))?;
        return Ok(InspectSplittingFileResult {
            kind: "image".into(),
            source_path: path.into(),
            source_name,
            image_metadata: Some(SplittingImageMetadata {
                width,
                height,
                extension: ext,
            }),
            pdf_metadata: None,
            error_message: None,
        });
    }

    if ext == "pdf" {
        return Ok(InspectSplittingFileResult {
            kind: "pdf".into(),
            source_path: path.into(),
            source_name,
            image_metadata: None,
            pdf_metadata: Some(SplittingPdfMetadata {
                page_count: pdf_page_count(&source)?,
                extension: ext,
            }),
            error_message: None,
        });
    }

    Ok(InspectSplittingFileResult {
        kind: "unsupported".into(),
        source_path: path.into(),
        source_name,
        image_metadata: None,
        pdf_metadata: None,
        error_message: Some("不支持的文件类型".into()),
    })
}

fn inspect_splitting_directory_impl(path: &str) -> Result<Vec<InspectSplittingFileResult>> {
    // 先收集候选路径，再用 rayon 并行检查，加速大目录导入。
    let candidates: Vec<PathBuf> = WalkDir::new(path)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| is_supported_source(entry.path()))
        .map(|entry| entry.into_path())
        .collect();

    let mut items = candidates
        .par_iter()
        .map(|candidate| inspect_splitting_file_impl(&candidate.to_string_lossy()))
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

fn output_file_name(stem: &str, naming_pattern: &str, output_format: &str, index: u32) -> String {
    let output_format = output_format_extension(output_format);
    match naming_pattern {
        "source-name-date" => format!(
            "{}-{}-{:03}.{}",
            stem,
            current_date_stamp(),
            index,
            output_format
        ),
        _ => format!("{}-{:03}.{}", stem, index, output_format),
    }
}

fn validate_request(request: &SplitImageFileRequest) -> Result<()> {
    if !(1..=10).contains(&request.columns) {
        anyhow::bail!("列数必须在 1 到 10 之间");
    }
    if !(1..=10).contains(&request.rows) {
        anyhow::bail!("行数必须在 1 到 10 之间");
    }
    if request.columns == 1 && request.rows == 1 {
        anyhow::bail!("至少需要分割为 2 个部分");
    }
    if !matches!(
        normalized_format(&request.output_format).as_str(),
        "jpg" | "png" | "webp"
    ) {
        anyhow::bail!("不支持的输出格式: {}", request.output_format);
    }
    Ok(())
}

fn split_grid(image: &DynamicImage, columns: u32, rows: u32) -> Result<Vec<DynamicImage>> {
    let (width, height) = image.dimensions();
    let base_width = width / columns;
    let base_height = height / rows;
    if base_width == 0 || base_height == 0 {
        anyhow::bail!("图片尺寸过小，无法按当前份数分割");
    }

    let mut outputs = Vec::new();
    for row in 0..rows {
        let y = row * base_height;
        let segment_height = if row == rows - 1 {
            height - y
        } else {
            base_height
        };
        for column in 0..columns {
            let x = column * base_width;
            let segment_width = if column == columns - 1 {
                width - x
            } else {
                base_width
            };
            outputs.push(image.crop_imm(x, y, segment_width, segment_height));
        }
    }
    Ok(outputs)
}

fn write_split_outputs(
    source_stem: &str,
    output_directory: &Path,
    request: &SplitImageFileRequest,
    image: &DynamicImage,
    next_index: &mut u32,
    written_count: &mut u32,
    output_paths: &mut Vec<String>,
    skipped_count: &mut u32,
    include_output_paths: bool,
) -> Result<()> {
    for split in split_grid(image, request.columns, request.rows)? {
        let output_path = output_directory.join(output_file_name(
            source_stem,
            &request.naming_pattern,
            &request.output_format,
            *next_index,
        ));
        *next_index += 1;
        if output_path.exists() {
            *skipped_count += 1;
            continue;
        }
        let split = apply_color_mode(split, &request.color_mode);
        write_dynamic_image(
            &output_path,
            &split,
            &request.output_format,
            Some(request.quality),
        )?;
        *written_count += 1;
        if include_output_paths {
            output_paths.push(output_path.to_string_lossy().into_owned());
        }
    }
    Ok(())
}

fn split_image_file_impl(
    request: SplitImageFileRequest,
    resource_dir: Option<PathBuf>,
) -> Result<SplitImageFileResult> {
    validate_request(&request)?;

    let source = PathBuf::from(&request.source_path);
    let output_directory = PathBuf::from(&request.output_directory);
    fs::create_dir_all(&output_directory)
        .with_context(|| format!("无法创建输出目录: {}", output_directory.display()))?;

    let mut output_paths = Vec::new();
    let mut written_count = 0;
    let mut skipped_count = 0;
    let include_output_paths = request.include_output_paths.unwrap_or(true);
    let source_stem = stem(&source);
    let mut next_index = 1;

    if is_supported_image(&source) {
        let image =
            image::open(&source).with_context(|| format!("无法打开图片: {}", source.display()))?;
        write_split_outputs(
            &source_stem,
            &output_directory,
            &request,
            &image,
            &mut next_index,
            &mut written_count,
            &mut output_paths,
            &mut skipped_count,
            include_output_paths,
        )?;
    } else if extension(&source) == "pdf" {
        let mut rendered_count = 0;
        render_pdf_pages_with_callback(
            &source,
            resource_dir.as_deref(),
            &[],
            "standard",
            |rendered_page| {
                rendered_count += 1;
                write_split_outputs(
                    &source_stem,
                    &output_directory,
                    &request,
                    &rendered_page.image,
                    &mut next_index,
                    &mut written_count,
                    &mut output_paths,
                    &mut skipped_count,
                    include_output_paths,
                )
            },
        )?;
        if rendered_count == 0 {
            anyhow::bail!("PDF 没有可分割页面");
        }
    } else {
        anyhow::bail!("不支持的文件类型: {}", extension(&source));
    }

    Ok(SplitImageFileResult {
        split_count: written_count,
        skipped_count,
        output_paths,
    })
}
