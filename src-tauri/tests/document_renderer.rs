//! 文档渲染路由、串行化与私有 PDF 生命周期测试。

use std::collections::VecDeque;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use imageasy_lib::document_renderer::coordinator::{
    prepare_document, with_prepared_document, DocumentRoute, OfficeRenderer, PreparedDocument,
};
use imageasy_lib::document_renderer::error::{
    CommandError, CommandErrorCode, DocumentRendererKind, RendererStage, DIAGNOSTIC_MAX_CHARS,
};

type RenderFuture<'a> = Pin<Box<dyn Future<Output = Result<PathBuf, CommandError>> + Send + 'a>>;

#[derive(Clone)]
enum Outcome {
    Valid,
    Missing,
    Empty,
    Directory,
    NonPdf,
    Unreadable,
    Outside(PathBuf),
    Error(CommandError),
}

#[derive(Clone)]
struct FakeRenderer {
    outcomes: Arc<Mutex<VecDeque<Outcome>>>,
    calls: Arc<Mutex<Vec<DocumentRendererKind>>>,
    work_dirs: Arc<Mutex<Vec<PathBuf>>>,
    active: Arc<AtomicUsize>,
    peak: Arc<AtomicUsize>,
    locked_files: Arc<Mutex<Vec<std::fs::File>>>,
    delay: Duration,
}

impl FakeRenderer {
    fn new(outcomes: impl IntoIterator<Item = Outcome>) -> Self {
        Self {
            outcomes: Arc::new(Mutex::new(outcomes.into_iter().collect())),
            calls: Arc::new(Mutex::new(Vec::new())),
            work_dirs: Arc::new(Mutex::new(Vec::new())),
            active: Arc::new(AtomicUsize::new(0)),
            peak: Arc::new(AtomicUsize::new(0)),
            locked_files: Arc::new(Mutex::new(Vec::new())),
            delay: Duration::ZERO,
        }
    }

    fn delayed(outcomes: impl IntoIterator<Item = Outcome>) -> Self {
        let mut renderer = Self::new(outcomes);
        renderer.delay = Duration::from_millis(30);
        renderer
    }

    fn calls(&self) -> Vec<DocumentRendererKind> {
        self.calls.lock().unwrap().clone()
    }

    fn work_dirs(&self) -> Vec<PathBuf> {
        self.work_dirs.lock().unwrap().clone()
    }
}

impl OfficeRenderer for FakeRenderer {
    fn render_to_pdf<'a>(
        &'a self,
        renderer: DocumentRendererKind,
        _source: &'a Path,
        requested_output: &'a Path,
    ) -> RenderFuture<'a> {
        Box::pin(async move {
            self.calls.lock().unwrap().push(renderer);
            self.work_dirs
                .lock()
                .unwrap()
                .push(requested_output.parent().unwrap().to_path_buf());
            let active = self.active.fetch_add(1, Ordering::SeqCst) + 1;
            self.peak.fetch_max(active, Ordering::SeqCst);
            if !self.delay.is_zero() {
                tokio::time::sleep(self.delay).await;
            }
            let outcome = self.outcomes.lock().unwrap().pop_front().unwrap();
            let result = match outcome {
                Outcome::Valid => {
                    std::fs::write(requested_output, b"%PDF-1.7\nvalid").unwrap();
                    Ok(requested_output.to_path_buf())
                }
                Outcome::Missing => Ok(requested_output.to_path_buf()),
                Outcome::Empty => {
                    std::fs::write(requested_output, b"").unwrap();
                    Ok(requested_output.to_path_buf())
                }
                Outcome::Directory => {
                    std::fs::create_dir(requested_output).unwrap();
                    Ok(requested_output.to_path_buf())
                }
                Outcome::NonPdf => {
                    std::fs::write(requested_output, b"not a PDF").unwrap();
                    Ok(requested_output.to_path_buf())
                }
                Outcome::Unreadable => {
                    lock_pdf_for_test(requested_output, &self.locked_files);
                    Ok(requested_output.to_path_buf())
                }
                Outcome::Outside(path) => {
                    std::fs::write(&path, b"%PDF-1.7\noutside").unwrap();
                    Ok(path)
                }
                Outcome::Error(error) => Err(error),
            };
            self.active.fetch_sub(1, Ordering::SeqCst);
            result
        })
    }
}

#[cfg(windows)]
fn lock_pdf_for_test(path: &Path, handles: &Mutex<Vec<std::fs::File>>) {
    use std::os::windows::fs::OpenOptionsExt;

    let mut options = std::fs::OpenOptions::new();
    options
        .write(true)
        .create(true)
        .truncate(true)
        .share_mode(0);
    let mut file = options.open(path).unwrap();
    std::io::Write::write_all(&mut file, b"%PDF-1.7\nlocked").unwrap();
    handles.lock().unwrap().push(file);
}

#[cfg(not(windows))]
fn lock_pdf_for_test(path: &Path, _handles: &Mutex<Vec<std::fs::File>>) {
    std::fs::write(path, b"%PDF-1.7\nlocked").unwrap();
}

fn renderer_error(
    code: CommandErrorCode,
    renderer: DocumentRendererKind,
    message: &str,
) -> CommandError {
    CommandError::new(code, message)
        .with_renderer(renderer)
        .with_stage(RendererStage::Exporting)
}

fn assert_private_pdf(prepared: &PreparedDocument) -> &Path {
    match prepared {
        PreparedDocument::PrivatePdf(bridge) => bridge.path(),
        PreparedDocument::DirectPdf(_) => panic!("expected private PDF"),
    }
}

#[test]
fn document_route_table_is_explicit() {
    assert_eq!(
        DocumentRoute::for_path(Path::new("a.pdf")).unwrap(),
        DocumentRoute::Pdf
    );
    assert_eq!(
        DocumentRoute::for_path(Path::new("a.docx")).unwrap(),
        DocumentRoute::WordThenWps
    );
    assert_eq!(
        DocumentRoute::for_path(Path::new("a.DOC")).unwrap(),
        DocumentRoute::WordThenWps
    );
    assert_eq!(
        DocumentRoute::for_path(Path::new("a.wps")).unwrap(),
        DocumentRoute::WpsOnly
    );
    assert!(DocumentRoute::for_path(Path::new("a.pptx")).is_err());
}

#[tokio::test]
async fn document_renderer_docx_and_doc_use_word_when_it_succeeds() {
    for extension in ["docx", "doc"] {
        let renderer = FakeRenderer::new([Outcome::Valid]);
        let prepared = prepare_document(Path::new(&format!("report.{extension}")), &renderer)
            .await
            .unwrap();
        assert_eq!(renderer.calls(), vec![DocumentRendererKind::Word]);
        assert!(assert_private_pdf(&prepared).starts_with(&renderer.work_dirs()[0]));
    }
}

#[tokio::test]
async fn document_renderer_word_failures_fall_back_to_wps() {
    let cases = [
        Outcome::Error(renderer_error(
            CommandErrorCode::WordRendererNotAvailable,
            DocumentRendererKind::Word,
            "Word unavailable",
        )),
        Outcome::Error(renderer_error(
            CommandErrorCode::DocumentRendererExportFailed,
            DocumentRendererKind::Word,
            "Word export failed",
        )),
        Outcome::Error(renderer_error(
            CommandErrorCode::DocumentRendererTimeout,
            DocumentRendererKind::Word,
            "Word timed out",
        )),
        Outcome::NonPdf,
    ];

    for first_outcome in cases {
        let renderer = FakeRenderer::new([first_outcome, Outcome::Valid]);
        prepare_document(Path::new("report.docx"), &renderer)
            .await
            .unwrap();
        assert_eq!(
            renderer.calls(),
            vec![DocumentRendererKind::Word, DocumentRendererKind::Wps]
        );
    }
}

#[tokio::test]
async fn document_renderer_reports_both_unavailable() {
    let renderer = FakeRenderer::new([
        Outcome::Error(renderer_error(
            CommandErrorCode::WordRendererNotAvailable,
            DocumentRendererKind::Word,
            "Word unavailable",
        )),
        Outcome::Error(renderer_error(
            CommandErrorCode::WpsRendererNotAvailable,
            DocumentRendererKind::Wps,
            "WPS unavailable",
        )),
    ]);

    let error = prepare_document(Path::new("report.docx"), &renderer)
        .await
        .unwrap_err();
    assert_eq!(error.code, CommandErrorCode::WordRendererNotAvailable);
    assert!(error.message.contains("Microsoft Word 或 WPS Office"));
}

#[tokio::test]
async fn document_renderer_both_export_failures_keep_two_bounded_summaries() {
    let renderer = FakeRenderer::new([
        Outcome::Error(renderer_error(
            CommandErrorCode::DocumentRendererExportFailed,
            DocumentRendererKind::Word,
            &format!("word {}", "x".repeat(500)),
        )),
        Outcome::Error(renderer_error(
            CommandErrorCode::DocumentRendererExportFailed,
            DocumentRendererKind::Wps,
            &format!("wps {}", "y".repeat(500)),
        )),
    ]);

    let error = prepare_document(Path::new("report.doc"), &renderer)
        .await
        .unwrap_err();
    assert_eq!(error.code, CommandErrorCode::DocumentRendererExportFailed);
    let diagnostic = error.diagnostic.unwrap();
    assert!(diagnostic.contains("Word:"));
    assert!(diagnostic.contains("WPS:"));
    assert!(diagnostic.chars().count() <= DIAGNOSTIC_MAX_CHARS);
}

#[tokio::test]
async fn document_renderer_wps_input_never_uses_word() {
    let renderer = FakeRenderer::new([Outcome::Valid]);
    prepare_document(Path::new("report.wps"), &renderer)
        .await
        .unwrap();
    assert_eq!(renderer.calls(), vec![DocumentRendererKind::Wps]);
}

#[tokio::test]
async fn document_renderer_direct_pdf_bypasses_office() {
    let renderer = FakeRenderer::new([]);
    let prepared = prepare_document(Path::new("report.pdf"), &renderer)
        .await
        .unwrap();
    assert_eq!(prepared.path(), Path::new("report.pdf"));
    assert_eq!(renderer.calls(), Vec::<DocumentRendererKind>::new());
}

#[tokio::test]
async fn document_renderer_serializes_concurrent_office_exports() {
    let renderer = FakeRenderer::delayed([Outcome::Valid, Outcome::Valid]);
    let (first, second) = tokio::join!(
        prepare_document(Path::new("first.docx"), &renderer),
        prepare_document(Path::new("second.docx"), &renderer),
    );
    first.unwrap();
    second.unwrap();
    assert_eq!(renderer.peak.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn document_renderer_validates_private_pdf_shape() {
    for outcome in [
        Outcome::Missing,
        Outcome::Empty,
        Outcome::Directory,
        Outcome::NonPdf,
    ] {
        let renderer = FakeRenderer::new([outcome]);
        let error = prepare_document(Path::new("report.wps"), &renderer)
            .await
            .unwrap_err();
        assert_eq!(error.code, CommandErrorCode::DocumentRendererExportFailed);
        assert_eq!(error.stage, Some(RendererStage::Bridging));
    }
}

#[cfg(windows)]
#[tokio::test]
async fn document_renderer_rejects_unreadable_private_pdf() {
    let renderer = FakeRenderer::new([Outcome::Unreadable]);
    let error = prepare_document(Path::new("report.wps"), &renderer)
        .await
        .unwrap_err();
    assert_eq!(error.code, CommandErrorCode::DocumentRendererExportFailed);
    assert_eq!(error.stage, Some(RendererStage::Bridging));
}

#[tokio::test]
async fn document_renderer_rejects_output_outside_parent_temp_dir() {
    let outside = tempfile::tempdir().unwrap();
    let outside_pdf = outside.path().join("outside.pdf");
    let renderer = FakeRenderer::new([Outcome::Outside(outside_pdf.clone())]);

    let error = prepare_document(Path::new("report.wps"), &renderer)
        .await
        .unwrap_err();
    assert_eq!(error.code, CommandErrorCode::DocumentRendererExportFailed);
    assert_eq!(error.stage, Some(RendererStage::Bridging));
    assert!(outside_pdf.exists());
}

#[tokio::test]
async fn document_renderer_bridge_is_fixed_private_name_and_cleans_on_drop() {
    let renderer = FakeRenderer::new([Outcome::Valid]);
    let prepared = prepare_document(Path::new("report.docx"), &renderer)
        .await
        .unwrap();
    let bridge = assert_private_pdf(&prepared).to_path_buf();
    assert_eq!(bridge.file_name().unwrap(), "bridge.pdf");
    assert_eq!(bridge.parent().unwrap(), renderer.work_dirs()[0]);
    assert!(bridge.exists());

    drop(prepared);
    assert!(!bridge.exists());
    assert!(!bridge.parent().unwrap().exists());
}

#[tokio::test]
async fn document_renderer_keeps_bridge_private_during_downstream_work() {
    let output_dir = tempfile::tempdir().unwrap();
    let renderer = FakeRenderer::new([Outcome::Valid]);
    let mut seen_bridge = None;

    let result = with_prepared_document(Path::new("report.docx"), &renderer, |pdf| {
        seen_bridge = Some(pdf.to_path_buf());
        assert!(pdf.exists());
        std::fs::write(output_dir.path().join("report.png"), b"image").unwrap();
        Ok::<_, CommandError>(())
    })
    .await;
    result.unwrap();

    let bridge = seen_bridge.unwrap();
    assert!(!bridge.exists());
    assert!(!output_dir.path().join("bridge.pdf").exists());
    assert!(output_dir.path().join("report.png").exists());
}

#[tokio::test]
async fn document_renderer_cleans_bridge_after_downstream_failure() {
    for stage in [RendererStage::Rasterizing, RendererStage::Encoding] {
        let renderer = FakeRenderer::new([Outcome::Valid]);
        let mut bridge = None;
        let result = with_prepared_document(Path::new("report.docx"), &renderer, |pdf| {
            bridge = Some(pdf.to_path_buf());
            Err::<(), _>(
                CommandError::new(CommandErrorCode::PdfRendererBindFailed, "downstream failed")
                    .with_stage(stage),
            )
        })
        .await;
        assert!(result.is_err());
        assert!(!bridge.unwrap().exists());
    }
}

#[tokio::test]
async fn document_renderer_cleans_temp_dir_after_helper_and_timeout_failures() {
    for error in [
        renderer_error(
            CommandErrorCode::DocumentRendererExportFailed,
            DocumentRendererKind::Wps,
            "export failed",
        ),
        renderer_error(
            CommandErrorCode::DocumentRendererTimeout,
            DocumentRendererKind::Wps,
            "timed out",
        ),
    ] {
        let renderer = FakeRenderer::new([Outcome::Error(error)]);
        assert!(prepare_document(Path::new("report.wps"), &renderer)
            .await
            .is_err());
        let work_dir = renderer.work_dirs().pop().unwrap();
        assert!(!work_dir.exists());
    }
}

#[tokio::test]
async fn document_renderer_releases_mutex_before_downstream_consumption() {
    let renderer = FakeRenderer::new([Outcome::Valid, Outcome::Valid]);
    let first = prepare_document(Path::new("first.docx"), &renderer)
        .await
        .unwrap();

    let second = tokio::time::timeout(
        Duration::from_millis(100),
        prepare_document(Path::new("second.docx"), &renderer),
    )
    .await
    .expect("Office mutex must be released after bridge validation")
    .unwrap();

    assert!(first.path().exists());
    assert!(second.path().exists());
}
