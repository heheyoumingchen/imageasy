//! 渲染器中立的 Office 自动化编排。
//!
//! 定义 [`AutomationBackend`]：把「初始化 STA → 创建应用 → 配置安全 → 只读隐藏打开 →
//! 导出 PDF → 关闭文档 → 退出应用 → 释放代理 → 反初始化 COM」的安全顺序抽象成可注入接口。
//! [`run_conversion`] 保证：任何一步失败后，仍执行所有「安全的」剩余清理动作。
//! 真实 Windows COM 适配器在 `windows_com.rs`；测试用事件记录 fake 覆盖顺序与清理语义。

use imageasy_lib::document_renderer::error::CommandError;
use imageasy_lib::document_renderer::protocol::{HelperProgressStage, HelperRequest, HelperResult};

/// 渲染器中立的自动化后端。方法按安全顺序调用；实现负责单步语义。
pub trait AutomationBackend {
    /// 初始化 COM 单线程套间（STA）。必须先于任何对象创建。
    fn initialize_sta(&mut self) -> Result<(), CommandError>;
    /// 创建应用对象（Word.Application 或 KWPS/WPS.Application）。
    fn create_application(&mut self) -> Result<(), CommandError>;
    /// 配置安全：不可见、禁用警告、自动化安全、禁用链接更新。
    fn configure_security(&mut self) -> Result<(), CommandError>;
    /// 只读、隐藏地打开源文档。
    fn open_document(&mut self, source_path: &std::path::Path) -> Result<(), CommandError>;
    /// 导出为固定版式 PDF 到目标路径。
    fn export_pdf(&mut self, output_pdf_path: &std::path::Path) -> Result<(), CommandError>;
    /// 关闭文档（不保存）。
    fn close_document(&mut self) -> Result<(), CommandError>;
    /// 退出应用（不保存）。
    fn quit_application(&mut self) -> Result<(), CommandError>;
    /// 释放 COM 代理对象。
    fn release_proxies(&mut self);
    /// 反初始化 COM。
    fn uninitialize(&mut self);
}

/// 按安全顺序执行一次转换，并在任何失败后运行安全的剩余清理。
///
/// 进度回调在关键阶段被调用；清理阶段的失败不覆盖首个业务错误。
pub fn run_conversion<B, P>(
    backend: &mut B,
    request: &HelperRequest,
    mut emit_progress: P,
) -> HelperResult
where
    B: AutomationBackend + ?Sized,
    P: FnMut(HelperProgressStage),
{
    emit_progress(HelperProgressStage::Starting);

    // STA 必须先于对象创建。失败则无需任何清理（COM 未初始化、无代理）。
    if let Err(error) = backend.initialize_sta() {
        return HelperResult::Err(error);
    }

    // 从这里起，COM 已初始化：任何后续失败都必须至少 uninitialize。
    let outcome = run_after_sta(backend, request, &mut emit_progress);

    match outcome {
        Ok(()) => HelperResult::Ok,
        Err(error) => HelperResult::Err(error),
    }
}

/// STA 成功之后的序列；负责在失败路径上执行安全清理。
fn run_after_sta<B, P>(
    backend: &mut B,
    request: &HelperRequest,
    emit_progress: &mut P,
) -> Result<(), CommandError>
where
    B: AutomationBackend + ?Sized,
    P: FnMut(HelperProgressStage),
{
    // 创建应用。失败：无应用可退出，但需释放代理 + 反初始化。
    if let Err(error) = backend.create_application() {
        backend.release_proxies();
        backend.uninitialize();
        return Err(error);
    }
    emit_progress(HelperProgressStage::ApplicationReady);

    // 应用已创建：此后所有失败路径都要 quit + release + uninit。
    let business = run_with_application(backend, request, emit_progress);

    // 安全清理：退出应用、释放代理、反初始化 COM。始终执行。
    let quit = backend.quit_application();
    backend.release_proxies();
    backend.uninitialize();

    // 首个业务错误优先；业务成功时才暴露退出错误。
    business.and(quit)
}

/// 应用已就绪之后的序列：配置安全 → 打开 → 导出 → 关闭文档。
fn run_with_application<B, P>(
    backend: &mut B,
    request: &HelperRequest,
    emit_progress: &mut P,
) -> Result<(), CommandError>
where
    B: AutomationBackend + ?Sized,
    P: FnMut(HelperProgressStage),
{
    // 安全设置必须先于打开。
    backend.configure_security()?;

    // 打开文档。失败：无已打开文档可关闭，交由上层 quit。
    backend.open_document(&request.source_path)?;
    emit_progress(HelperProgressStage::DocumentOpened);

    // 文档已打开：无论导出成败都要关闭文档。
    emit_progress(HelperProgressStage::Exporting);
    let export = backend.export_pdf(&request.output_pdf_path);
    let close = backend.close_document();
    emit_progress(HelperProgressStage::Cleanup);

    // 导出错误优先；导出成功时才暴露关闭错误。
    export.and(close)
}

#[cfg(test)]
mod tests {
    use super::*;
    use imageasy_lib::document_renderer::error::{
        CommandError, CommandErrorCode, DocumentRendererKind,
    };
    use imageasy_lib::document_renderer::protocol::{HelperOperation, PROTOCOL_VERSION};
    use std::path::{Path, PathBuf};

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum Event {
        InitSta,
        CreateApp,
        ConfigureSecurity,
        OpenDocument,
        ExportPdf,
        CloseDocument,
        QuitApp,
        ReleaseProxies,
        Uninitialize,
    }

    struct FakeBackend {
        events: Vec<Event>,
        fail_at: Option<Event>,
    }

    impl FakeBackend {
        fn new() -> Self {
            Self {
                events: Vec::new(),
                fail_at: None,
            }
        }

        fn failing_at(event: Event) -> Self {
            Self {
                events: Vec::new(),
                fail_at: Some(event),
            }
        }

        fn record(&mut self, event: Event) -> Result<(), CommandError> {
            self.events.push(event);
            if self.fail_at == Some(event) {
                return Err(CommandError::new(
                    CommandErrorCode::DocumentRendererExportFailed,
                    "injected failure",
                ));
            }
            Ok(())
        }
    }

    impl AutomationBackend for FakeBackend {
        fn initialize_sta(&mut self) -> Result<(), CommandError> {
            self.record(Event::InitSta)
        }
        fn create_application(&mut self) -> Result<(), CommandError> {
            self.record(Event::CreateApp)
        }
        fn configure_security(&mut self) -> Result<(), CommandError> {
            self.record(Event::ConfigureSecurity)
        }
        fn open_document(&mut self, _source_path: &Path) -> Result<(), CommandError> {
            self.record(Event::OpenDocument)
        }
        fn export_pdf(&mut self, _output_pdf_path: &Path) -> Result<(), CommandError> {
            self.record(Event::ExportPdf)
        }
        fn close_document(&mut self) -> Result<(), CommandError> {
            self.record(Event::CloseDocument)
        }
        fn quit_application(&mut self) -> Result<(), CommandError> {
            self.record(Event::QuitApp)
        }
        fn release_proxies(&mut self) {
            self.events.push(Event::ReleaseProxies);
        }
        fn uninitialize(&mut self) {
            self.events.push(Event::Uninitialize);
        }
    }

    fn request() -> HelperRequest {
        HelperRequest {
            protocol_version: PROTOCOL_VERSION,
            operation: HelperOperation::ConvertToPdf,
            renderer: DocumentRendererKind::Word,
            source_path: PathBuf::from("C:/docs/a.docx"),
            output_pdf_path: PathBuf::from("C:/temp/bridge.pdf"),
        }
    }

    fn run(backend: &mut FakeBackend) -> HelperResult {
        run_conversion(backend, &request(), |_| {})
    }

    #[test]
    fn automation_emits_exact_progress_stages() {
        let mut backend = FakeBackend::new();
        let mut stages = Vec::new();
        let result = run_conversion(&mut backend, &request(), |stage| stages.push(stage));
        assert!(matches!(result, HelperResult::Ok));
        assert_eq!(
            stages,
            vec![
                HelperProgressStage::Starting,
                HelperProgressStage::ApplicationReady,
                HelperProgressStage::DocumentOpened,
                HelperProgressStage::Exporting,
                HelperProgressStage::Cleanup,
            ]
        );
    }

    #[test]
    fn automation_happy_path_runs_full_safe_sequence_in_order() {
        let mut backend = FakeBackend::new();
        let result = run(&mut backend);
        assert!(matches!(result, HelperResult::Ok));
        assert_eq!(
            backend.events,
            vec![
                Event::InitSta,
                Event::CreateApp,
                Event::ConfigureSecurity,
                Event::OpenDocument,
                Event::ExportPdf,
                Event::CloseDocument,
                Event::QuitApp,
                Event::ReleaseProxies,
                Event::Uninitialize,
            ]
        );
    }

    #[test]
    fn automation_sta_init_precedes_object_creation() {
        let mut backend = FakeBackend::new();
        run(&mut backend);
        let init = backend
            .events
            .iter()
            .position(|e| *e == Event::InitSta)
            .unwrap();
        let create = backend
            .events
            .iter()
            .position(|e| *e == Event::CreateApp)
            .unwrap();
        assert!(init < create);
    }

    #[test]
    fn automation_security_is_set_before_open() {
        let mut backend = FakeBackend::new();
        run(&mut backend);
        let security = backend
            .events
            .iter()
            .position(|e| *e == Event::ConfigureSecurity)
            .unwrap();
        let open = backend
            .events
            .iter()
            .position(|e| *e == Event::OpenDocument)
            .unwrap();
        assert!(security < open);
    }

    #[test]
    fn automation_export_precedes_close_quit_release_uninitialize() {
        let mut backend = FakeBackend::new();
        run(&mut backend);
        let idx = |target: Event| backend.events.iter().position(|e| *e == target).unwrap();
        let export = idx(Event::ExportPdf);
        assert!(export < idx(Event::CloseDocument));
        assert!(export < idx(Event::QuitApp));
        assert!(export < idx(Event::ReleaseProxies));
        assert!(export < idx(Event::Uninitialize));
    }

    #[test]
    fn automation_sta_failure_runs_no_cleanup() {
        let mut backend = FakeBackend::failing_at(Event::InitSta);
        let result = run(&mut backend);
        assert!(matches!(result, HelperResult::Err(_)));
        assert_eq!(backend.events, vec![Event::InitSta]);
    }

    #[test]
    fn automation_create_failure_releases_and_uninitializes_without_quit() {
        let mut backend = FakeBackend::failing_at(Event::CreateApp);
        let result = run(&mut backend);
        assert!(matches!(result, HelperResult::Err(_)));
        assert_eq!(
            backend.events,
            vec![
                Event::InitSta,
                Event::CreateApp,
                Event::ReleaseProxies,
                Event::Uninitialize
            ]
        );
        assert!(!backend.events.contains(&Event::QuitApp));
    }

    #[test]
    fn automation_open_failure_still_quits_releases_uninitializes() {
        let mut backend = FakeBackend::failing_at(Event::OpenDocument);
        let result = run(&mut backend);
        assert!(matches!(result, HelperResult::Err(_)));
        // 无已打开文档 → 不 close；但仍 quit + release + uninit。
        assert!(!backend.events.contains(&Event::CloseDocument));
        assert!(backend.events.contains(&Event::QuitApp));
        assert!(backend.events.contains(&Event::ReleaseProxies));
        assert!(backend.events.contains(&Event::Uninitialize));
    }

    #[test]
    fn automation_export_failure_still_closes_quits_and_cleans_up() {
        let mut backend = FakeBackend::failing_at(Event::ExportPdf);
        let result = run(&mut backend);
        assert!(matches!(result, HelperResult::Err(_)));
        // 导出失败仍要关闭文档 + 退出 + 清理。
        assert!(backend.events.contains(&Event::CloseDocument));
        assert!(backend.events.contains(&Event::QuitApp));
        assert!(backend.events.contains(&Event::ReleaseProxies));
        assert!(backend.events.contains(&Event::Uninitialize));
    }

    #[test]
    fn automation_export_error_takes_priority_over_cleanup_errors() {
        // 导出与关闭都失败时，暴露导出错误。
        let mut backend = FakeBackend::failing_at(Event::ExportPdf);
        let result = run(&mut backend);
        match result {
            HelperResult::Err(error) => {
                assert_eq!(error.code, CommandErrorCode::DocumentRendererExportFailed);
            }
            HelperResult::Ok => panic!("expected error"),
        }
    }
}
