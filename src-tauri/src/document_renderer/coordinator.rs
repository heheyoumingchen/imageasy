//! Office 文档路由、全局串行化与私有 PDF 桥生命周期。

use std::future::Future;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::time::Instant;

use tauri::Runtime;

use super::bridge_cache::{store_bridge, try_clone_cached_bridge};
use super::error::{CommandError, CommandErrorCode, DocumentRendererKind, RendererStage};
use super::helper_client::run_helper;
use super::protocol::{HelperOperation, HelperRequest, PROTOCOL_VERSION};
use super::timing::log_stage_timing;

static OFFICE_EXPORT_MUTEX: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
const BRIDGE_FILE_NAME: &str = "bridge.pdf";
const PDF_SIGNATURE: &[u8] = b"%PDF-";

pub type OfficeRenderFuture<'a> =
    Pin<Box<dyn Future<Output = Result<PathBuf, CommandError>> + Send + 'a>>;

pub trait OfficeRenderer: Send + Sync {
    fn render_to_pdf<'a>(
        &'a self,
        renderer: DocumentRendererKind,
        source: &'a Path,
        requested_output: &'a Path,
    ) -> OfficeRenderFuture<'a>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocumentRoute {
    Pdf,
    WordThenWps,
    WpsOnly,
}

impl DocumentRoute {
    pub fn for_path(path: &Path) -> Result<Self, CommandError> {
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        match extension.as_str() {
            "pdf" => Ok(Self::Pdf),
            "doc" | "docx" => Ok(Self::WordThenWps),
            "wps" => Ok(Self::WpsOnly),
            _ => Err(CommandError::new(
                CommandErrorCode::DocumentRendererExportFailed,
                "不支持的文档格式",
            )
            .with_stage(RendererStage::Inspect)),
        }
    }
}

#[derive(Debug)]
pub enum PreparedDocument {
    DirectPdf(PathBuf),
    PrivatePdf(PrivatePdfBridge),
}

impl PreparedDocument {
    pub fn path(&self) -> &Path {
        match self {
            Self::DirectPdf(path) => path,
            Self::PrivatePdf(bridge) => bridge.path(),
        }
    }
}

#[derive(Debug)]
pub struct PrivatePdfBridge {
    path: PathBuf,
    _temp_dir: tempfile::TempDir,
}

impl PrivatePdfBridge {
    pub fn path(&self) -> &Path {
        &self.path
    }
}

pub async fn prepare_document<R: OfficeRenderer + ?Sized>(
    source: &Path,
    renderer: &R,
) -> Result<PreparedDocument, CommandError> {
    match DocumentRoute::for_path(source)? {
        DocumentRoute::Pdf => Ok(PreparedDocument::DirectPdf(source.to_path_buf())),
        route => prepare_office_document(source, route, renderer).await,
    }
}

pub async fn with_prepared_document<R, T, F>(
    source: &Path,
    renderer: &R,
    consume: F,
) -> Result<T, CommandError>
where
    R: OfficeRenderer + ?Sized,
    F: FnOnce(&Path) -> Result<T, CommandError>,
{
    let prepared = prepare_document(source, renderer).await?;
    consume(prepared.path())
}

async fn prepare_office_document<R: OfficeRenderer + ?Sized>(
    source: &Path,
    route: DocumentRoute,
    renderer: &R,
) -> Result<PreparedDocument, CommandError> {
    // 同文件改格式/质量：命中进程内桥接 PDF 缓存则跳过 Office。
    let cache_lookup = Instant::now();
    if let Some((temp_dir, path)) = try_clone_cached_bridge(source)? {
        log_stage_timing("bridge_cache_hit", cache_lookup.elapsed());
        return Ok(private_bridge(temp_dir, path));
    }
    log_stage_timing("bridge_cache_miss", cache_lookup.elapsed());

    let temp_dir = tempfile::tempdir().map_err(bridge_io_error)?;
    let requested_output = temp_dir.path().join(BRIDGE_FILE_NAME);
    let _guard = OFFICE_EXPORT_MUTEX.lock().await;
    let office_started = Instant::now();

    let actual_output = match route {
        DocumentRoute::WordThenWps => {
            let word_error = match render_and_validate(
                renderer,
                DocumentRendererKind::Word,
                source,
                temp_dir.path(),
                &requested_output,
            )
            .await
            {
                Ok(path) => {
                    log_stage_timing("office_export", office_started.elapsed());
                    // 缓存失败不影响本次成功路径。
                    let _ = store_bridge(source, &path);
                    return Ok(private_bridge(temp_dir, path));
                }
                Err(error) => error,
            };
            clear_bridge_output(&requested_output)?;
            match render_and_validate(
                renderer,
                DocumentRendererKind::Wps,
                source,
                temp_dir.path(),
                &requested_output,
            )
            .await
            {
                Ok(path) => path,
                Err(wps_error) => return Err(combine_renderer_errors(&word_error, &wps_error)),
            }
        }
        DocumentRoute::WpsOnly => {
            render_and_validate(
                renderer,
                DocumentRendererKind::Wps,
                source,
                temp_dir.path(),
                &requested_output,
            )
            .await?
        }
        DocumentRoute::Pdf => unreachable!("PDF bypasses Office preparation"),
    };

    log_stage_timing("office_export", office_started.elapsed());
    let _ = store_bridge(source, &actual_output);
    Ok(private_bridge(temp_dir, actual_output))
}

async fn render_and_validate<R: OfficeRenderer + ?Sized>(
    renderer: &R,
    kind: DocumentRendererKind,
    source: &Path,
    temp_dir: &Path,
    requested_output: &Path,
) -> Result<PathBuf, CommandError> {
    let actual_output = renderer
        .render_to_pdf(kind, source, requested_output)
        .await?;
    validate_bridge(&actual_output, temp_dir, requested_output)?;
    Ok(actual_output)
}

fn clear_bridge_output(path: &Path) -> Result<(), CommandError> {
    let metadata = match std::fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(_) => return Err(bridge_error("无法清理失败的私有 PDF")),
    };
    let result = if metadata.is_dir() {
        std::fs::remove_dir_all(path)
    } else {
        std::fs::remove_file(path)
    };
    result.map_err(|_| bridge_error("无法清理失败的私有 PDF"))
}

fn private_bridge(temp_dir: tempfile::TempDir, path: PathBuf) -> PreparedDocument {
    PreparedDocument::PrivatePdf(PrivatePdfBridge {
        path,
        _temp_dir: temp_dir,
    })
}

fn validate_bridge(
    actual_output: &Path,
    temp_dir: &Path,
    requested_output: &Path,
) -> Result<(), CommandError> {
    if actual_output != requested_output || actual_output.parent() != Some(temp_dir) {
        return Err(bridge_error("Office helper 返回了无效的私有 PDF 路径"));
    }

    let metadata = std::fs::symlink_metadata(actual_output)
        .map_err(|_| bridge_error("Office helper 未生成私有 PDF"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() || metadata.len() == 0 {
        return Err(bridge_error("Office helper 生成的私有 PDF 无效"));
    }

    let mut file = std::fs::File::open(actual_output)
        .map_err(|_| bridge_error("Office helper 生成的私有 PDF 不可读"))?;
    let mut signature = [0; PDF_SIGNATURE.len()];
    file.read_exact(&mut signature)
        .map_err(|_| bridge_error("Office helper 生成的私有 PDF 无效"))?;
    if signature != PDF_SIGNATURE {
        return Err(bridge_error("Office helper 输出不是 PDF 文件"));
    }
    Ok(())
}

fn combine_renderer_errors(word: &CommandError, wps: &CommandError) -> CommandError {
    let word_summary = renderer_summary(word);
    let wps_summary = renderer_summary(wps);
    let diagnostic = format!("Word: {word_summary}; WPS: {wps_summary}");

    if matches!(word.code, CommandErrorCode::WordRendererNotAvailable)
        && matches!(wps.code, CommandErrorCode::WpsRendererNotAvailable)
    {
        return CommandError::new(
            CommandErrorCode::WordRendererNotAvailable,
            "DOC/DOCX 转图片未能连接 Microsoft Word 或 WPS Office。请确认已安装且可手动打开文档，并允许本应用启动 Office；PDF 转图片不受影响。",
        )
        .with_stage(RendererStage::Launch)
        .with_diagnostic(diagnostic);
    }

    CommandError::new(
        CommandErrorCode::DocumentRendererExportFailed,
        "Microsoft Word 和 WPS Office 均未能导出文档",
    )
    .with_stage(RendererStage::Exporting)
    .with_diagnostic(diagnostic)
}

fn renderer_summary(error: &CommandError) -> String {
    let raw = match error.diagnostic.as_deref() {
        Some(diagnostic) => format!("{} ({diagnostic})", error.message),
        None => error.message.clone(),
    };
    raw.chars().take(135).collect()
}

fn bridge_error(message: &str) -> CommandError {
    CommandError::new(CommandErrorCode::DocumentRendererExportFailed, message)
        .with_stage(RendererStage::Bridging)
}

fn bridge_io_error(_error: std::io::Error) -> CommandError {
    bridge_error("无法创建私有 PDF 工作目录")
}

#[derive(Clone)]
pub struct HelperOfficeRenderer<R: Runtime> {
    app: tauri::AppHandle<R>,
}

impl<R: Runtime> HelperOfficeRenderer<R> {
    pub fn new(app: tauri::AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> OfficeRenderer for HelperOfficeRenderer<R> {
    fn render_to_pdf<'a>(
        &'a self,
        renderer: DocumentRendererKind,
        source: &'a Path,
        requested_output: &'a Path,
    ) -> OfficeRenderFuture<'a> {
        Box::pin(async move {
            run_helper(
                &self.app,
                &HelperRequest {
                    protocol_version: PROTOCOL_VERSION,
                    operation: HelperOperation::ConvertToPdf,
                    renderer,
                    source_path: source.to_path_buf(),
                    output_pdf_path: requested_output.to_path_buf(),
                },
            )
            .await?;
            Ok(requested_output.to_path_buf())
        })
    }
}
