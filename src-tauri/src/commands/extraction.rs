use super::{
    cancellation::{self, TaskGuard},
    common::{
        apply_color_mode, current_date_stamp, extension, normalized_format, write_atomically,
        write_dynamic_image,
    },
    path_guard::{ensure_output_directory, require_existing_file},
};
use anyhow::{Context, Result};
use image::DynamicImage;
use jpeg_decoder;
use lopdf::{
    Dictionary as LoDictionary, Document as LoDocument, Object as LoObject, ObjectId,
    Stream as LoStream,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeSet,
    fs,
    io::Read,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;
use zip::ZipArchive;

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
    pub color_mode: String,
    pub quality: u8,
    pub naming_pattern: String,
    #[serde(default)]
    pub include_output_paths: Option<bool>,
    /// 批次取消令牌 id；缺省表示不可取消。
    #[serde(default)]
    pub task_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractDocumentImagesResult {
    pub output_paths: Vec<String>,
    pub extracted_count: u32,
    pub skipped_count: u32,
}

#[derive(Debug, Clone)]
struct PdfImageEntry {
    object_id: ObjectId,
    index: u32,
}

#[derive(Debug, Clone)]
struct PdfInspectionInfo {
    page_count: u32,
    embedded_image_count: u32,
}

#[derive(Debug)]
enum PdfImageOutput {
    OriginalBytes {
        bytes: Vec<u8>,
        output_format: String,
    },
    DecodedImage(DynamicImage),
}

#[tauri::command]
pub async fn inspect_extraction_document(path: String) -> Result<ExtractionDocumentInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        inspect_extraction_document_impl(&path).map_err(crate::commands::error_message::to_user_error_string)
    })
    .await
    .map_err(crate::commands::error_message::to_user_error_string)?
}

#[tauri::command]
pub async fn inspect_extraction_directory(
    path: String,
) -> Result<Vec<ExtractionDocumentInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        inspect_extraction_directory_impl(&path).map_err(crate::commands::error_message::to_user_error_string)
    })
    .await
    .map_err(crate::commands::error_message::to_user_error_string)?
}

#[tauri::command]
pub async fn extract_document_images(
    request: ExtractDocumentImagesRequest,
) -> Result<ExtractDocumentImagesResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        extract_document_images_impl(request).map_err(crate::commands::error_message::to_user_error_string)
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
        .unwrap_or("output")
        .to_string()
}

fn resolve_dictionary<'a>(
    document: &'a LoDocument,
    object: &'a LoObject,
) -> Result<&'a LoDictionary> {
    match object {
        LoObject::Dictionary(dictionary) => Ok(dictionary),
        LoObject::Reference(object_id) => document
            .get_object(*object_id)
            .with_context(|| format!("无法读取 PDF 对象: {object_id:?}"))?
            .as_dict()
            .context("PDF 对象不是字典"),
        _ => anyhow::bail!("PDF 对象不是字典"),
    }
}

fn resolve_stream(document: &LoDocument, object_id: ObjectId) -> Result<&LoStream> {
    document
        .get_object(object_id)
        .with_context(|| format!("无法读取 PDF 图片对象: {object_id:?}"))?
        .as_stream()
        .context("PDF 图片对象不是流")
}

fn image_filter_name(stream: &LoStream) -> Option<&[u8]> {
    match stream.dict.get(b"Filter").ok() {
        Some(LoObject::Name(name)) => Some(name.as_slice()),
        Some(LoObject::Array(items)) if items.len() == 1 => items[0].as_name().ok(),
        _ => None,
    }
}

fn pdf_image_dimensions(stream: &LoStream) -> Result<(u32, u32)> {
    let width = stream
        .dict
        .get(b"Width")
        .context("PDF 图片缺少 Width")?
        .as_i64()? as u32;
    let height = stream
        .dict
        .get(b"Height")
        .context("PDF 图片缺少 Height")?
        .as_i64()? as u32;
    Ok((width, height))
}

fn pdf_image_color_space_name(stream: &LoStream) -> Option<&[u8]> {
    match stream.dict.get(b"ColorSpace").ok() {
        Some(LoObject::Name(name)) => Some(name.as_slice()),
        Some(LoObject::Array(items)) if !items.is_empty() => items[0].as_name().ok(),
        _ => None,
    }
}

fn inspect_pdf_document(
    path: &Path,
) -> Result<(LoDocument, PdfInspectionInfo, Vec<PdfImageEntry>)> {
    let document =
        LoDocument::load(path).with_context(|| format!("无法读取 PDF 文档: {}", path.display()))?;
    let pages = document.get_pages();
    let mut seen = BTreeSet::new();
    let mut images = Vec::new();

    for page_id in pages.values() {
        let (resources, _) = document
            .get_page_resources(*page_id)
            .with_context(|| format!("无法读取 PDF 页面资源: {}", path.display()))?;
        let Some(resources) = resources else {
            continue;
        };
        let Ok(xobjects) = resources.get(b"XObject") else {
            continue;
        };
        let dictionary = resolve_dictionary(&document, xobjects)?;

        for (_, object) in dictionary.iter() {
            let Ok(object_id) = object.as_reference() else {
                continue;
            };
            if !seen.insert(object_id) {
                continue;
            }
            let Ok(stream) = resolve_stream(&document, object_id) else {
                continue;
            };
            if stream.dict.get(b"Subtype").and_then(LoObject::as_name).ok() == Some(b"Image") {
                images.push(PdfImageEntry {
                    object_id,
                    index: images.len() as u32 + 1,
                });
            }
        }
    }

    let info = PdfInspectionInfo {
        page_count: pages.len() as u32,
        embedded_image_count: images.len() as u32,
    };

    Ok((document, info, images))
}

fn inspect_extraction_document_impl(path: &str) -> Result<ExtractionDocumentInfo> {
    let source = PathBuf::from(path);
    let extension = extension(&source);

    if !matches!(
        extension.as_str(),
        "pdf" | "docx" | "pptx" | "jpg" | "jpeg" | "png" | "webp" | "bmp"
    ) {
        anyhow::bail!("不支持的文档类型: {extension}");
    }

    let (embedded_image_count, page_count) = if extension == "pdf" {
        let (_document, info, _images) = inspect_pdf_document(&source)?;
        (info.embedded_image_count, info.page_count)
    } else if extension == "pptx" {
        // 损坏或非法的 Office 文件预估为 0 张，不阻断整个目录扫描。
        (
            count_images_in_office_zip(&source, "ppt/media/").unwrap_or(0),
            1,
        )
    } else if extension == "docx" {
        (
            count_images_in_office_zip(&source, "word/media/").unwrap_or(0),
            1,
        )
    } else {
        (0, 1)
    };

    Ok(ExtractionDocumentInfo {
        source_path: path.into(),
        source_name: source_name(&source, path),
        extension,
        embedded_image_count,
        page_count,
    })
}

fn inspect_extraction_directory_impl(path: &str) -> Result<Vec<ExtractionDocumentInfo>> {
    let mut items = WalkDir::new(path)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| {
            matches!(
                extension(entry.path()).as_str(),
                "pdf" | "docx" | "pptx" | "jpg" | "jpeg" | "png" | "webp" | "bmp"
            )
        })
        .map(|entry| inspect_extraction_document_impl(&entry.path().to_string_lossy()))
        .collect::<Result<Vec<_>>>()?;

    items.sort_by(|left, right| left.source_name.cmp(&right.source_name));
    Ok(items)
}

fn output_file_name(stem: &str, naming_pattern: &str, output_format: &str, index: u32) -> String {
    let output_format = normalized_format(output_format);
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

fn record_written_output(
    output_paths: &mut Vec<String>,
    extracted_count: &mut u32,
    output_path: &Path,
    include_output_paths: bool,
) {
    *extracted_count += 1;
    if include_output_paths {
        output_paths.push(output_path.to_string_lossy().into_owned());
    }
}

fn write_image_copy(
    source: &Path,
    output_path: &Path,
    output_format: &str,
    color_mode: &str,
    quality: u8,
) -> Result<()> {
    let image =
        image::open(source).with_context(|| format!("无法读取嵌入图片: {}", source.display()))?;
    let image = apply_color_mode(image, color_mode);
    write_dynamic_image(output_path, &image, output_format, Some(quality), color_mode)
}

/// Office media 中当前解码链路可提取的栅格扩展名；矢量/专有格式（emf/wmf/svg/wdp 等）不计预计数。
fn is_extractable_office_media(name: &str) -> bool {
    matches!(
        Path::new(name)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp"
    )
}

fn office_media_format(name: &str) -> String {
    normalized_format(
        Path::new(name)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default(),
    )
}

fn extract_images_from_office_zip(
    path: &Path,
    media_prefix: &str,
) -> Result<Vec<(String, Vec<u8>)>> {
    let file = fs::File::open(path)
        .with_context(|| format!("无法读取 Office 文档: {}", path.display()))?;
    let mut archive = ZipArchive::new(file).context("无法打开 Office 压缩包")?;
    let mut images = Vec::new();

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).context("无法读取 Office 内容")?;
        let name = entry.name().to_string();
        if !name.starts_with(media_prefix) || entry.is_dir() {
            continue;
        }
        let mut bytes = Vec::new();
        entry
            .read_to_end(&mut bytes)
            .context("无法读取 Office 内嵌图片")?;
        images.push((name, bytes));
    }

    Ok(images)
}

// 只统计可提取 media 条目数量，不读取图片内容，供导入检查阶段快速预估。
fn count_images_in_office_zip(path: &Path, media_prefix: &str) -> Result<u32> {
    let file = fs::File::open(path)
        .with_context(|| format!("无法读取 Office 文档: {}", path.display()))?;
    let archive = ZipArchive::new(file).context("无法打开 Office 压缩包")?;
    let count = archive
        .file_names()
        .filter(|name| {
            name.starts_with(media_prefix)
                && !name.ends_with('/')
                && is_extractable_office_media(name)
        })
        .count();
    Ok(count as u32)
}

fn write_original_bytes(output_path: &Path, bytes: &[u8]) -> Result<()> {
    write_atomically(output_path, |writer| {
        std::io::Write::write_all(writer, bytes)
            .with_context(|| format!("无法写入提取后的原始图片: {}", output_path.display()))?;
        Ok(())
    })
}

fn extract_images_from_docx(path: &Path) -> Result<Vec<(String, Vec<u8>)>> {
    extract_images_from_office_zip(path, "word/media/")
}

fn extract_images_from_pptx(path: &Path) -> Result<Vec<(String, Vec<u8>)>> {
    extract_images_from_office_zip(path, "ppt/media/")
}

fn decode_pdf_cmyk_jpeg(bytes: &[u8]) -> Result<DynamicImage> {
    let mut decoder = jpeg_decoder::Decoder::new(bytes);
    let pixels = decoder.decode().context("无法解码 CMYK JPEG")?;
    let info = decoder.info().context("CMYK JPEG 元信息缺失")?;
    let width = info.width as u32;
    let height = info.height as u32;

    let mut rgb_buf = Vec::with_capacity((width as usize) * (height as usize) * 3);
    for chunk in pixels.chunks_exact(4) {
        let c = chunk[0] as u32;
        let m = chunk[1] as u32;
        let y = chunk[2] as u32;
        let k = chunk[3] as u32;
        rgb_buf.push((c * k / 255) as u8);
        rgb_buf.push((m * k / 255) as u8);
        rgb_buf.push((y * k / 255) as u8);
    }

    image::ImageBuffer::from_raw(width, height, rgb_buf)
        .map(DynamicImage::ImageRgb8)
        .context("无法构建 CMYK→RGB 图片缓冲")
}

fn extract_pdf_image_output(
    document: &LoDocument,
    entry: &PdfImageEntry,
) -> Result<PdfImageOutput> {
    let stream = resolve_stream(document, entry.object_id)?;

    match image_filter_name(stream) {
        Some(b"DCTDecode") if pdf_image_color_space_name(stream) == Some(b"DeviceCMYK") => {
            let image = decode_pdf_cmyk_jpeg(&stream.content)?;
            Ok(PdfImageOutput::DecodedImage(image))
        }
        Some(b"DCTDecode") => Ok(PdfImageOutput::OriginalBytes {
            bytes: stream.content.clone(),
            output_format: "jpg".into(),
        }),
        Some(b"JPXDecode") => Ok(PdfImageOutput::OriginalBytes {
            bytes: stream.content.clone(),
            output_format: "png".into(),
        }),
        _ => {
            let decoded = stream
                .decompressed_content()
                .context("无法解压 PDF 图片流")?;
            let (width, height) = pdf_image_dimensions(stream)?;
            let image = match pdf_image_color_space_name(stream) {
                Some(b"DeviceGray") => DynamicImage::ImageLuma8(
                    image::ImageBuffer::from_raw(width, height, decoded)
                        .context("无法构建灰度 PDF 图片")?,
                ),
                Some(b"DeviceCMYK") => {
                    let pixel_count = (width * height) as usize;
                    let mut rgb_buf = Vec::with_capacity(pixel_count * 3);
                    for chunk in decoded.chunks_exact(4) {
                        let (c, m, y, k) = (
                            chunk[0] as u16,
                            chunk[1] as u16,
                            chunk[2] as u16,
                            chunk[3] as u16,
                        );
                        let r = ((255 - c) * (255 - k) / 255) as u8;
                        let g = ((255 - m) * (255 - k) / 255) as u8;
                        let b = ((255 - y) * (255 - k) / 255) as u8;
                        rgb_buf.push(r);
                        rgb_buf.push(g);
                        rgb_buf.push(b);
                    }
                    DynamicImage::ImageRgb8(
                        image::ImageBuffer::from_raw(width, height, rgb_buf)
                            .context("无法构建 CMYK→RGB PDF 图片")?,
                    )
                }
                Some(b"DeviceRGB") | None => DynamicImage::ImageRgb8(
                    image::ImageBuffer::from_raw(width, height, decoded)
                        .context("无法构建 RGB PDF 图片")?,
                ),
                Some(other) => anyhow::bail!(
                    "暂不支持的 PDF 图片色彩空间: {}",
                    String::from_utf8_lossy(other)
                ),
            };
            Ok(PdfImageOutput::DecodedImage(image))
        }
    }
}

fn write_pdf_image_output(
    output_path: &Path,
    pdf_output: PdfImageOutput,
    requested_format: &str,
    color_mode: &str,
    quality: u8,
) -> Result<()> {
    match pdf_output {
        PdfImageOutput::OriginalBytes {
            bytes,
            ref output_format,
        } if normalized_format(output_format) == normalized_format(requested_format)
            && color_mode == "rgb" =>
        {
            fs::write(output_path, bytes)
                .with_context(|| format!("无法写入提取后的 PDF 图片: {}", output_path.display()))?;
            Ok(())
        }
        PdfImageOutput::OriginalBytes { bytes, .. } => {
            let image = image::load_from_memory(&bytes).context("无法读取原始 PDF 图片流")?;
            let image = apply_color_mode(image, color_mode);
            write_dynamic_image(output_path, &image, requested_format, Some(quality), color_mode)
        }
        PdfImageOutput::DecodedImage(image) => {
            let image = apply_color_mode(image, color_mode);
            write_dynamic_image(output_path, &image, requested_format, Some(quality), color_mode)
        }
    }
}

fn extract_document_images_impl(
    request: ExtractDocumentImagesRequest,
) -> Result<ExtractDocumentImagesResult> {
    let _guard = TaskGuard::new(request.task_id.clone());
    let token = cancellation::token_for(request.task_id.as_deref());
    cancellation::check_optional(token.as_ref())?;

    let source = require_existing_file(Path::new(&request.source_path))?;
    let extension = extension(&source);

    let output_directory = ensure_output_directory(Path::new(&request.output_directory))?;

    let mut output_paths = Vec::new();
    let mut extracted_count = 0;
    let mut skipped_count = 0;
    let include_output_paths = request.include_output_paths.unwrap_or(true);

    if matches!(extension.as_str(), "jpg" | "jpeg" | "png" | "webp" | "bmp") {
        cancellation::check_optional(token.as_ref())?;
        let output_path = output_directory.join(output_file_name(
            &stem(&source),
            &request.naming_pattern,
            &request.output_format,
            1,
        ));
        // 目标已存在时仍计入完成数，避免重复提取时“目录有文件、界面完成数偏少”。
        if !output_path.exists() {
            write_image_copy(
                &source,
                &output_path,
                &request.output_format,
                &request.color_mode,
                request.quality,
            )?;
        }
        record_written_output(
            &mut output_paths,
            &mut extracted_count,
            &output_path,
            include_output_paths,
        );
    } else if extension.as_str() == "pdf" {
        let (document, _info, images) = inspect_pdf_document(&source)?;
        for entry in images {
            cancellation::check_optional(token.as_ref())?;
            let output_path = output_directory.join(output_file_name(
                &stem(&source),
                &request.naming_pattern,
                &request.output_format,
                entry.index,
            ));
            if !output_path.exists() {
                let pdf_output = extract_pdf_image_output(&document, &entry)
                    .with_context(|| format!("无法提取 PDF 内嵌图片 #{}", entry.index))?;
                write_pdf_image_output(
                    &output_path,
                    pdf_output,
                    &request.output_format,
                    &request.color_mode,
                    request.quality,
                )?;
            }
            record_written_output(
                &mut output_paths,
                &mut extracted_count,
                &output_path,
                include_output_paths,
            );
        }
    } else if matches!(extension.as_str(), "docx" | "pptx") {
        let images = if extension == "pptx" {
            extract_images_from_pptx(&source)?
        } else {
            extract_images_from_docx(&source)?
        };
        // 输出序号只给成功落盘/已存在的可提取媒体递增。
        let mut extractable_index = 0u32;
        for (name, bytes) in images {
            cancellation::check_optional(token.as_ref())?;
            if !is_extractable_office_media(&name) {
                skipped_count += 1;
                continue;
            }
            let next_index = extractable_index + 1;
            let media_format = office_media_format(&name);
            let output_path = output_directory.join(output_file_name(
                &stem(&source),
                &request.naming_pattern,
                &request.output_format,
                next_index,
            ));
            if output_path.exists() {
                extractable_index = next_index;
                record_written_output(
                    &mut output_paths,
                    &mut extracted_count,
                    &output_path,
                    include_output_paths,
                );
                continue;
            }

            let wrote = if request.color_mode == "rgb"
                && media_format == normalized_format(&request.output_format)
            {
                // RGB 且格式一致时直写原始字节，避免无意义的解码再编码。
                write_original_bytes(&output_path, &bytes)?;
                true
            } else {
                match image::load_from_memory(&bytes) {
                    Ok(image) => {
                        let image = apply_color_mode(image, &request.color_mode);
                        write_dynamic_image(
                            &output_path,
                            &image,
                            &request.output_format,
                            Some(request.quality),
                            &request.color_mode,
                        )?;
                        true
                    }
                    Err(_) => {
                        skipped_count += 1;
                        false
                    }
                }
            };

            if wrote {
                extractable_index = next_index;
                record_written_output(
                    &mut output_paths,
                    &mut extracted_count,
                    &output_path,
                    include_output_paths,
                );
            }
        }
    } else {
        anyhow::bail!("不支持的文档类型: {extension}");
    }

    Ok(ExtractDocumentImagesResult {
        extracted_count,
        skipped_count,
        output_paths,
    })
}
