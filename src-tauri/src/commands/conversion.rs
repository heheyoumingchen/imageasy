use super::{
    common::{apply_color_mode, current_date_stamp, extension, normalized_format, write_dynamic_image},
    pdf_rendering::render_pdf_pages,
};
use anyhow::{Context, Result};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::Manager;
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

fn output_format_extension(output_format: &str) -> String {
    match normalized_format(output_format).as_str() {
        "jpg" => "jpg".to_string(),
        "png" => "png".to_string(),
        "webp" => "webp".to_string(),
        other => other.to_string(),
    }
}

fn is_image(path: &Path) -> bool {
    matches!(extension(path).as_str(), "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif")
}

fn is_document(path: &Path) -> bool {
    matches!(extension(path).as_str(), "pdf" | "docx")
}

fn dated_name(stem: &str, index: u32, output_format: &str) -> String {
    format!("{}-{}-{:03}.{}", stem, current_date_stamp(), index, output_format_extension(output_format))
}

fn indexed_name(stem: &str, index: u32, output_format: &str) -> String {
    format!("{}-{:03}.{}", stem, index, output_format_extension(output_format))
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
pub fn render_document_to_images(
    app: tauri::AppHandle,
    request: RenderDocumentToImagesRequest,
) -> Result<Vec<String>, String> {
    let resource_dir = app.path().resource_dir().ok();
    render_document_to_images_impl(request, resource_dir).map_err(|error| error.to_string())
}

fn inspect_conversion_file_impl(path: &str) -> Result<InspectConversionFileResult> {
    let source = PathBuf::from(path);
    let source_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_string();

    if is_image(&source) {
        // 仅读取图片头部获取尺寸，避免导入检查阶段全量解码，显著提升导入速度。
        let (width, height) = image::ImageReader::open(&source)
            .with_context(|| format!("无法打开图片: {path}"))?
            .into_dimensions()
            .with_context(|| format!("无法读取图片尺寸: {path}"))?;
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
    // 先收集候选文件路径，再用 rayon 并行检查，加速大目录导入。
    let candidates: Vec<PathBuf> = WalkDir::new(path)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| is_image(entry.path()) || is_document(entry.path()))
        .map(|entry| entry.into_path())
        .collect();

    let mut items = candidates
        .par_iter()
        .map(|candidate| inspect_conversion_file_impl(&candidate.to_string_lossy()))
        .collect::<Result<Vec<_>>>()?;

    items.sort_by(|left, right| left.source_name.cmp(&right.source_name));
    Ok(items)
}

fn convert_image_file_impl(request: ConvertImageFileRequest) -> Result<Vec<String>> {
    let source = image::open(&request.source_path)
        .with_context(|| format!("无法打开图片: {}", request.source_path))?;
    let output = apply_color_mode(source, &request.color_mode);
    let requested_output_format = normalized_format(&request.output_format);
    let output_path = PathBuf::from(&request.output_path);

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("无法创建输出目录: {}", parent.display()))?;
    }

    let actual_output_path = output_path.with_extension(output_format_extension(&requested_output_format));
    write_dynamic_image(&actual_output_path, &output, &requested_output_format, request.quality)?;

    Ok(vec![actual_output_path.to_string_lossy().into_owned()])
}

fn soffice_executable() -> Result<String> {
    if Command::new("soffice").arg("--version").output().is_ok() {
        Ok("soffice".into())
    } else {
        anyhow::bail!("DOCX_RENDERER_NOT_AVAILABLE: soffice 未安装或不在 PATH 中")
    }
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

fn render_document_to_images_impl(
    request: RenderDocumentToImagesRequest,
    resource_dir: Option<PathBuf>,
) -> Result<Vec<String>> {
    let source = PathBuf::from(&request.source_path);
    let temp_dir = tempfile::tempdir()?;
    let render_source = match extension(&source).as_str() {
        "pdf" => source.clone(),
        "docx" => docx_to_pdf(&request.source_path, temp_dir.path())?,
        other => anyhow::bail!("不支持的文档类型: {other}"),
    };

    fs::create_dir_all(&request.output_directory)
        .with_context(|| format!("无法创建输出目录: {}", request.output_directory))?;

    let pages = render_pdf_pages(
        &render_source,
        resource_dir.as_deref(),
        &request.page_numbers,
        &request.render_density,
    )?;
    let mut output_paths = Vec::new();
    let stem = Path::new(&request.source_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("output");

    for rendered_page in pages {
        let page_number = rendered_page.page_number;
        let image = apply_color_mode(rendered_page.image, &request.color_mode);
        let file_name = match request.naming_pattern.as_str() {
            "source-name-date" => dated_name(stem, page_number, &request.output_format),
            _ => indexed_name(stem, page_number, &request.output_format),
        };
        let output_path = Path::new(&request.output_directory).join(file_name);
        if output_path.exists() {
            continue;
        }
        write_dynamic_image(&output_path, &image, &request.output_format, Some(90))?;
        output_paths.push(output_path.to_string_lossy().into_owned());
    }

    Ok(output_paths)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use image::{codecs::jpeg::JpegEncoder, ColorType, ImageBuffer, Rgb};
    use tempfile::tempdir;

    use super::{current_date_stamp, dated_name, render_document_to_images_impl, RenderDocumentToImagesRequest};

    #[test]
    fn dated_name_appends_index_suffix() {
        assert_eq!(dated_name("demo", 2, "jpg"), format!("demo-{}-002.jpg", current_date_stamp()));
    }

    #[test]
    fn render_document_to_images_rejects_missing_docx_runtime_with_clear_error() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("demo.docx");
        fs::write(&source, b"fake-docx").unwrap();

        let error = render_document_to_images_impl(
            RenderDocumentToImagesRequest {
                source_path: source.to_string_lossy().into_owned(),
                output_directory: dir.path().join("out").to_string_lossy().into_owned(),
                output_format: "jpg".into(),
                color_mode: "rgb".into(),
                page_numbers: vec![1],
                render_density: "standard".into(),
                naming_pattern: "source-name-index".into(),
            },
            None,
        )
        .unwrap_err();

        assert!(error.to_string().contains("DOCX_RENDERER_NOT_AVAILABLE") || error.to_string().contains("无法转换 Word 文档"));
    }

    #[test]
    fn render_document_to_images_reports_attempted_pdfium_locations() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("demo.pdf");
        fs::write(&source, b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF").unwrap();

        let error = render_document_to_images_impl(
            RenderDocumentToImagesRequest {
                source_path: source.to_string_lossy().into_owned(),
                output_directory: dir.path().join("out").to_string_lossy().into_owned(),
                output_format: "jpg".into(),
                color_mode: "rgb".into(),
                page_numbers: vec![1],
                render_density: "standard".into(),
                naming_pattern: "source-name-index".into(),
            },
            None,
        )
        .unwrap_err();

        let error = error.to_string();
        assert!(error.contains("PDF_RENDERER_NOT_AVAILABLE"));
        assert!(error.contains("尝试位置") || error.contains("attempted"));
    }

    #[test]
    fn render_document_to_images_rejects_missing_pdf_runtime_with_clear_error() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("demo.pdf");
        fs::write(&source, b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF").unwrap();

        let error = render_document_to_images_impl(
            RenderDocumentToImagesRequest {
                source_path: source.to_string_lossy().into_owned(),
                output_directory: dir.path().join("out").to_string_lossy().into_owned(),
                output_format: "jpg".into(),
                color_mode: "rgb".into(),
                page_numbers: vec![1],
                render_density: "standard".into(),
                naming_pattern: "source-name-index".into(),
            },
            None,
        )
        .unwrap_err();

        let error = error.to_string();
        assert!(error.contains("PDF_RENDERER_NOT_AVAILABLE") || error.contains("无法渲染 PDF 文档"));
    }

    #[test]
    fn can_encode_minimal_jpeg_for_conversion_tests() {
        let image = ImageBuffer::<Rgb<u8>, _>::from_pixel(1, 1, Rgb([1, 2, 3]));
        let mut bytes = Vec::new();
        let mut writer = std::io::BufWriter::new(&mut bytes);
        JpegEncoder::new_with_quality(&mut writer, 90)
            .encode(image.as_raw(), 1, 1, ColorType::Rgb8.into())
            .unwrap();
        drop(writer);

        assert!(!bytes.is_empty());
    }
}
