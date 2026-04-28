use anyhow::{Context, Result};
use image::{
    codecs::jpeg::JpegEncoder, codecs::png::PngEncoder, codecs::webp::WebPEncoder, ColorType,
    DynamicImage, GenericImageView, ImageEncoder,
};
use pdfium_render::prelude::*;
use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}, process::Command};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub extension: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentMetadata {
    pub page_count: u32,
    pub extension: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectConversionFileResult {
    pub kind: String,
    pub source_path: String,
    pub source_name: String,
    pub image_metadata: Option<ImageMetadata>,
    pub document_metadata: Option<DocumentMetadata>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertImageFileRequest {
    pub source_path: String,
    pub output_path: String,
    pub output_format: String,
    pub color_mode: String,
    pub quality: Option<u8>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderDocumentToImagesRequest {
    pub source_path: String,
    pub output_directory: String,
    pub output_format: String,
    pub color_mode: String,
    pub page_numbers: Vec<u32>,
    pub render_density: String,
    pub naming_pattern: String,
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase()
}

fn is_image(path: &Path) -> bool {
    matches!(extension(path).as_str(), "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif")
}

fn is_document(path: &Path) -> bool {
    matches!(extension(path).as_str(), "pdf" | "docx")
}

#[tauri::command]
pub fn inspect_conversion_file(path: String) -> Result<InspectConversionFileResult, String> {
    inspect_conversion_file_impl(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn inspect_conversion_directory(path: String) -> Result<Vec<InspectConversionFileResult>, String> {
    inspect_conversion_directory_impl(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn convert_image_file(request: ConvertImageFileRequest) -> Result<Vec<String>, String> {
    convert_image_file_impl(request).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn render_document_to_images(request: RenderDocumentToImagesRequest) -> Result<Vec<String>, String> {
    render_document_to_images_impl(request).map_err(|error| error.to_string())
}

fn inspect_conversion_file_impl(path: &str) -> Result<InspectConversionFileResult> {
    let source = PathBuf::from(path);
    let source_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_string();

    if is_image(&source) {
        let image = image::open(&source).with_context(|| format!("无法打开图片: {path}"))?;
        let (width, height) = image.dimensions();
        return Ok(InspectConversionFileResult {
            kind: "image".into(),
            source_path: path.into(),
            source_name,
            image_metadata: Some(ImageMetadata {
                width,
                height,
                extension: extension(&source),
            }),
            document_metadata: None,
            error_message: None,
        });
    }

    if is_document(&source) {
        return Ok(InspectConversionFileResult {
            kind: "document".into(),
            source_path: path.into(),
            source_name,
            image_metadata: None,
            document_metadata: Some(DocumentMetadata {
                page_count: 1,
                extension: extension(&source),
            }),
            error_message: None,
        });
    }

    Ok(InspectConversionFileResult {
        kind: "unsupported".into(),
        source_path: path.into(),
        source_name,
        image_metadata: None,
        document_metadata: None,
        error_message: Some("不支持的文件类型".into()),
    })
}

fn inspect_conversion_directory_impl(path: &str) -> Result<Vec<InspectConversionFileResult>> {
    let mut items = WalkDir::new(path)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| is_image(entry.path()) || is_document(entry.path()))
        .map(|entry| inspect_conversion_file_impl(&entry.path().to_string_lossy()))
        .collect::<Result<Vec<_>>>()?;

    items.sort_by(|left, right| left.source_name.cmp(&right.source_name));
    Ok(items)
}

fn apply_color_mode(image: DynamicImage, color_mode: &str) -> DynamicImage {
    match color_mode {
        "gray-cmyk" => DynamicImage::ImageLuma8(image.grayscale().to_luma8()),
        _ => DynamicImage::ImageRgb8(image.to_rgb8()),
    }
}

fn convert_image_file_impl(request: ConvertImageFileRequest) -> Result<Vec<String>> {
    let source = image::open(&request.source_path)
        .with_context(|| format!("无法打开图片: {}", request.source_path))?;
    let output = apply_color_mode(source, &request.color_mode);
    let output_path = PathBuf::from(&request.output_path);

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("无法创建输出目录: {}", parent.display()))?;
    }

    let file = fs::File::create(&output_path)
        .with_context(|| format!("无法创建输出文件: {}", output_path.display()))?;
    let mut writer = std::io::BufWriter::new(file);
    let rgb = output.to_rgb8();
    let (width, height) = rgb.dimensions();

    match request.output_format.as_str() {
        "jpg" => JpegEncoder::new_with_quality(&mut writer, request.quality.unwrap_or(90))
            .encode(&rgb, width, height, ColorType::Rgb8.into())?,
        "png" => PngEncoder::new(&mut writer).write_image(&rgb, width, height, ColorType::Rgb8.into())?,
        "webp" => WebPEncoder::new_lossless(&mut writer).encode(&rgb, width, height, ColorType::Rgb8.into())?,
        other => anyhow::bail!("不支持的输出格式: {other}"),
    }

    Ok(vec![output_path.to_string_lossy().into_owned()])
}

fn soffice_executable() -> Result<String> {
    if Command::new("soffice").arg("--version").output().is_ok() {
        Ok("soffice".into())
    } else {
        anyhow::bail!("DOCX_RENDERER_NOT_AVAILABLE: soffice 未安装或不在 PATH 中")
    }
}

fn bind_pdfium() -> Result<Pdfium> {
    let bindings = Pdfium::bind_to_system_library()
        .map_err(|_| anyhow::anyhow!("PDF_RENDERER_NOT_AVAILABLE: 未找到 PDFium 运行库"))?;
    Ok(Pdfium::new(bindings))
}

fn docx_to_pdf(source_path: &str, work_dir: &Path) -> Result<PathBuf> {
    let soffice = soffice_executable()?;
    let status = Command::new(soffice)
        .args(["--headless", "--convert-to", "pdf", "--outdir"])
        .arg(work_dir)
        .arg(source_path)
        .status()
        .context("无法启动 soffice")?;

    if !status.success() {
        anyhow::bail!("无法转换 Word 文档为 PDF");
    }

    let stem = Path::new(source_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .context("无法读取 Word 文件名")?;
    Ok(work_dir.join(stem).with_extension("pdf"))
}

fn write_dynamic_image(output_path: &Path, image: DynamicImage, output_format: &str, quality: Option<u8>) -> Result<()> {
    let file = fs::File::create(output_path)
        .with_context(|| format!("无法创建输出文件: {}", output_path.display()))?;
    let mut writer = std::io::BufWriter::new(file);
    let rgb = image.to_rgb8();
    let (width, height) = rgb.dimensions();

    match output_format {
        "jpg" => JpegEncoder::new_with_quality(&mut writer, quality.unwrap_or(90))
            .encode(&rgb, width, height, ColorType::Rgb8.into())?,
        "png" => PngEncoder::new(&mut writer).write_image(&rgb, width, height, ColorType::Rgb8.into())?,
        "webp" => WebPEncoder::new_lossless(&mut writer).encode(&rgb, width, height, ColorType::Rgb8.into())?,
        other => anyhow::bail!("不支持的输出格式: {other}"),
    }

    Ok(())
}

fn render_document_to_images_impl(request: RenderDocumentToImagesRequest) -> Result<Vec<String>> {
    let source = PathBuf::from(&request.source_path);
    let temp_dir = tempfile::tempdir()?;
    let render_source = match extension(&source).as_str() {
        "pdf" => source.clone(),
        "docx" => docx_to_pdf(&request.source_path, temp_dir.path())?,
        other => anyhow::bail!("不支持的文档类型: {other}"),
    };

    let pdfium = bind_pdfium()?;
    let document = pdfium
        .load_pdf_from_file(&render_source, None)
        .context("无法渲染 PDF 文档")?;
    fs::create_dir_all(&request.output_directory)
        .with_context(|| format!("无法创建输出目录: {}", request.output_directory))?;

    let mut output_paths = Vec::new();
    let stem = Path::new(&request.source_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("output");

    let single_page = request.page_numbers.len() == 1;

    for page_number in request.page_numbers {
        let page_index = page_number.checked_sub(1).context("页码必须从 1 开始")? as u16;
        let page = document.pages().get(page_index)?;
        let bitmap = page.render_with_config(
            &PdfRenderConfig::new().set_target_width(if request.render_density == "high" { 2480 } else { 1240 })
        )?;
        let image = DynamicImage::ImageRgb8(bitmap.as_image().to_rgb8());
        let image = apply_color_mode(image, &request.color_mode);
        let file_name = match request.naming_pattern.as_str() {
            "source-name" if single_page => format!("{}.{}", stem, request.output_format),
            _ => format!("{}_{:03}.{}", stem, page_number, request.output_format),
        };
        let output_path = Path::new(&request.output_directory).join(file_name);
        write_dynamic_image(&output_path, image, &request.output_format, Some(90))?;
        output_paths.push(output_path.to_string_lossy().into_owned());
    }

    Ok(output_paths)
}
