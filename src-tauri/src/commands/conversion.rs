use super::{
    cancellation::{self, CancellationToken, TaskGuard},
    common::{
        apply_color_mode, copy_file_atomically, current_date_stamp, extension, normalized_format,
        write_dynamic_image,
    },
    image_codec::{
        decode_jpeg, estimate_conversion_memory, plan_image_conversion, read_jpeg_info,
        ImageConversionOperation, ImageConversionPlan, SourceImageInfo, SourcePixelFormat,
    },
    memory_budget::process_memory_budget,
    path_guard::{ensure_output_directory, ensure_output_file_path, require_existing_file},
    pdf_rendering::{
        count_pdf_pages, render_pdf_document_with_callback_cancellable, BitmapOutputFormat,
        RenderedPdfPage,
    },
};
use crate::document_renderer::coordinator::{
    prepare_document, HelperOfficeRenderer, OfficeRenderer, PreparedDocument,
};
use crate::document_renderer::error::{CommandError, CommandErrorCode, RendererStage};
use crate::document_renderer::timing::log_stage_timing;
use anyhow::{Context, Result};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    time::Instant,
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
    /// PDF 探测真实页数；Office（doc/docx/wps）导入不启动 Office，页数未知为 None。
    pub page_count: Option<u32>,
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
    /// 仅当前端批次覆盖确认通过时为 true；后端据此授权“输出即源文件”的原地重编码。
    #[serde(default)]
    pub allow_source_overwrite: bool,
    /// 批次取消令牌 id；缺省表示不可取消。
    #[serde(default)]
    pub task_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderDocumentToImagesRequest {
    pub source_path: String,
    pub output_directory: String,
    pub output_format: String,
    pub color_mode: String,
    pub quality: u8,
    pub page_numbers: Vec<u32>,
    pub render_density: String,
    pub naming_pattern: String,
    /// 批次取消令牌 id；缺省表示不可取消。
    #[serde(default)]
    pub task_id: Option<String>,
}

#[derive(Debug)]
pub struct DocumentRenderJob {
    request: RenderDocumentToImagesRequest,
    prepared: PreparedDocument,
    bitmap_output_format: BitmapOutputFormat,
}

impl DocumentRenderJob {
    pub fn request(&self) -> &RenderDocumentToImagesRequest {
        &self.request
    }

    pub fn source_path(&self) -> &Path {
        self.prepared.path()
    }

    pub fn bitmap_output_format(&self) -> BitmapOutputFormat {
        self.bitmap_output_format
    }
}

pub async fn prepare_document_render<R: OfficeRenderer + ?Sized>(
    request: RenderDocumentToImagesRequest,
    renderer: &R,
) -> std::result::Result<DocumentRenderJob, CommandError> {
    validate_document_render_request(&request)?;
    let source = PathBuf::from(&request.source_path);
    let prepared = prepare_document(&source, renderer).await?;
    let bitmap_output_format = bitmap_output_format_for_color_mode(&request.color_mode);
    Ok(DocumentRenderJob {
        request,
        prepared,
        bitmap_output_format,
    })
}

fn bitmap_output_format_for_color_mode(color_mode: &str) -> BitmapOutputFormat {
    match color_mode {
        "grayscale" | "gray-cmyk" => BitmapOutputFormat::Luma,
        _ => BitmapOutputFormat::Rgb,
    }
}

fn estimate_document_render_memory(request: &RenderDocumentToImagesRequest) -> u64 {
    let width = if request.render_density == "high" {
        2_480u64
    } else {
        1_240u64
    };
    // PDFium BGRA 页 + 最终 RGB/Luma 页 + 编码工作区。
    // 并行渲染最多 4 线程，峰值按并发页数估算。
    let height = width.saturating_mul(3).div_ceil(2);
    let final_channels = if matches!(request.color_mode.as_str(), "grayscale" | "gray-cmyk") {
        1
    } else {
        3
    };
    let per_page = width
        .saturating_mul(height)
        .saturating_mul(4 + final_channels + 1);
    let selected = if request.page_numbers.is_empty() {
        // 未知总页数时按 4 路并发峰值估算，避免并行路径内存低估。
        4u64
    } else {
        request.page_numbers.len().min(4) as u64
    };
    let concurrent = selected.clamp(1, 4);
    per_page.saturating_mul(concurrent)
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
    matches!(
        extension(path).as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif"
    )
}

fn dated_name(stem: &str, index: u32, output_format: &str) -> String {
    format!(
        "{}-{}-{:03}.{}",
        stem,
        current_date_stamp(),
        index,
        output_format_extension(output_format)
    )
}

fn indexed_name(stem: &str, index: u32, output_format: &str) -> String {
    format!(
        "{}-{:03}.{}",
        stem,
        index,
        output_format_extension(output_format)
    )
}

fn original_name(stem: &str, output_format: &str) -> String {
    format!("{}.{}", stem, output_format_extension(output_format))
}

fn document_output_name(
    stem: &str,
    naming_pattern: &str,
    output_format: &str,
    page_number: u32,
    selected_page_count: usize,
) -> String {
    match naming_pattern {
        "source-name-original" if selected_page_count == 1 => original_name(stem, output_format),
        "source-name-original" => indexed_name(stem, page_number, output_format),
        "source-name-date" => dated_name(stem, page_number, output_format),
        _ => indexed_name(stem, page_number, output_format),
    }
}

#[derive(Debug, Clone)]
struct DocumentOutputPlan {
    page_number: u32,
    output_path: PathBuf,
}

fn plan_document_outputs(
    output_directory: &Path,
    stem: &str,
    naming_pattern: &str,
    output_format: &str,
    total_pages: u32,
    page_numbers: &[u32],
) -> Result<Vec<DocumentOutputPlan>> {
    let selected_pages = if page_numbers.is_empty() {
        (1..=total_pages).collect::<Vec<_>>()
    } else {
        page_numbers.to_vec()
    };
    if let Some(page_number) = selected_pages
        .iter()
        .copied()
        .find(|page_number| *page_number == 0 || *page_number > total_pages)
    {
        anyhow::bail!("页码超出范围: {page_number}");
    }
    if let Some((_, page_number)) = selected_pages
        .iter()
        .enumerate()
        .find(|(index, page)| selected_pages[..*index].contains(page))
    {
        anyhow::bail!("重复页码: {page_number}");
    }
    let selected_page_count = selected_pages.len();
    Ok(selected_pages
        .into_iter()
        .map(|page_number| DocumentOutputPlan {
            page_number,
            output_path: output_directory.join(document_output_name(
                stem,
                naming_pattern,
                output_format,
                page_number,
                selected_page_count,
            )),
        })
        .collect())
}

#[tauri::command]
pub async fn inspect_conversion_file(
    app: tauri::AppHandle,
    path: String,
) -> Result<InspectConversionFileResult, String> {
    let resource_dir = app.path().resource_dir().ok();
    tauri::async_runtime::spawn_blocking(move || {
        inspect_conversion_file_impl(&path, &mut pdf_page_counter(resource_dir.clone()))
            .map_err(crate::commands::error_message::to_user_error_string)
    })
    .await
    .map_err(crate::commands::error_message::to_user_error_string)?
}

#[tauri::command]
pub async fn inspect_conversion_directory(
    app: tauri::AppHandle,
    path: String,
) -> Result<Vec<InspectConversionFileResult>, String> {
    let resource_dir = app.path().resource_dir().ok();
    tauri::async_runtime::spawn_blocking(move || {
        inspect_conversion_directory_impl(&path, resource_dir.clone())
            .map_err(crate::commands::error_message::to_user_error_string)
    })
    .await
    .map_err(crate::commands::error_message::to_user_error_string)?
}

/// 真实 PDF 页数计数器：绑定 PDFium 读取页数。Office 文档不会走到这里。
fn pdf_page_counter(resource_dir: Option<PathBuf>) -> impl FnMut(&Path) -> Result<u32> {
    move |path: &Path| count_pdf_pages(path, resource_dir.as_deref())
}

#[tauri::command]
pub async fn convert_image_file(request: ConvertImageFileRequest) -> Result<Vec<String>, String> {
    convert_image_file_async(request)
        .await
        .map_err(crate::commands::error_message::to_user_error_string)
}

#[tauri::command]
pub async fn render_document_to_images(
    app: tauri::AppHandle,
    request: RenderDocumentToImagesRequest,
) -> std::result::Result<Vec<String>, CommandError> {
    let total_started = Instant::now();
    let _guard = TaskGuard::new(request.task_id.clone());
    let token = cancellation::token_for(request.task_id.as_deref());
    if let Err(error) = cancellation::check_optional(token.as_ref()) {
        return Err(cancelled_command_error(error));
    }

    let resource_dir = app.path().resource_dir().ok();
    let renderer = HelperOfficeRenderer::new(app);
    let prepare_started = Instant::now();
    let job = prepare_document_render(request, &renderer).await?;
    log_stage_timing("prepare_document", prepare_started.elapsed());
    if let Err(error) = cancellation::check_optional(token.as_ref()) {
        return Err(cancelled_command_error(error));
    }
    let estimated_bytes = estimate_document_render_memory(&job.request);
    let permit = process_memory_budget()
        .acquire(estimated_bytes)
        .await
        .map_err(|_| {
            CommandError::new(CommandErrorCode::InternalError, "无法获取文档转换内存许可")
                .with_stage(RendererStage::Rasterizing)
        })?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let raster_started = Instant::now();
        let result = execute_document_render_job(job, resource_dir, token);
        log_stage_timing("execute_document_render", raster_started.elapsed());
        result
    })
    .await
    .map_err(|_| {
        CommandError::new(CommandErrorCode::InternalError, "文档转换任务异常终止")
            .with_stage(RendererStage::Cleanup)
    })?;
    log_stage_timing("render_document_total", total_started.elapsed());
    result
}

/// PDF 走 `count_pages` 得到真实页数；Office（doc/docx/wps）返回 None，绝不探测。
fn is_pdf(path: &Path) -> bool {
    extension(path).as_str() == "pdf"
}

fn is_office_document(path: &Path) -> bool {
    matches!(extension(path).as_str(), "docx" | "doc" | "wps")
}

fn inspect_conversion_file_impl<C>(
    path: &str,
    count_pages: &mut C,
) -> Result<InspectConversionFileResult>
where
    C: FnMut(&Path) -> Result<u32>,
{
    let source = PathBuf::from(path);
    // 边界校验：源必须存在且为文件；伪造/缺失路径在此失败。
    let metadata =
        fs::metadata(&source).with_context(|| format!("源文件不存在或无法访问: {path}"))?;
    if !metadata.is_file() {
        anyhow::bail!("源路径不是文件: {path}");
    }
    let source_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_string();

    if is_image(&source) {
        let (width, height) = if matches!(extension(&source).as_str(), "jpg" | "jpeg") {
            let info =
                read_jpeg_info(&source).with_context(|| format!("无法读取图片尺寸: {path}"))?;
            (info.width, info.height)
        } else {
            image::ImageReader::open(&source)
                .with_context(|| format!("无法打开图片: {path}"))?
                .into_dimensions()
                .with_context(|| format!("无法读取图片尺寸: {path}"))?
        };
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

    if is_pdf(&source) {
        // 导入阶段读页数失败不整项拒绝：仍作为 document 入队（页数未知），
        // 真正转换时再返回可诊断错误，避免用户看到“PDF 不支持”。
        let (page_count, error_message) = match count_pages(&source) {
            Ok(count) => (Some(count), None),
            Err(error) => {
                let redacted =
                    crate::commands::error_message::to_user_error_string(error);
                (
                    None,
                    Some(format!("已导入，但暂无法读取页数：{redacted}")),
                )
            }
        };
        return Ok(InspectConversionFileResult {
            kind: "document".into(),
            source_path: path.into(),
            source_name,
            image_metadata: None,
            document_metadata: Some(DocumentMetadata {
                page_count,
                extension: extension(&source),
            }),
            error_message,
        });
    }

    if is_office_document(&source) {
        // Office 文档导入不启动 Office；页数未知，交由渲染阶段处理。
        return Ok(InspectConversionFileResult {
            kind: "document".into(),
            source_path: path.into(),
            source_name,
            image_metadata: None,
            document_metadata: Some(DocumentMetadata {
                page_count: None,
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

fn is_supported_document(path: &Path) -> bool {
    is_pdf(path) || is_office_document(path)
}

fn inspect_conversion_directory_impl(
    path: &str,
    resource_dir: Option<PathBuf>,
) -> Result<Vec<InspectConversionFileResult>> {
    // 先收集候选文件路径，再用 rayon 并行检查，加速大目录导入。
    let candidates: Vec<PathBuf> = WalkDir::new(path)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| is_image(entry.path()) || is_supported_document(entry.path()))
        .map(|entry| entry.into_path())
        .collect();

    // 每个 rayon 任务独立绑定 PDFium 页数计数器，避免跨线程共享。
    let mut items = candidates
        .par_iter()
        .map(|candidate| {
            let mut counter = pdf_page_counter(resource_dir.clone());
            inspect_conversion_file_impl(&candidate.to_string_lossy(), &mut counter)
        })
        .collect::<Result<Vec<_>>>()?;

    items.sort_by(|left, right| left.source_name.cmp(&right.source_name));
    Ok(items)
}

/// 测试用：以注入的 PDF 页数计数器检查单个文件，绕过 PDFium 真实绑定。
pub fn inspect_conversion_file_with_counter<C>(
    path: &str,
    count_pages: &mut C,
) -> Result<InspectConversionFileResult, String>
where
    C: FnMut(&Path) -> Result<u32>,
{
    inspect_conversion_file_impl(path, count_pages).map_err(crate::commands::error_message::to_user_error_string)
}

/// 测试用：以注入的 PDF 页数计数器扫描目录。
pub fn inspect_conversion_directory_with_counter<C>(
    path: &str,
    mut count_pages: C,
) -> Result<Vec<InspectConversionFileResult>, String>
where
    C: FnMut(&Path) -> Result<u32>,
{
    let candidates: Vec<PathBuf> = WalkDir::new(path)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| is_image(entry.path()) || is_supported_document(entry.path()))
        .map(|entry| entry.into_path())
        .collect();

    let mut items = candidates
        .iter()
        .map(|candidate| {
            inspect_conversion_file_impl(&candidate.to_string_lossy(), &mut count_pages)
        })
        .collect::<Result<Vec<_>>>()
        .map_err(crate::commands::error_message::to_user_error_string)?;

    items.sort_by(|left, right| left.source_name.cmp(&right.source_name));
    Ok(items)
}

/// 一次转换任务的完整规划：请求、操作计划与峰值内存估算。
struct ConversionJob {
    request: ConvertImageFileRequest,
    plan: ImageConversionPlan,
    estimated_bytes: u64,
}

/// 为内存估算构造源图信息；JPEG 走头部解析，其它格式仅取尺寸并保守假定 RGB8。
fn source_info_for_estimate(
    source_path: &Path,
    source_is_confirmed_jpeg: bool,
) -> Result<SourceImageInfo> {
    if source_is_confirmed_jpeg {
        return read_jpeg_info(source_path);
    }
    let (width, height) = image::ImageReader::open(source_path)
        .with_context(|| format!("无法打开图片: {}", source_path.display()))?
        .into_dimensions()
        .with_context(|| format!("无法读取图片尺寸: {}", source_path.display()))?;
    let compressed_bytes = fs::metadata(source_path)
        .map(|meta| meta.len())
        .unwrap_or(0);
    Ok(SourceImageInfo {
        width,
        height,
        pixel_format: SourcePixelFormat::Rgb8,
        compressed_bytes,
    })
}

/// 支持的输入图片扩展名。
const SUPPORTED_IMAGE_EXTENSIONS: [&str; 6] = ["jpg", "jpeg", "png", "webp", "bmp", "gif"];
/// 支持的输出格式（已规范化，jpeg→jpg）。
const SUPPORTED_OUTPUT_FORMATS: [&str; 3] = ["jpg", "png", "webp"];
/// 支持的色彩模式；兼容旧配置 gray-cmyk 与保留原色的 original/空串。
const SUPPORTED_COLOR_MODES: [&str; 5] = ["rgb", "cmyk", "grayscale", "gray-cmyk", "original"];

fn validate_document_render_request(
    request: &RenderDocumentToImagesRequest,
) -> std::result::Result<(), CommandError> {
    let source = require_existing_file(Path::new(&request.source_path))
        .map_err(|error| document_command_error(&error.to_string()))?;
    if !matches!(extension(&source).as_str(), "pdf" | "doc" | "docx" | "wps") {
        return Err(document_command_error("不支持的文档格式"));
    }
    ensure_output_directory(Path::new(&request.output_directory))
        .map_err(|error| document_command_error(&error.to_string()))?;
    let output_format = normalized_format(&request.output_format);
    if !SUPPORTED_OUTPUT_FORMATS.contains(&output_format.as_str()) {
        return Err(document_command_error("不支持的输出格式"));
    }
    if !SUPPORTED_COLOR_MODES.contains(&request.color_mode.as_str()) {
        return Err(document_command_error("不支持的色彩模式"));
    }
    if request.quality == 0 || request.quality > 100 {
        return Err(document_command_error("输出质量必须在 1..=100 之间"));
    }
    if !matches!(request.render_density.as_str(), "standard" | "high") {
        return Err(document_command_error("不支持的文档渲染密度"));
    }
    if !matches!(
        request.naming_pattern.as_str(),
        "source-name-index" | "source-name-date" | "source-name-original"
    ) {
        return Err(document_command_error("不支持的输出命名规则"));
    }
    if request.page_numbers.contains(&0) {
        return Err(CommandError::new(
            CommandErrorCode::DocumentPageRangeInvalid,
            "页码必须为正整数",
        )
        .with_stage(RendererStage::Inspect));
    }
    Ok(())
}

fn document_command_error(message: &str) -> CommandError {
    CommandError::new(CommandErrorCode::DocumentRendererExportFailed, message)
        .with_stage(RendererStage::Inspect)
}

/// 后端权威校验：拒绝非法源、格式、色彩、质量。路径身份不信任前端。
/// 调用方须先通过 `require_existing_file` 规范化 `source_path`。
fn validate_conversion_request(
    request: &ConvertImageFileRequest,
    source_path: &Path,
    requested_output_format: &str,
) -> Result<()> {
    let source_ext = extension(source_path);
    if !SUPPORTED_IMAGE_EXTENSIONS.contains(&source_ext.as_str()) {
        anyhow::bail!("不支持的图片扩展名: {source_ext}");
    }

    if !SUPPORTED_OUTPUT_FORMATS.contains(&requested_output_format) {
        anyhow::bail!("不支持的输出格式: {}", request.output_format);
    }

    if !SUPPORTED_COLOR_MODES.contains(&request.color_mode.as_str()) {
        anyhow::bail!("不支持的色彩模式: {}", request.color_mode);
    }

    if let Some(quality) = request.quality {
        if quality == 0 || quality > 100 {
            anyhow::bail!("输出质量必须在 1..=100 之间: {quality}");
        }
    }

    Ok(())
}

/// 阻塞阶段：校验 → 确认 JPEG、生成操作计划、估算峰值内存。
fn plan_conversion_job(request: ConvertImageFileRequest) -> Result<ConversionJob> {
    let source_path = require_existing_file(Path::new(&request.source_path))?;
    let output_path = ensure_output_file_path(Path::new(&request.output_path))?;
    let requested_output_format = normalized_format(&request.output_format);

    validate_conversion_request(&request, &source_path, &requested_output_format)?;

    let source_ext = extension(&source_path);
    let is_jpeg_ext = matches!(source_ext.as_str(), "jpg" | "jpeg");

    // 仅在扩展名为 JPEG 且头部可解析时确认源文件为合法 JPEG；伪 .jpg 必须在此失败，禁止字节复制。
    let source_is_confirmed_jpeg = if is_jpeg_ext {
        read_jpeg_info(&source_path).is_ok()
    } else {
        false
    };
    if is_jpeg_ext && !source_is_confirmed_jpeg {
        // 触发与解码路径一致的错误信息，避免静默复制损坏文件。
        read_jpeg_info(&source_path)?;
    }

    let plan = plan_image_conversion(
        &source_path,
        &output_path,
        &requested_output_format,
        &request.color_mode,
        request.quality,
        source_is_confirmed_jpeg,
    )?;

    // 输出即源文件必须经前端批次覆盖确认授权；未授权一律拒绝，禁止静默替换原图。
    if plan.source_equals_destination && !request.allow_source_overwrite {
        anyhow::bail!("SOURCE_OVERWRITE_NOT_AUTHORIZED: 输出会替换源文件，需先确认覆盖");
    }

    let info = source_info_for_estimate(&source_path, source_is_confirmed_jpeg)?;
    let estimate = estimate_conversion_memory(
        &info,
        plan.operation,
        &requested_output_format,
        &request.color_mode,
        request.quality,
    )?;

    Ok(ConversionJob {
        request,
        plan,
        estimated_bytes: estimate.peak_bytes,
    })
}

/// 阻塞阶段：在已获得内存许可后执行复制或转码。
fn execute_conversion_job(job: ConversionJob) -> Result<Vec<String>> {
    let ConversionJob { request, plan, .. } = job;
    let source_path = require_existing_file(Path::new(&request.source_path))?;
    let requested_output_format = normalized_format(&request.output_format);
    let is_jpeg_ext = matches!(extension(&source_path).as_str(), "jpg" | "jpeg");

    if let Some(parent) = plan.actual_output_path.parent() {
        ensure_output_directory(parent)?;
    }

    match plan.operation {
        ImageConversionOperation::CopyJpeg => {
            copy_file_atomically(&source_path, &plan.actual_output_path)?;
        }
        ImageConversionOperation::Transcode => {
            let source = if is_jpeg_ext {
                decode_jpeg(&source_path, &request.color_mode)?
            } else {
                image::open(&source_path)
                    .with_context(|| format!("无法打开图片: {}", request.source_path))?
            };
            let output = apply_color_mode(source, &request.color_mode);
            write_dynamic_image(
                &plan.actual_output_path,
                &output,
                &requested_output_format,
                request.quality,
            )?;
        }
    }

    Ok(vec![plan.actual_output_path.to_string_lossy().into_owned()])
}

/// 异步转换：规划 → 申请内存预算 → 携带许可在阻塞线程执行。
async fn convert_image_file_async(request: ConvertImageFileRequest) -> Result<Vec<String>> {
    let _guard = TaskGuard::new(request.task_id.clone());
    let token = cancellation::token_for(request.task_id.as_deref());
    cancellation::check_optional(token.as_ref())?;

    let job = tauri::async_runtime::spawn_blocking(move || plan_conversion_job(request))
        .await
        .context("规划转换任务失败")??;

    cancellation::check_optional(token.as_ref())?;
    let permit = process_memory_budget().acquire(job.estimated_bytes).await?;
    cancellation::check_optional(token.as_ref())?;

    tauri::async_runtime::spawn_blocking(move || {
        // 许可随作用域结束释放，确保执行期间独占估算的内存额度。
        let _permit = permit;
        cancellation::check_optional(token.as_ref())?;
        execute_conversion_job(job)
    })
    .await
    .context("执行转换任务失败")?
}

/// 可复现的 Release 转换性能证据采集。仅在 `benchmarking` feature 下编译，复用生产流水线的私有阶段。
#[cfg(feature = "benchmarking")]
pub mod benchmarking {
    use super::*;
    use crate::commands::common::write_atomically;
    use image::GenericImageView;
    use serde::{Deserialize, Serialize};
    use std::io::Write;
    use std::sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    };
    use std::thread;
    use std::time::{Duration, Instant};

    /// 固定随机种子，确保素材字节可复现。
    const FIXTURE_SEED: u64 = 0x1234_5678_9abc_def0;

    /// 基准素材规格：24MP / 48MP / 100MP。
    #[derive(Debug, Clone, Copy)]
    pub struct FixtureSpec {
        pub name: &'static str,
        pub width: u32,
        pub height: u32,
        pub quality: u8,
    }

    pub const FIXTURES: [FixtureSpec; 3] = [
        FixtureSpec {
            name: "24mp",
            width: 6000,
            height: 4000,
            quality: 92,
        },
        FixtureSpec {
            name: "48mp",
            width: 8000,
            height: 6000,
            quality: 92,
        },
        FixtureSpec {
            name: "100mp",
            width: 10000,
            height: 10000,
            quality: 92,
        },
    ];

    /// 转换场景：覆盖质量 100 复制、质量 90 转码、JPG→PNG、RGB→灰度、WebP 90/100。
    #[derive(Debug, Clone, Copy)]
    pub struct Scenario {
        pub name: &'static str,
        pub fixture: &'static str,
        pub output_format: &'static str,
        pub color_mode: &'static str,
        pub quality: u8,
    }

    pub const SCENARIOS: [Scenario; 6] = [
        Scenario {
            name: "jpg-copy-q100",
            fixture: "100mp",
            output_format: "jpg",
            color_mode: "rgb",
            quality: 100,
        },
        Scenario {
            name: "jpg-transcode-q90",
            fixture: "24mp",
            output_format: "jpg",
            color_mode: "rgb",
            quality: 90,
        },
        Scenario {
            name: "jpg-to-png",
            fixture: "24mp",
            output_format: "png",
            color_mode: "rgb",
            quality: 100,
        },
        Scenario {
            name: "rgb-to-grayscale",
            fixture: "48mp",
            output_format: "jpg",
            color_mode: "grayscale",
            quality: 90,
        },
        Scenario {
            name: "webp-90",
            fixture: "24mp",
            output_format: "webp",
            color_mode: "rgb",
            quality: 90,
        },
        Scenario {
            name: "webp-100",
            fixture: "24mp",
            output_format: "webp",
            color_mode: "rgb",
            quality: 100,
        },
    ];

    pub fn fixture_by_name(name: &str) -> Option<FixtureSpec> {
        FIXTURES.iter().copied().find(|spec| spec.name == name)
    }

    pub fn scenario_by_name(name: &str) -> Option<Scenario> {
        SCENARIOS
            .iter()
            .copied()
            .find(|scenario| scenario.name == name)
    }

    pub fn fixture_path(dir: &Path, spec: &FixtureSpec) -> PathBuf {
        dir.join(format!("fixture-{}.jpg", spec.name))
    }

    /// 64 位 FNV-1a 哈希，用于素材字节指纹（无需额外依赖）。
    fn fnv1a_hex(bytes: &[u8]) -> String {
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        for byte in bytes {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
        }
        format!("{hash:016x}")
    }

    pub fn hash_file(path: &Path) -> Result<String> {
        let bytes = fs::read(path).with_context(|| format!("无法读取素材: {}", path.display()))?;
        Ok(fnv1a_hex(&bytes))
    }

    /// 平滑渐变 + 种子微扰的确定性图案，便于 JPEG 稳定压缩且字节可复现。
    fn patterned_rgb(width: u32, height: u32, seed: u64) -> image::RgbImage {
        let tint = seed as u8;
        image::RgbImage::from_fn(width, height, |x, y| {
            let r = ((x * 255 / width.max(1)) as u8).wrapping_add(tint);
            let g = (y * 255 / height.max(1)) as u8;
            let b = (((x + y) / 16) as u8) ^ tint;
            image::Rgb([r, g, b])
        })
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct FixtureManifest {
        pub name: String,
        pub path: String,
        pub width: u32,
        pub height: u32,
        pub bytes: u64,
        pub hash: String,
    }

    /// 生成单个基准素材（原子写），返回其清单。
    pub fn generate_fixture(spec: &FixtureSpec, dir: &Path) -> Result<FixtureManifest> {
        fs::create_dir_all(dir).with_context(|| format!("无法创建素材目录: {}", dir.display()))?;
        let path = fixture_path(dir, spec);
        let rgb = patterned_rgb(spec.width, spec.height, FIXTURE_SEED);
        write_atomically(&path, |writer| {
            let mut buffered = std::io::BufWriter::new(writer);
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffered, spec.quality)
                .encode(
                    rgb.as_raw(),
                    spec.width,
                    spec.height,
                    image::ColorType::Rgb8.into(),
                )?;
            buffered.flush()?;
            Ok(())
        })?;
        let bytes = fs::metadata(&path)?.len();
        Ok(FixtureManifest {
            name: spec.name.into(),
            path: path.to_string_lossy().into_owned(),
            width: spec.width,
            height: spec.height,
            bytes,
            hash: hash_file(&path)?,
        })
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct PhaseTimings {
        pub plan_us: u64,
        pub permit_us: u64,
        pub decode_us: u64,
        pub color_us: u64,
        pub encode_us: u64,
        pub finalize_us: u64,
        pub total_us: u64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ScenarioReport {
        pub scenario: String,
        pub fixture: String,
        pub fixture_hash: String,
        pub operation: String,
        pub output_path: String,
        pub output_bytes: u64,
        pub output_width: u32,
        pub output_height: u32,
        pub peak_working_set_bytes: u64,
        pub correctness_ok: bool,
        pub correctness_detail: String,
        pub timings: PhaseTimings,
    }

    #[derive(Debug, Clone, Serialize)]
    pub struct BenchEnvironment {
        pub os: String,
        pub arch: String,
        pub profile: String,
        pub logical_cpus: usize,
        pub total_memory_bytes: u64,
        pub git_commit: String,
    }

    pub fn environment() -> BenchEnvironment {
        let logical_cpus = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(0);
        let mut system = sysinfo::System::new();
        system.refresh_memory();
        BenchEnvironment {
            os: std::env::consts::OS.into(),
            arch: std::env::consts::ARCH.into(),
            profile: if cfg!(debug_assertions) {
                "debug".into()
            } else {
                "release".into()
            },
            logical_cpus,
            total_memory_bytes: system.total_memory(),
            git_commit: option_env!("GIT_COMMIT").unwrap_or("unknown").into(),
        }
    }

    /// 后台采样进程常驻集，取运行期间峰值。
    struct PeakSampler {
        stop: Arc<AtomicBool>,
        peak: Arc<AtomicU64>,
        handle: Option<thread::JoinHandle<()>>,
    }

    impl PeakSampler {
        fn start() -> Self {
            let stop = Arc::new(AtomicBool::new(false));
            let peak = Arc::new(AtomicU64::new(0));
            let stop_worker = Arc::clone(&stop);
            let peak_worker = Arc::clone(&peak);
            let handle = thread::spawn(move || {
                let pid = match sysinfo::get_current_pid() {
                    Ok(pid) => pid,
                    Err(_) => return,
                };
                let mut system = sysinfo::System::new();
                while !stop_worker.load(Ordering::Relaxed) {
                    system.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[pid]), true);
                    if let Some(process) = system.process(pid) {
                        peak_worker.fetch_max(process.memory(), Ordering::Relaxed);
                    }
                    thread::sleep(Duration::from_millis(5));
                }
            });
            Self {
                stop,
                peak,
                handle: Some(handle),
            }
        }

        fn finish(mut self) -> u64 {
            self.stop.store(true, Ordering::Relaxed);
            if let Some(handle) = self.handle.take() {
                let _ = handle.join();
            }
            self.peak.load(Ordering::Relaxed)
        }
    }

    struct ExecuteOutcome {
        decode_us: u64,
        color_us: u64,
        encode_us: u64,
        finalize_us: u64,
        output_path: PathBuf,
    }

    /// 确认输出已落盘：以可写句柄重开并 sync，测量持久化屏障耗时。
    /// Windows 上 `FlushFileBuffers` 需要写权限，只读句柄会返回 access denied。
    fn finalize_barrier(path: &Path) -> Result<()> {
        let file = fs::OpenOptions::new()
            .write(true)
            .open(path)
            .with_context(|| format!("无法打开输出以确认落盘: {}", path.display()))?;
        file.sync_all().context("无法 sync 输出文件")?;
        Ok(())
    }

    /// 逐阶段计时地执行 job（与 `execute_conversion_job` 语义一致，仅额外打点）。
    fn instrumented_execute(job: &ConversionJob) -> Result<ExecuteOutcome> {
        let request = &job.request;
        let plan = &job.plan;
        let source_path = PathBuf::from(&request.source_path);
        let requested_output_format = normalized_format(&request.output_format);
        let is_jpeg_ext = matches!(extension(&source_path).as_str(), "jpg" | "jpeg");

        if let Some(parent) = plan.actual_output_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("无法创建输出目录: {}", parent.display()))?;
        }

        let (decode_us, color_us, encode_us, finalize_us) = match plan.operation {
            ImageConversionOperation::CopyJpeg => {
                let encode = Instant::now();
                copy_file_atomically(&source_path, &plan.actual_output_path)?;
                let encode_us = encode.elapsed().as_micros() as u64;
                let finalize = Instant::now();
                finalize_barrier(&plan.actual_output_path)?;
                (0, 0, encode_us, finalize.elapsed().as_micros() as u64)
            }
            ImageConversionOperation::Transcode => {
                let decode = Instant::now();
                let source = if is_jpeg_ext {
                    decode_jpeg(&source_path, &request.color_mode)?
                } else {
                    image::open(&source_path)
                        .with_context(|| format!("无法打开图片: {}", request.source_path))?
                };
                let decode_us = decode.elapsed().as_micros() as u64;
                let color = Instant::now();
                let output = apply_color_mode(source, &request.color_mode);
                let color_us = color.elapsed().as_micros() as u64;
                let encode = Instant::now();
                write_dynamic_image(
                    &plan.actual_output_path,
                    &output,
                    &requested_output_format,
                    request.quality,
                )?;
                let encode_us = encode.elapsed().as_micros() as u64;
                let finalize = Instant::now();
                finalize_barrier(&plan.actual_output_path)?;
                (
                    decode_us,
                    color_us,
                    encode_us,
                    finalize.elapsed().as_micros() as u64,
                )
            }
        };

        Ok(ExecuteOutcome {
            decode_us,
            color_us,
            encode_us,
            finalize_us,
            output_path: plan.actual_output_path.clone(),
        })
    }

    fn output_extension(output_format: &str) -> String {
        match normalized_format(output_format).as_str() {
            "jpg" => "jpg".into(),
            "png" => "png".into(),
            "webp" => "webp".into(),
            other => other.to_string(),
        }
    }

    /// 校验输出正确性：尺寸不变、复制字节一致、灰度为单通道。
    fn verify_scenario(
        scenario: &Scenario,
        source: &Path,
        output: &Path,
    ) -> Result<(u32, u32, bool, String)> {
        let spec = fixture_by_name(scenario.fixture).context("未知素材")?;
        let (width, height) = match extension(output).as_str() {
            "jpg" | "jpeg" => {
                let info = read_jpeg_info(output)?;
                (info.width, info.height)
            }
            _ => image::open(output)
                .with_context(|| format!("无法打开输出: {}", output.display()))?
                .dimensions(),
        };

        if (width, height) != (spec.width, spec.height) {
            return Ok((
                width,
                height,
                false,
                format!(
                    "尺寸不符: {width}x{height} != {}x{}",
                    spec.width, spec.height
                ),
            ));
        }

        match scenario.name {
            "jpg-copy-q100" => {
                let source_bytes = fs::read(source)?;
                let output_bytes = fs::read(output)?;
                if source_bytes != output_bytes {
                    return Ok((width, height, false, "复制输出与源字节不一致".into()));
                }
            }
            "rgb-to-grayscale" => {
                let decoded = image::open(output)
                    .with_context(|| format!("无法打开输出: {}", output.display()))?;
                if !matches!(decoded, image::DynamicImage::ImageLuma8(_)) {
                    return Ok((width, height, false, "灰度输出不是单通道 Luma8".into()));
                }
            }
            _ => {}
        }

        Ok((width, height, true, "ok".into()))
    }

    /// 在当前进程内执行单个场景：规划 → 内存许可 → 逐阶段执行 → 校验，返回完整报告。
    pub fn run_scenario(
        scenario: &Scenario,
        fixture_source: &Path,
        fixture_hash: &str,
        out_dir: &Path,
    ) -> Result<ScenarioReport> {
        fs::create_dir_all(out_dir)
            .with_context(|| format!("无法创建输出目录: {}", out_dir.display()))?;
        let output_path = out_dir.join(format!(
            "{}.{}",
            scenario.name,
            output_extension(scenario.output_format)
        ));

        let request = ConvertImageFileRequest {
            source_path: fixture_source.to_string_lossy().into_owned(),
            output_path: output_path.to_string_lossy().into_owned(),
            output_format: scenario.output_format.to_string(),
            color_mode: scenario.color_mode.to_string(),
            quality: Some(scenario.quality),
            allow_source_overwrite: false,
            task_id: None,
        };

        let sampler = PeakSampler::start();
        let total = Instant::now();

        let plan_start = Instant::now();
        let job = plan_conversion_job(request)?;
        let plan_us = plan_start.elapsed().as_micros() as u64;
        let operation = match job.plan.operation {
            ImageConversionOperation::CopyJpeg => "copy",
            ImageConversionOperation::Transcode => "transcode",
        }
        .to_string();

        let permit_start = Instant::now();
        let permit =
            tauri::async_runtime::block_on(process_memory_budget().acquire(job.estimated_bytes))?;
        let permit_us = permit_start.elapsed().as_micros() as u64;

        let outcome = instrumented_execute(&job);
        drop(permit);
        let outcome = outcome?;

        let total_us = total.elapsed().as_micros() as u64;
        let peak_working_set_bytes = sampler.finish();

        let output_bytes = fs::metadata(&outcome.output_path)?.len();
        let (output_width, output_height, correctness_ok, correctness_detail) =
            verify_scenario(scenario, fixture_source, &outcome.output_path)?;

        Ok(ScenarioReport {
            scenario: scenario.name.into(),
            fixture: scenario.fixture.into(),
            fixture_hash: fixture_hash.into(),
            operation,
            output_path: outcome.output_path.to_string_lossy().into_owned(),
            output_bytes,
            output_width,
            output_height,
            peak_working_set_bytes,
            correctness_ok,
            correctness_detail,
            timings: PhaseTimings {
                plan_us,
                permit_us,
                decode_us: outcome.decode_us,
                color_us: outcome.color_us,
                encode_us: outcome.encode_us,
                finalize_us: outcome.finalize_us,
                total_us,
            },
        })
    }
}

struct DocumentOutputTransaction<'a> {
    request: &'a RenderDocumentToImagesRequest,
    pending: Vec<DocumentOutputPlan>,
    output_paths: Vec<String>,
    created_paths: Vec<PathBuf>,
    committed: bool,
}

impl<'a> DocumentOutputTransaction<'a> {
    fn new(request: &'a RenderDocumentToImagesRequest, total_pages: u32) -> Result<Self> {
        let output_directory = PathBuf::from(&request.output_directory);
        fs::create_dir_all(&output_directory)
            .with_context(|| format!("无法创建输出目录: {}", request.output_directory))?;
        let stem = Path::new(&request.source_path)
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("output");
        let pending = plan_document_outputs(
            &output_directory,
            stem,
            &request.naming_pattern,
            &request.output_format,
            total_pages,
            &request.page_numbers,
        )?
        .into_iter()
        .filter(|plan| !plan.output_path.exists())
        .collect::<Vec<_>>();
        Ok(Self {
            request,
            output_paths: Vec::with_capacity(pending.len()),
            created_paths: Vec::with_capacity(pending.len()),
            pending,
            committed: false,
        })
    }

    fn pending_pages(&self) -> Vec<u32> {
        self.pending.iter().map(|plan| plan.page_number).collect()
    }

    fn write_page(&mut self, rendered_page: RenderedPdfPage) -> Result<()> {
        let plan = self
            .pending
            .get(self.created_paths.len())
            .context("PDF 渲染器返回了未规划的页面")?;
        if rendered_page.page_number != plan.page_number {
            anyhow::bail!(
                "PDF 渲染页顺序不符: 期望 {}，实际 {}",
                plan.page_number,
                rendered_page.page_number
            );
        }
        let image = apply_color_mode(rendered_page.image, &self.request.color_mode);
        write_dynamic_image(
            &plan.output_path,
            &image,
            &self.request.output_format,
            Some(self.request.quality),
        )?;
        self.created_paths.push(plan.output_path.clone());
        self.output_paths
            .push(plan.output_path.to_string_lossy().into_owned());
        Ok(())
    }

    fn finish(mut self) -> Vec<String> {
        self.committed = true;
        std::mem::take(&mut self.output_paths)
    }
}

impl Drop for DocumentOutputTransaction<'_> {
    fn drop(&mut self) {
        if !self.committed {
            for path in &self.created_paths {
                let _ = fs::remove_file(path);
            }
        }
    }
}

#[cfg(test)]
fn render_document_outputs_with<R>(
    request: &RenderDocumentToImagesRequest,
    total_pages: u32,
    mut render_pages: R,
) -> Result<Vec<String>>
where
    R: FnMut(&[u32], &mut dyn FnMut(RenderedPdfPage) -> Result<()>) -> Result<()>,
{
    let mut transaction = DocumentOutputTransaction::new(request, total_pages)?;
    let pending_pages = transaction.pending_pages();
    render_pages(&pending_pages, &mut |page| transaction.write_page(page))?;
    Ok(transaction.finish())
}

fn execute_document_render_job(
    job: DocumentRenderJob,
    resource_dir: Option<PathBuf>,
    token: Option<CancellationToken>,
) -> std::result::Result<Vec<String>, CommandError> {
    let render_source = job.source_path().to_path_buf();
    let output_format = job.bitmap_output_format;
    let request = job.request;
    let transaction = std::cell::RefCell::new(None);

    render_pdf_document_with_callback_cancellable(
        &render_source,
        resource_dir.as_deref(),
        &request.render_density,
        output_format,
        |total_pages| {
            let created = DocumentOutputTransaction::new(&request, total_pages)?;
            let pages = created.pending_pages();
            *transaction.borrow_mut() = Some(created);
            Ok(pages)
        },
        |page| {
            transaction
                .borrow_mut()
                .as_mut()
                .context("PDF 输出事务尚未初始化")?
                .write_page(page)
        },
        token.as_ref(),
    )
    .map_err(|error| document_pipeline_error(error, RendererStage::Rasterizing, &render_source))?;

    let transaction = transaction.into_inner().ok_or_else(|| {
        document_pipeline_error(
            anyhow::anyhow!("PDF 输出事务尚未初始化"),
            RendererStage::Encoding,
            &render_source,
        )
    })?;
    Ok(transaction.finish())
}

fn cancelled_command_error(error: anyhow::Error) -> CommandError {
    CommandError::new(CommandErrorCode::InternalError, cancellation::CANCELLED_MESSAGE)
        .with_stage(RendererStage::Cleanup)
        .with_diagnostic(error.to_string())
}

fn document_pipeline_error(
    error: anyhow::Error,
    stage: RendererStage,
    source_path: &Path,
) -> CommandError {
    let raw = error.to_string();
    if cancellation::is_cancelled_message(&raw) {
        return cancelled_command_error(error);
    }
    let code = if raw.contains("页码") {
        CommandErrorCode::DocumentPageRangeInvalid
    } else {
        CommandErrorCode::DocumentRendererExportFailed
    };
    let message = match code {
        CommandErrorCode::DocumentPageRangeInvalid => "文档页码超出范围",
        _ if stage == RendererStage::Rasterizing => "无法读取或渲染文档页面",
        _ if stage == RendererStage::Encoding => "无法写入文档转换结果",
        _ => "文档转换失败",
    };
    let source = source_path.to_string_lossy();
    let diagnostic = raw.replace(source.as_ref(), "[path]");
    CommandError::new(code, message)
        .with_stage(stage)
        .with_diagnostic(diagnostic)
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::{Path, PathBuf},
    };

    use image::{codecs::jpeg::JpegEncoder, ColorType, ImageBuffer, Rgb};
    use tempfile::tempdir;

    use super::{
        current_date_stamp, dated_name, original_name, render_document_outputs_with,
        RenderDocumentToImagesRequest,
    };
    use crate::commands::pdf_rendering::RenderedPdfPage;

    #[test]
    fn dated_name_appends_index_suffix() {
        assert_eq!(
            dated_name("demo", 2, "jpg"),
            format!("demo-{}-002.jpg", current_date_stamp())
        );
    }

    #[test]
    fn original_name_uses_source_stem_and_output_extension() {
        assert_eq!(original_name("demo", "webp"), "demo.webp");
        assert_eq!(original_name("demo", "jpeg"), "demo.jpg");
    }

    fn document_request(dir: &Path, page_numbers: Vec<u32>) -> RenderDocumentToImagesRequest {
        RenderDocumentToImagesRequest {
            source_path: dir.join("report.pdf").to_string_lossy().into_owned(),
            output_directory: dir.join("out").to_string_lossy().into_owned(),
            output_format: "png".into(),
            color_mode: "rgb".into(),
            quality: 90,
            page_numbers,
            render_density: "standard".into(),
            naming_pattern: "source-name-original".into(),
            task_id: None,
        }
    }

    fn fake_page(page_number: u32) -> RenderedPdfPage {
        RenderedPdfPage {
            page_number,
            image: image::DynamicImage::ImageRgb8(ImageBuffer::from_pixel(
                1,
                1,
                Rgb([page_number as u8, 2, 3]),
            )),
        }
    }

    #[test]
    fn document_output_naming_original_one_selected_uses_unsuffixed_name() {
        let dir = tempdir().unwrap();
        let request = document_request(dir.path(), vec![2]);
        let output = render_document_outputs_with(&request, 3, |pages, callback| {
            assert_eq!(pages, &[2]);
            callback(fake_page(2))
        })
        .unwrap();
        assert_eq!(PathBuf::from(&output[0]).file_name().unwrap(), "report.png");
    }

    #[test]
    fn document_output_naming_original_all_and_custom_keep_page_numbers() {
        let dir = tempdir().unwrap();
        let request = document_request(dir.path(), vec![]);
        let all = render_document_outputs_with(&request, 3, |pages, callback| {
            assert_eq!(pages, &[1, 2, 3]);
            for page_number in pages {
                callback(fake_page(*page_number))?;
            }
            Ok(())
        })
        .unwrap();
        assert_eq!(
            all.iter()
                .map(|path| PathBuf::from(path)
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned())
                .collect::<Vec<_>>(),
            ["report-001.png", "report-002.png", "report-003.png"]
        );

        fs::remove_dir_all(dir.path().join("out")).unwrap();
        let request = document_request(dir.path(), vec![1, 3]);
        let custom = render_document_outputs_with(&request, 3, |pages, callback| {
            assert_eq!(pages, &[1, 3]);
            for page_number in pages {
                callback(fake_page(*page_number))?;
            }
            Ok(())
        })
        .unwrap();
        assert_eq!(
            custom
                .iter()
                .map(|path| PathBuf::from(path)
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned())
                .collect::<Vec<_>>(),
            ["report-001.png", "report-003.png"]
        );
    }

    #[test]
    fn document_output_naming_rejects_duplicate_pages_before_rendering() {
        let dir = tempdir().unwrap();
        let request = document_request(dir.path(), vec![2, 2]);
        let mut render_called = false;

        let error = render_document_outputs_with(&request, 3, |_, _| {
            render_called = true;
            Ok(())
        })
        .unwrap_err();

        assert!(error.to_string().contains("重复页码"));
        assert!(!render_called);
    }

    #[test]
    fn document_output_naming_filters_existing_outputs_before_rendering() {
        let dir = tempdir().unwrap();
        let request = document_request(dir.path(), vec![]);
        let existing = dir.path().join("out").join("report-002.png");
        fs::create_dir_all(existing.parent().unwrap()).unwrap();
        fs::write(&existing, b"preexisting").unwrap();

        let output = render_document_outputs_with(&request, 3, |pages, callback| {
            assert_eq!(pages, &[1, 3]);
            callback(fake_page(1))?;
            callback(fake_page(3))
        })
        .unwrap();
        assert_eq!(output.len(), 2);
        assert_eq!(fs::read(existing).unwrap(), b"preexisting");
    }

    #[test]
    fn document_output_naming_skips_rendering_when_every_output_exists() {
        let dir = tempdir().unwrap();
        let request = document_request(dir.path(), vec![1]);
        let existing = dir.path().join("out").join("report.png");
        fs::create_dir_all(existing.parent().unwrap()).unwrap();
        fs::write(&existing, b"preexisting").unwrap();

        let output = render_document_outputs_with(&request, 3, |pages, _| {
            assert!(pages.is_empty());
            Ok(())
        })
        .unwrap();

        assert!(output.is_empty());
        assert_eq!(fs::read(existing).unwrap(), b"preexisting");
    }

    #[test]
    fn document_output_naming_rolls_back_only_outputs_created_by_request() {
        let dir = tempdir().unwrap();
        let request = document_request(dir.path(), vec![]);
        let existing = dir.path().join("out").join("report-002.png");
        fs::create_dir_all(existing.parent().unwrap()).unwrap();
        fs::write(&existing, b"preexisting").unwrap();

        let error = render_document_outputs_with(&request, 3, |pages, callback| {
            assert_eq!(pages, &[1, 3]);
            callback(fake_page(1))?;
            anyhow::bail!("page 3 failed")
        })
        .unwrap_err();
        assert!(error.to_string().contains("page 3 failed"));
        assert!(!dir.path().join("out").join("report-001.png").exists());
        assert_eq!(fs::read(existing).unwrap(), b"preexisting");
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
