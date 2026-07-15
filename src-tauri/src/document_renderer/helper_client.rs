//! Office helper sidecar 客户端：流式解析协议、限制诊断，并执行分阶段截止时间。

use std::future::Future;
use std::time::Duration;

use tauri::Runtime;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use super::error::{CommandError, CommandErrorCode, DocumentRendererKind, RendererStage};
use super::protocol::{
    FrameAccumulator, HelperFrame, HelperProgressStage, HelperRequest, HelperResult,
    MAX_FRAME_BYTES,
};

pub const STARTUP_TIMEOUT: Duration = Duration::from_secs(20);
pub const EXPORT_TIMEOUT: Duration = Duration::from_secs(120);
pub const OVERALL_TIMEOUT: Duration = Duration::from_secs(140);
pub const MAX_STDERR_BYTES: usize = 4 * 1024;

const HELPER_SIDECAR_BASENAME: &str = "document-renderer-helper";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HelperClientTimeouts {
    pub startup: Duration,
    pub export: Duration,
    pub overall: Duration,
}

impl Default for HelperClientTimeouts {
    fn default() -> Self {
        Self {
            startup: STARTUP_TIMEOUT,
            export: EXPORT_TIMEOUT,
            overall: OVERALL_TIMEOUT,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KillReason {
    StartupTimeout,
    ExportTimeout,
    OverallTimeout,
    ProtocolViolation,
    UnexpectedEof,
    TransportError,
}

#[derive(Debug)]
pub enum HelperEvent {
    Stdout(Vec<u8>),
    Stderr(Vec<u8>),
    StdoutEof,
    Time(Duration),
    TransportError(String),
}

/// 可由 fake-child 测试直接驱动的纯协议状态机。
#[derive(Debug)]
pub struct HelperClientSession {
    accumulator: FrameAccumulator,
    stdout_pending: Vec<u8>,
    stderr: Vec<u8>,
    source_path: String,
    output_path: String,
    renderer: DocumentRendererKind,
    timeouts: HelperClientTimeouts,
    elapsed: Duration,
    application_ready_at: Option<Duration>,
    terminal_ok: bool,
    failure: Option<CommandError>,
    kill_requested: bool,
    pending_kill: Option<KillReason>,
}

impl HelperClientSession {
    pub fn new(request: &HelperRequest, timeouts: HelperClientTimeouts) -> Self {
        Self {
            accumulator: FrameAccumulator::new(),
            stdout_pending: Vec::new(),
            stderr: Vec::new(),
            source_path: request.source_path.to_string_lossy().into_owned(),
            output_path: request.output_pdf_path.to_string_lossy().into_owned(),
            renderer: request.renderer,
            timeouts,
            elapsed: Duration::ZERO,
            application_ready_at: None,
            terminal_ok: false,
            failure: None,
            kill_requested: false,
            pending_kill: None,
        }
    }

    pub fn handle_event(
        &mut self,
        event: HelperEvent,
    ) -> Result<Option<HelperResult>, CommandError> {
        if let Some(error) = self.failure.clone() {
            return Err(error);
        }
        match event {
            HelperEvent::Stdout(chunk) => self.push_stdout(&chunk),
            HelperEvent::Stderr(chunk) => {
                self.push_stderr(&chunk);
                Ok(None)
            }
            HelperEvent::StdoutEof => self.finish_stdout(),
            HelperEvent::Time(elapsed) => self.check_time(elapsed),
            HelperEvent::TransportError(error) => {
                let error = CommandError::new(
                    CommandErrorCode::DocumentRendererExportFailed,
                    "Office helper 通信失败",
                )
                .with_stage(RendererStage::Exporting)
                .with_renderer(self.renderer)
                .with_diagnostic(self.redact(&error));
                Err(self.fail(error, Some(KillReason::TransportError)))
            }
        }
    }

    pub fn take_kill_reason(&mut self) -> Option<KillReason> {
        self.pending_kill.take()
    }

    pub fn stderr_diagnostic(&self) -> String {
        self.redact(&String::from_utf8_lossy(&self.stderr))
    }

    fn push_stdout(&mut self, chunk: &[u8]) -> Result<Option<HelperResult>, CommandError> {
        self.stdout_pending.extend_from_slice(chunk);
        if !self.stdout_pending.contains(&b'\n') && self.stdout_pending.len() > MAX_FRAME_BYTES {
            return Err(self.protocol_failure("输出帧超过长度上限", KillReason::ProtocolViolation));
        }

        let mut result = None;
        while let Some(newline) = self.stdout_pending.iter().position(|byte| *byte == b'\n') {
            let line: Vec<u8> = self.stdout_pending.drain(..=newline).collect();
            let line = std::str::from_utf8(&line).map_err(|_| {
                self.protocol_failure("输出帧不是 UTF-8", KillReason::ProtocolViolation)
            })?;
            let frame = self
                .accumulator
                .push_line(line)
                .map_err(|error| self.fail(error, Some(KillReason::ProtocolViolation)))?;
            result = self.accept_frame(frame)?;
        }
        if self.stdout_pending.len() > MAX_FRAME_BYTES {
            return Err(self.protocol_failure("输出帧超过长度上限", KillReason::ProtocolViolation));
        }
        Ok(result)
    }

    fn accept_frame(&mut self, frame: HelperFrame) -> Result<Option<HelperResult>, CommandError> {
        match frame {
            HelperFrame::Progress {
                stage: HelperProgressStage::ApplicationReady,
            } => {
                self.application_ready_at.get_or_insert(self.elapsed);
                Ok(None)
            }
            HelperFrame::Progress { .. } => Ok(None),
            HelperFrame::Result(HelperResult::Ok) => {
                self.terminal_ok = true;
                Ok(Some(HelperResult::Ok))
            }
            HelperFrame::Result(HelperResult::Err(error)) => {
                self.failure = Some(error.clone());
                Err(error)
            }
        }
    }

    fn finish_stdout(&mut self) -> Result<Option<HelperResult>, CommandError> {
        if !self.stdout_pending.is_empty() {
            let pending = std::mem::take(&mut self.stdout_pending);
            let line = std::str::from_utf8(&pending).map_err(|_| {
                self.protocol_failure("输出帧不是 UTF-8", KillReason::ProtocolViolation)
            })?;
            let frame = self
                .accumulator
                .push_line(line)
                .map_err(|error| self.fail(error, Some(KillReason::ProtocolViolation)))?;
            self.accept_frame(frame)?;
        }
        if self.terminal_ok {
            return Ok(Some(HelperResult::Ok));
        }
        Err(self.protocol_failure("helper 未返回终帧", KillReason::UnexpectedEof))
    }

    fn check_time(&mut self, elapsed: Duration) -> Result<Option<HelperResult>, CommandError> {
        self.elapsed = elapsed;
        if elapsed >= self.timeouts.overall {
            return Err(self.timeout(
                "Office 文档渲染超过总时限",
                RendererStage::Exporting,
                KillReason::OverallTimeout,
            ));
        }
        if self.terminal_ok {
            return Ok(Some(HelperResult::Ok));
        }
        if let Some(ready_at) = self.application_ready_at {
            if elapsed.saturating_sub(ready_at) >= self.timeouts.export {
                return Err(self.timeout(
                    "Office 文档导出超时",
                    RendererStage::Exporting,
                    KillReason::ExportTimeout,
                ));
            }
        } else if elapsed >= self.timeouts.startup {
            return Err(self.timeout(
                "Office 应用启动超时",
                RendererStage::Launch,
                KillReason::StartupTimeout,
            ));
        }
        Ok(None)
    }

    fn time_until_deadline(&self, elapsed: Duration) -> Duration {
        let overall = self.timeouts.overall.saturating_sub(elapsed);
        if self.terminal_ok {
            return overall;
        }
        let phase = match self.application_ready_at {
            Some(ready_at) => ready_at
                .saturating_add(self.timeouts.export)
                .saturating_sub(elapsed),
            None => self.timeouts.startup.saturating_sub(elapsed),
        };
        overall.min(phase)
    }

    fn push_stderr(&mut self, chunk: &[u8]) {
        if self.stderr.len() >= MAX_STDERR_BYTES {
            return;
        }
        let text = self.redact(&String::from_utf8_lossy(chunk));
        for character in text.chars() {
            let mut encoded = [0; 4];
            let bytes = character.encode_utf8(&mut encoded).as_bytes();
            if self.stderr.len() + bytes.len() > MAX_STDERR_BYTES {
                break;
            }
            self.stderr.extend_from_slice(bytes);
        }
    }

    fn redact(&self, text: &str) -> String {
        text.replace(&self.source_path, "[path]")
            .replace(&self.output_path, "[path]")
    }

    fn timeout(&mut self, message: &str, stage: RendererStage, reason: KillReason) -> CommandError {
        let error = CommandError::new(CommandErrorCode::DocumentRendererTimeout, message)
            .with_stage(stage)
            .with_renderer(self.renderer);
        self.fail(error, Some(reason))
    }

    fn protocol_failure(&mut self, message: &str, reason: KillReason) -> CommandError {
        self.fail(CommandError::protocol(message), Some(reason))
    }

    fn fail(&mut self, error: CommandError, reason: Option<KillReason>) -> CommandError {
        if !self.kill_requested {
            if let Some(reason) = reason {
                self.kill_requested = true;
                self.pending_kill = Some(reason);
            }
        }
        self.failure = Some(error.clone());
        error
    }
}

/// helper 子进程的最小可测试边界：写一次请求、收事件、终止当前子进程。
pub trait HelperTransport {
    fn write_request(&mut self, request_line: &[u8]) -> Result<(), CommandError>;
    fn next_event(&mut self) -> impl Future<Output = Option<HelperEvent>> + Send;
    fn kill_child(&mut self) -> Result<(), CommandError>;
}

/// 通过可注入 transport 执行一次 helper 会话。
pub async fn run_helper_with_transport<T: HelperTransport>(
    transport: &mut T,
    request: &HelperRequest,
    timeouts: HelperClientTimeouts,
) -> Result<(), CommandError> {
    let request_line = request.to_line()?;
    if let Err(error) = transport.write_request(request_line.as_bytes()) {
        let _ = transport.kill_child();
        return Err(error);
    }

    let started = std::time::Instant::now();
    let mut session = HelperClientSession::new(request, timeouts);
    loop {
        let elapsed = started.elapsed();
        if let Err(error) = session.handle_event(HelperEvent::Time(elapsed)) {
            kill_if_requested(&mut session, transport);
            return Err(error);
        }

        let wait = session.time_until_deadline(elapsed);
        let event = match tokio::time::timeout(wait, transport.next_event()).await {
            Ok(Some(event)) => event,
            Ok(None) => HelperEvent::StdoutEof,
            Err(_) => HelperEvent::Time(started.elapsed()),
        };
        let eof = matches!(event, HelperEvent::StdoutEof);
        match session.handle_event(event) {
            Ok(Some(HelperResult::Ok)) if eof => return Ok(()),
            Ok(_) => {}
            Err(error) => {
                kill_if_requested(&mut session, transport);
                return Err(error);
            }
        }
    }
}

/// 启动一次 Office helper 请求。失败或超时仅终止本次 sidecar 子进程。
pub async fn run_helper<R: Runtime>(
    app: &tauri::AppHandle<R>,
    request: &HelperRequest,
) -> Result<(), CommandError> {
    let command = app
        .shell()
        .sidecar(HELPER_SIDECAR_BASENAME)
        .map_err(|_| launch_error(request.renderer))?
        .set_raw_out(true);
    let (receiver, child) = command
        .spawn()
        .map_err(|_| launch_error(request.renderer))?;
    let mut transport = SidecarTransport {
        receiver,
        child: Some(child),
    };
    run_helper_with_transport(&mut transport, request, HelperClientTimeouts::default()).await
}

struct SidecarTransport {
    receiver: tauri::async_runtime::Receiver<CommandEvent>,
    child: Option<CommandChild>,
}

impl HelperTransport for SidecarTransport {
    fn write_request(&mut self, request_line: &[u8]) -> Result<(), CommandError> {
        self.child
            .as_mut()
            .ok_or_else(|| launch_error(DocumentRendererKind::Word))?
            .write(request_line)
            .map_err(|_| {
                CommandError::new(
                    CommandErrorCode::DocumentRendererExportFailed,
                    "无法向 Office helper 发送请求",
                )
                .with_stage(RendererStage::Launch)
            })
    }

    fn next_event(&mut self) -> impl Future<Output = Option<HelperEvent>> + Send {
        async move {
            match self.receiver.recv().await {
                Some(CommandEvent::Stdout(bytes)) => Some(HelperEvent::Stdout(bytes)),
                Some(CommandEvent::Stderr(bytes)) => Some(HelperEvent::Stderr(bytes)),
                Some(CommandEvent::Error(_)) => {
                    Some(HelperEvent::TransportError("helper transport error".into()))
                }
                Some(CommandEvent::Terminated(_)) | None => {
                    self.child = None;
                    Some(HelperEvent::StdoutEof)
                }
                Some(_) => Some(HelperEvent::TransportError(
                    "unsupported helper event".into(),
                )),
            }
        }
    }

    fn kill_child(&mut self) -> Result<(), CommandError> {
        if let Some(child) = self.child.take() {
            child.kill().map_err(|_| {
                CommandError::new(
                    CommandErrorCode::DocumentRendererExportFailed,
                    "无法终止 Office helper",
                )
                .with_stage(RendererStage::Cleanup)
            })?;
        }
        Ok(())
    }
}

fn kill_if_requested<T: HelperTransport>(session: &mut HelperClientSession, transport: &mut T) {
    if session.take_kill_reason().is_some() {
        let _ = transport.kill_child();
    }
}

fn launch_error(renderer: DocumentRendererKind) -> CommandError {
    CommandError::new(
        CommandErrorCode::DocumentRendererExportFailed,
        "无法启动 Office helper",
    )
    .with_stage(RendererStage::Launch)
    .with_renderer(renderer)
}
