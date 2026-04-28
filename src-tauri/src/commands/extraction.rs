use anyhow::{Context, Result};
use image::{codecs::jpeg::JpegEncoder, codecs::png::PngEncoder, ColorType, GenericImageView, ImageEncoder};
use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionDocumentInfo {
    pub source_path: String,
    pub source_name: String,
    pub extension: String,
    pub embedded_image_count: u32,
    pub page_count: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractDocumentImagesRequest {
    pub source_path: String,
    pub output_directory: String,
    pub output_format: String,
    pub naming_pattern: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractDocumentImagesResult {
    pub output_paths: Vec<String>,
    pub extracted_count: u32,
    pub skipped_count: u32,
}

#[tauri::command]
pub fn inspect_extraction_document(path: String) -> Result<ExtractionDocumentInfo, String> {
    inspect_extraction_document_impl(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn extract_document_images(request: ExtractDocumentImagesRequest) -> Result<ExtractDocumentImagesResult, String> {
    extract_document_images_impl(request).map_err(|error| error.to_string())
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase()
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

fn inspect_extraction_document_impl(path: &str) -> Result<ExtractionDocumentInfo> {
    let source = PathBuf::from(path);
    let extension = extension(&source);

    if !matches!(extension.as_str(), "pdf" | "docx" | "jpg" | "jpeg" | "png" | "webp" | "bmp") {
        anyhow::bail!("不支持的文档类型: {extension}");
    }

    Ok(ExtractionDocumentInfo {
        source_path: path.into(),
        source_name: source_name(&source, path),
        extension,
        embedded_image_count: 0,
        page_count: 1,
    })
}

fn write_image_copy(source: &Path, output_path: &Path, output_format: &str) -> Result<()> {
    let image = image::open(source)
        .with_context(|| format!("无法读取嵌入图片: {}", source.display()))?;
    let rgb = image.to_rgb8();
    let (width, height) = image.dimensions();
    let file = fs::File::create(output_path)
        .with_context(|| format!("无法创建输出文件: {}", output_path.display()))?;
    let mut writer = std::io::BufWriter::new(file);

    match output_format {
        "jpg" => JpegEncoder::new_with_quality(&mut writer, 90)
            .encode(&rgb, width, height, ColorType::Rgb8.into())?,
        "png" => PngEncoder::new(&mut writer).write_image(&rgb, width, height, ColorType::Rgb8.into())?,
        other => anyhow::bail!("不支持的输出格式: {other}"),
    }

    Ok(())
}

fn extract_document_images_impl(request: ExtractDocumentImagesRequest) -> Result<ExtractDocumentImagesResult> {
    let source = PathBuf::from(&request.source_path);
    let extension = extension(&source);

    fs::create_dir_all(&request.output_directory)
        .with_context(|| format!("无法创建输出目录: {}", request.output_directory))?;

    let mut output_paths = Vec::new();
    let mut skipped_count = 0;

    if matches!(extension.as_str(), "jpg" | "jpeg" | "png" | "webp" | "bmp") {
        let output_path = Path::new(&request.output_directory)
            .join(format!("{}_{:03}.{}", stem(&source), 1, request.output_format));
        write_image_copy(&source, &output_path, &request.output_format)?;
        output_paths.push(output_path.to_string_lossy().into_owned());
    } else if matches!(extension.as_str(), "pdf" | "docx") {
        skipped_count = 0;
    } else {
        anyhow::bail!("不支持的文档类型: {extension}");
    }

    Ok(ExtractDocumentImagesResult {
        extracted_count: output_paths.len() as u32,
        skipped_count,
        output_paths,
    })
}
