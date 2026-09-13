//! Office helper sidecar 客户端：流式解析协议、限制诊断，并执行分阶段截止时间。

use std::future::Future;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use tauri::Runtime;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::mpsc;

use super::error::{CommandError, CommandErrorCode, DocumentRendererKind, RendererStage};
use super::protocol::{
    FrameAccumulator, HelperFrame, HelperProgressStage, HelperRequest, HelperResult,
    MAX_FRAME_BYTES,
};

pub const STARTUP_TIMEOUT: Duration = Duration::from_secs(20);
pub const EXPORT_TIMEOUT: Duration = Duration::from_secs(120);
pub const OVERALL_TIMEOUT: Duration = Duration::from_secs(140);
pub const MAX_STDERR_BYTES: usize = 4 * 1024;

// 与 tauri.conf.json bundle.externalBin 及 capabilities 中的 sidecar name 保持一致。
const HELPER_SIDECAR_BASENAME: &str = "binaries/document-renderer-helper";
const HELPER_BASENAME: &str = "document-renderer-helper";

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

/// 通过可注入 transport 执行一次 helper 请求。
/// 成功时在收到 Result 终帧后立即返回，**不**关闭子进程，便于多请求复用。
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
        match session.handle_event(event) {
            // 多请求会话：终帧即完成，无需等待 stdout EOF。
            Ok(Some(HelperResult::Ok)) => return Ok(()),
            Ok(_) => {}
            Err(error) => {
                kill_if_requested(&mut session, transport);
                return Err(error);
            }
        }
    }
}

/// 进程级 helper 连接池：同一应用生命周期内复用子进程，批量 Word 转换显著减少启动开销。
enum LiveTransport {
    Sidecar(SidecarTransport),
    Local(LocalProcessTransport),
}

impl HelperTransport for LiveTransport {
    fn write_request(&mut self, request_line: &[u8]) -> Result<(), CommandError> {
        match self {
            Self::Sidecar(transport) => transport.write_request(request_line),
            Self::Local(transport) => transport.write_request(request_line),
        }
    }

    async fn next_event(&mut self) -> Option<HelperEvent> {
        match self {
            Self::Sidecar(transport) => transport.next_event().await,
            Self::Local(transport) => transport.next_event().await,
        }
    }

    fn kill_child(&mut self) -> Result<(), CommandError> {
        match self {
            Self::Sidecar(transport) => transport.kill_child(),
            Self::Local(transport) => transport.kill_child(),
        }
    }
}

struct PooledHelper {
    transport: LiveTransport,
}

static HELPER_POOL: tokio::sync::Mutex<Option<PooledHelper>> = tokio::sync::Mutex::const_new(None);

/// 启动一次 Office helper 请求。成功时保留子进程供后续文档复用。
pub async fn run_helper<R: Runtime>(
    app: &tauri::AppHandle<R>,
    request: &HelperRequest,
) -> Result<(), CommandError> {
    use super::timing::log_stage_timing;
    use std::time::Instant;

    let timeouts = HelperClientTimeouts::default();
    let helper_started = Instant::now();

    // 先尝试复用已有 helper 进程。
    {
        let mut pool = HELPER_POOL.lock().await;
        if let Some(pooled) = pool.as_mut() {
            match run_helper_with_transport(&mut pooled.transport, request, timeouts).await {
                Ok(()) => {
                    log_stage_timing("helper_reuse", helper_started.elapsed());
                    return Ok(());
                }
                Err(error) => {
                    let _ = pooled.transport.kill_child();
                    *pool = None;
                    // 连接层失败则重建一次；业务错误（文档坏了）已带在 error 中，但 helper 也可能已死，仍重建。
                    // 对业务错误直接返回，避免把“文档打不开”重试成“找不到 helper”。
                    if !is_retryable_helper_error(&error) {
                        log_stage_timing("helper_failed", helper_started.elapsed());
                        return Err(error);
                    }
                }
            }
        }
    }

    let spawn_started = Instant::now();
    let mut transport = spawn_helper_transport(app, request.renderer).await?;
    log_stage_timing("helper_spawn", spawn_started.elapsed());
    match run_helper_with_transport(&mut transport, request, timeouts).await {
        Ok(()) => {
            let mut pool = HELPER_POOL.lock().await;
            *pool = Some(PooledHelper { transport });
            log_stage_timing("helper_export", helper_started.elapsed());
            Ok(())
        }
        Err(error) => {
            let _ = transport.kill_child();
            log_stage_timing("helper_failed", helper_started.elapsed());
            Err(error)
        }
    }
}

fn is_retryable_helper_error(error: &CommandError) -> bool {
    // 仅在 helper 进程/定位失败时重建；文档内容类业务错误直接返回。
    let message = error.message.as_str();
    message.contains("document-renderer-helper")
        || message.contains("通信失败")
        || message.contains("未找到")
        || message.contains("helper transport")
}

async fn spawn_helper_transport<R: Runtime>(
    app: &tauri::AppHandle<R>,
    renderer: DocumentRendererKind,
) -> Result<LiveTransport, CommandError> {
    let mut attempts: Vec<String> = Vec::new();

    // 1) 官方 externalBin sidecar 路径（正式安装包 / 正确 stage 后）。
    match app.shell().sidecar(HELPER_SIDECAR_BASENAME) {
        Ok(command) => match command.set_raw_out(true).spawn() {
            Ok((receiver, child)) => {
                return Ok(LiveTransport::Sidecar(SidecarTransport {
                    receiver,
                    child: Some(child),
                }));
            }
            Err(error) => attempts.push(format!("sidecar spawn: {error}")),
        },
        Err(error) => attempts.push(format!("sidecar resolve: {error}")),
    }

    // 2) 绝对路径 + 本地进程：不依赖 cwd，也不依赖 shell ACL 对任意路径的授权。
    for path in helper_binary_candidates() {
        if !path.is_file() {
            attempts.push(format!("missing: {}", path.display()));
            continue;
        }
        match spawn_local_helper_transport(&path) {
            Ok(transport) => return Ok(LiveTransport::Local(transport)),
            Err(error) => attempts.push(format!("{}: {error}", path.display())),
        }
    }

    Err(launch_error(
        renderer,
        Some(format!(
            "未找到可用的 document-renderer-helper。尝试：{}",
            attempts.join(" | ")
        )),
    ))
}

/// 编译期目标三元组（优先 TARGET，否则按平台推断）。
pub fn helper_host_triple() -> &'static str {
    if let Some(target) = option_env!("TARGET") {
        return target;
    }
    if cfg!(all(windows, target_arch = "x86_64")) {
        "x86_64-pc-windows-msvc"
    } else if cfg!(all(windows, target_arch = "aarch64")) {
        "aarch64-pc-windows-msvc"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "aarch64-apple-darwin"
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        "x86_64-apple-darwin"
    } else {
        "unknown"
    }
}

/// helper 可执行文件名候选（含 triple 与无 triple 两种）。
pub fn helper_candidate_file_names() -> Vec<String> {
    let triple = helper_host_triple();
    #[cfg(windows)]
    {
        vec![
            format!("{HELPER_BASENAME}-{triple}.exe"),
            format!("{HELPER_BASENAME}.exe"),
        ]
    }
    #[cfg(not(windows))]
    {
        vec![
            format!("{HELPER_BASENAME}-{triple}"),
            HELPER_BASENAME.to_string(),
        ]
    }
}

/// 解析 helper 绝对路径候选：当前 exe 同级 / binaries / 源码 binaries。
pub fn helper_binary_candidates() -> Vec<PathBuf> {
    let names = helper_candidate_file_names();
    let mut out = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            push_named_candidates(&mut out, dir, &names);
            push_named_candidates(&mut out, &dir.join("binaries"), &names);
            // tauri dev 有时从 target/debug 启动，源码 binaries 在 ../../binaries
            if let Some(parent) = dir.parent() {
                push_named_candidates(&mut out, &parent.join("binaries"), &names);
                if let Some(grand) = parent.parent() {
                    push_named_candidates(&mut out, &grand.join("binaries"), &names);
                }
            }
        }
    }

    // cargo/tauri 开发：直接使用 crate 内 staged binaries（不依赖 cwd）。
    let manifest_binaries = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
    push_named_candidates(&mut out, &manifest_binaries, &names);

    out
}

fn push_named_candidates(out: &mut Vec<PathBuf>, dir: &Path, names: &[String]) {
    for name in names {
        out.push(dir.join(name));
    }
}

/// 返回第一个实际存在的 helper 路径（供测试与诊断）。
pub fn resolve_existing_helper_path() -> Option<PathBuf> {
    helper_binary_candidates()
        .into_iter()
        .find(|path| path.is_file())
}

struct SidecarTransport {
    receiver: tauri::async_runtime::Receiver<CommandEvent>,
    child: Option<CommandChild>,
}

impl HelperTransport for SidecarTransport {
    fn write_request(&mut self, request_line: &[u8]) -> Result<(), CommandError> {
        self.child
            .as_mut()
            .ok_or_else(|| launch_error(DocumentRendererKind::Word, None))?
            .write(request_line)
            .map_err(|_| {
                CommandError::new(
                    CommandErrorCode::DocumentRendererExportFailed,
                    "无法向 Office helper 发送请求",
                )
                .with_stage(RendererStage::Launch)
            })
    }

    async fn next_event(&mut self) -> Option<HelperEvent> {
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

/// 本地绝对路径启动 helper（绕过 shell ACL 对任意 cmd 的限制，也不依赖 cwd）。
struct LocalProcessTransport {
    child: Option<Child>,
    events: mpsc::Receiver<HelperEvent>,
}

fn spawn_local_helper_transport(path: &Path) -> Result<LocalProcessTransport, String> {
    let mut command = Command::new(path);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // debug 构建的 helper 仍是控制台子系统，spawn 时抑制控制台窗口。
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("spawn failed: {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "helper stdout missing".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "helper stderr missing".to_string())?;

    let (tx, rx) = mpsc::channel::<HelperEvent>(64);
    let tx_stdout = tx.clone();
    std::thread::spawn(move || {
        let mut stdout = stdout;
        let mut buffer = [0_u8; 4096];
        loop {
            match stdout.read(&mut buffer) {
                Ok(0) => {
                    let _ = tx_stdout.blocking_send(HelperEvent::StdoutEof);
                    break;
                }
                Ok(n) => {
                    if tx_stdout
                        .blocking_send(HelperEvent::Stdout(buffer[..n].to_vec()))
                        .is_err()
                    {
                        break;
                    }
                }
                Err(_) => {
                    let _ = tx_stdout.blocking_send(HelperEvent::TransportError(
                        "helper stdout read failed".into(),
                    ));
                    break;
                }
            }
        }
    });
    std::thread::spawn(move || {
        let mut stderr = stderr;
        let mut buffer = [0_u8; 1024];
        loop {
            match stderr.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    if tx
                        .blocking_send(HelperEvent::Stderr(buffer[..n].to_vec()))
                        .is_err()
                    {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    Ok(LocalProcessTransport {
        child: Some(child),
        events: rx,
    })
}

impl HelperTransport for LocalProcessTransport {
    fn write_request(&mut self, request_line: &[u8]) -> Result<(), CommandError> {
        let child = self
            .child
            .as_mut()
            .ok_or_else(|| launch_error(DocumentRendererKind::Word, None))?;
        let stdin = child.stdin.as_mut().ok_or_else(|| {
            CommandError::new(
                CommandErrorCode::DocumentRendererExportFailed,
                "无法向 Office helper 发送请求",
            )
            .with_stage(RendererStage::Launch)
        })?;
        stdin.write_all(request_line).map_err(|_| {
            CommandError::new(
                CommandErrorCode::DocumentRendererExportFailed,
                "无法向 Office helper 发送请求",
            )
            .with_stage(RendererStage::Launch)
        })?;
        stdin.flush().map_err(|_| {
            CommandError::new(
                CommandErrorCode::DocumentRendererExportFailed,
                "无法向 Office helper 发送请求",
            )
            .with_stage(RendererStage::Launch)
        })?;
        Ok(())
    }

    async fn next_event(&mut self) -> Option<HelperEvent> {
        self.events.recv().await
    }

    fn kill_child(&mut self) -> Result<(), CommandError> {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        Ok(())
    }
}

fn kill_if_requested<T: HelperTransport>(session: &mut HelperClientSession, transport: &mut T) {
    if session.take_kill_reason().is_some() {
        let _ = transport.kill_child();
    }
}

fn launch_error(renderer: DocumentRendererKind, detail: Option<String>) -> CommandError {
    let (code, message) = match renderer {
        DocumentRendererKind::Word => (
            CommandErrorCode::WordRendererNotAvailable,
            "无法启动 Word 转换组件：未找到 document-renderer-helper。请重新安装应用，或在开发环境先运行 pnpm ensure:sidecar && node scripts/stage-sidecar.mjs --profile debug。",
        ),
        DocumentRendererKind::Wps => (
            CommandErrorCode::WpsRendererNotAvailable,
            "无法启动 WPS 转换组件：未找到 document-renderer-helper。请重新安装应用，或在开发环境先运行 pnpm ensure:sidecar && node scripts/stage-sidecar.mjs --profile debug。",
        ),
        DocumentRendererKind::Pdfium => (
            CommandErrorCode::DocumentRendererExportFailed,
            "无法启动文档转换组件",
        ),
    };
    let mut error = CommandError::new(code, message)
        .with_stage(RendererStage::Launch)
        .with_renderer(renderer);
    if let Some(detail) = detail {
        error = error.with_diagnostic(detail);
    }
    error
}

#[cfg(test)]
mod helper_path_tests {
    use super::*;

    #[test]
    fn helper_candidate_names_include_triple_and_plain() {
        let names = helper_candidate_file_names();
        assert!(names.iter().any(|name| name.contains(HELPER_BASENAME)));
        assert!(names.iter().any(|name| name.contains(helper_host_triple())));
    }

    #[test]
    fn helper_candidates_include_manifest_binaries_dir() {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
        let candidates = helper_binary_candidates();
        assert!(
            candidates.iter().any(|path| path.starts_with(&manifest)),
            "expected candidates under {}",
            manifest.display()
        );
    }

    #[test]
    fn resolve_existing_helper_finds_staged_binary_when_present() {
        // 仓库 binaries 中若已 stage，应能解析到真实文件，且不依赖 cwd。
        if let Some(path) = resolve_existing_helper_path() {
            assert!(path.is_file(), "{}", path.display());
            assert!(
                path.file_name()
                    .and_then(|value| value.to_str())
                    .is_some_and(|name| name.contains(HELPER_BASENAME)),
                "unexpected helper name: {}",
                path.display()
            );
        }
    }
}
