//! Office 文档渲染 helper 边车。
//!
//! 读取恰好一个请求行，仅向 stdout 输出 JSON Lines 帧，随后以单个终帧收尾。
//! 真正的 COM 自动化后端在 Windows 下注入；非 Windows 返回结构化「不可用」。
//! stderr 诊断有界且不含路径。

use std::io::{BufRead, Write};

use imageasy_lib::document_renderer::error::{CommandError, DocumentRendererKind};
#[cfg(not(windows))]
use imageasy_lib::document_renderer::error::CommandErrorCode;
use imageasy_lib::document_renderer::protocol::{
    HelperFrame, HelperProgressStage, HelperRequest, HelperResult,
};

#[path = "../office_helper/automation.rs"]
mod automation;

#[cfg(windows)]
#[path = "../office_helper/windows_com.rs"]
mod windows_com;

use automation::run_conversion;

fn main() {
    let exit_code = real_main();
    std::process::exit(exit_code);
}

fn real_main() -> i32 {
    let stdin = std::io::stdin();
    let mut line = String::new();
    if stdin.lock().read_line(&mut line).unwrap_or(0) == 0 {
        emit_terminal(HelperResult::Err(
            CommandError::protocol("未收到请求").with_renderer(DocumentRendererKind::Word),
        ));
        return 1;
    }

    let request = match HelperRequest::from_line(&line) {
        Ok(request) => request,
        Err(error) => {
            emit_terminal(HelperResult::Err(error));
            return 1;
        }
    };

    let result = dispatch(&request);
    let failed = matches!(result, HelperResult::Err(_));
    emit_terminal(result);
    if failed {
        1
    } else {
        0
    }
}

/// 选择后端并执行一次转换。非 Windows 或缺少 COM 时返回结构化不可用。
fn dispatch(request: &HelperRequest) -> HelperResult {
    #[cfg(windows)]
    {
        match windows_com::backend_for(request.renderer) {
            Ok(mut backend) => run_conversion(backend.as_mut(), request, emit_progress),
            Err(error) => HelperResult::Err(error),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = request;
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
