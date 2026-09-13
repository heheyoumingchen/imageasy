// GUI 子系统：避免每次被主程序 spawn 时带出控制台窗口（协议走管道，不依赖控制台）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Office 文档渲染 helper 边车。
//!
//! 支持多请求会话：从 stdin 连续读取请求行，每行处理完后写一个 Result 终帧。
//! 同一渲染器（Word / WPS）会复用已启动的 Office 实例，stdin 关闭时再退出 Office。
//! 真正的 COM 自动化后端在 Windows 下注入；非 Windows 返回结构化「不可用」。

use std::io::{BufRead, Write};

use imageasy_lib::document_renderer::error::DocumentRendererKind;
#[cfg(not(windows))]
use imageasy_lib::document_renderer::error::{CommandError, CommandErrorCode};
use imageasy_lib::document_renderer::protocol::{
    HelperFrame, HelperProgressStage, HelperRequest, HelperResult,
};

#[path = "../office_helper/automation.rs"]
mod automation;

#[cfg(windows)]
#[path = "../office_helper/windows_com.rs"]
mod windows_com;

use automation::{
    bootstrap_application, export_opened_document, shutdown_application, AutomationBackend,
};

fn main() {
    let exit_code = real_main();
    std::process::exit(exit_code);
}

fn real_main() -> i32 {
    let stdin = std::io::stdin();
    let mut input = stdin.lock();
    let mut line = String::new();
    let mut any_failure = false;
    let mut session: Option<OfficeSession> = None;

    loop {
        line.clear();
        let read = input.read_line(&mut line).unwrap_or(0);
        if read == 0 {
            break;
        }
        if line.trim().is_empty() {
            continue;
        }

        let request = match HelperRequest::from_line(&line) {
            Ok(request) => request,
            Err(error) => {
                any_failure = true;
                emit_terminal(HelperResult::Err(error));
                continue;
            }
        };

        let result = dispatch_with_session(&mut session, &request);
        if matches!(result, HelperResult::Err(_)) {
            any_failure = true;
            // 业务失败后丢弃会话，避免污染后续文档。
            if let Some(mut active) = session.take() {
                let _ = shutdown_application(active.backend.as_mut());
            }
        }
        emit_terminal(result);
    }

    if let Some(mut active) = session.take() {
        let _ = shutdown_application(active.backend.as_mut());
    }

    if any_failure {
        1
    } else {
        0
    }
}

struct OfficeSession {
    renderer: DocumentRendererKind,
    backend: Box<dyn AutomationBackend>,
}

fn dispatch_with_session(
    session: &mut Option<OfficeSession>,
    request: &HelperRequest,
) -> HelperResult {
    #[cfg(windows)]
    {
        emit_progress(HelperProgressStage::Starting);

        if let Some(active) = session.as_ref() {
            if active.renderer != request.renderer {
                if let Some(mut previous) = session.take() {
                    let _ = shutdown_application(previous.backend.as_mut());
                }
            }
        }

        if session.is_none() {
            let mut backend = match windows_com::backend_for(request.renderer) {
                Ok(backend) => backend,
                Err(error) => return HelperResult::Err(error),
            };
            let mut emit = emit_progress;
            if let Err(error) = bootstrap_application(backend.as_mut(), &mut emit) {
                return HelperResult::Err(error);
            }
            *session = Some(OfficeSession {
                renderer: request.renderer,
                backend,
            });
        }

        let active = session
            .as_mut()
            .expect("Office session must exist after bootstrap");
        let mut emit = emit_progress;
        match export_opened_document(active.backend.as_mut(), request, &mut emit) {
            Ok(()) => HelperResult::Ok,
            Err(error) => HelperResult::Err(error),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = session;
        HelperResult::Err(
            CommandError::new(
                unavailable_code(request.renderer),
                "当前平台不支持 Office 文档渲染",
            )
            .with_renderer(request.renderer),
        )
    }
}

#[cfg(not(windows))]
fn unavailable_code(renderer: DocumentRendererKind) -> CommandErrorCode {
    match renderer {
        DocumentRendererKind::Wps => CommandErrorCode::WpsRendererNotAvailable,
        _ => CommandErrorCode::WordRendererNotAvailable,
    }
}

fn emit_progress(stage: HelperProgressStage) {
    emit_frame(HelperFrame::Progress { stage });
}

fn emit_terminal(result: HelperResult) {
    emit_frame(HelperFrame::Result(result));
}

fn emit_frame(frame: HelperFrame) {
    match frame.to_line() {
        Ok(line) => {
            let stdout = std::io::stdout();
            let mut handle = stdout.lock();
            let _ = handle.write_all(line.as_bytes());
            let _ = handle.flush();
        }
        Err(error) => {
            // 帧超限属内部错误，降级为最小固定错误行，绝不 panic。
            let _ = writeln!(
                std::io::stdout(),
                "{{\"type\":\"result\",\"Err\":{{\"code\":\"INTERNAL_ERROR\",\"message\":\"帧序列化失败\"}}}}"
            );
            let _ = error;
        }
    }
}
