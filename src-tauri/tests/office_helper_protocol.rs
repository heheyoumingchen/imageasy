//! Office helper 协议的边界与安全约束测试（通过公开协议 API）。

use imageasy_lib::document_renderer::error::{
    CommandError, CommandErrorCode, DocumentRendererKind, RendererStage,
};
use imageasy_lib::document_renderer::helper_client::{
    run_helper_with_transport, HelperClientSession, HelperClientTimeouts, HelperEvent,
    HelperTransport, KillReason, EXPORT_TIMEOUT, MAX_STDERR_BYTES, OVERALL_TIMEOUT,
    STARTUP_TIMEOUT,
};
use imageasy_lib::document_renderer::protocol::{
    FrameAccumulator, HelperFrame, HelperOperation, HelperProgressStage, HelperRequest,
    HelperResult, MAX_FRAME_BYTES, MAX_REQUEST_BYTES, PROTOCOL_VERSION,
};
use std::path::PathBuf;
use std::time::Duration;

fn sample_request() -> HelperRequest {
    HelperRequest {
        protocol_version: PROTOCOL_VERSION,
        operation: HelperOperation::ConvertToPdf,
        renderer: DocumentRendererKind::Word,
        source_path: PathBuf::from("C:/docs/secret-report.docx"),
        output_pdf_path: PathBuf::from("C:/temp/bridge.pdf"),
    }
}

#[test]
fn request_roundtrips_as_single_json_line() {
    let request = sample_request();
    let line = request.to_line().unwrap();
    assert!(line.ends_with('\n'));
    assert_eq!(line.matches('\n').count(), 1);
    assert_eq!(HelperRequest::from_line(&line).unwrap(), request);
}

#[test]
fn request_rejects_wrong_protocol_version() {
    let mut request = sample_request();
    request.protocol_version = 42;
    let raw = serde_json::to_string(&request).unwrap();
    let error = HelperRequest::from_line(&raw).unwrap_err();
    assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
}

#[test]
fn request_rejects_unknown_renderer() {
    let raw = r#"{"protocolVersion":1,"operation":"convertToPdf","renderer":"excel","sourcePath":"a","outputPdfPath":"b"}"#;
    let error = HelperRequest::from_line(raw).unwrap_err();
    assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
}

#[test]
fn request_rejects_oversized_line() {
    let huge = "z".repeat(MAX_REQUEST_BYTES + 10);
    let error = HelperRequest::from_line(&huge).unwrap_err();
    assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
}

#[test]
fn frames_roundtrip_progress_and_terminal_result() {
    let progress = HelperFrame::Progress {
        stage: HelperProgressStage::Exporting,
    };
    assert_eq!(
        HelperFrame::from_line(&progress.to_line().unwrap()).unwrap(),
        progress
    );

    let terminal = HelperFrame::Result(HelperResult::Ok);
    let parsed = HelperFrame::from_line(&terminal.to_line().unwrap()).unwrap();
    assert_eq!(parsed, terminal);
    assert!(parsed.is_terminal());
}

#[test]
fn frame_rejects_oversized_frame() {
    let error = HelperFrame::from_line(&"q".repeat(MAX_FRAME_BYTES + 1)).unwrap_err();
    assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
}

#[test]
fn accumulator_rejects_data_after_terminal_result() {
    let mut acc = FrameAccumulator::new();
    acc.push_line(&HelperFrame::Result(HelperResult::Ok).to_line().unwrap())
        .unwrap();
    let progress = HelperFrame::Progress {
        stage: HelperProgressStage::Cleanup,
    }
    .to_line()
    .unwrap();
    let error = acc.push_line(&progress).unwrap_err();
    assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
}

#[test]
fn serialized_result_never_contains_source_or_output_paths() {
    let request = sample_request();
    let line = HelperFrame::Result(HelperResult::Ok).to_line().unwrap();
    assert!(!line.contains("secret-report"));
    assert!(!line.contains("bridge.pdf"));
    // 请求行本身包含路径是允许的（父→子），但结果帧不得回带。
    let request_line = request.to_line().unwrap();
    assert!(request_line.contains("secret-report"));
}

fn test_timeouts() -> HelperClientTimeouts {
    HelperClientTimeouts {
        startup: STARTUP_TIMEOUT,
        export: EXPORT_TIMEOUT,
        overall: OVERALL_TIMEOUT,
    }
}

fn frame_bytes(frame: HelperFrame) -> Vec<u8> {
    frame.to_line().unwrap().into_bytes()
}

#[test]
fn helper_client_named_deadlines_match_contract() {
    assert_eq!(STARTUP_TIMEOUT, Duration::from_secs(20));
    assert_eq!(EXPORT_TIMEOUT, Duration::from_secs(120));
    assert_eq!(OVERALL_TIMEOUT, Duration::from_secs(140));
}

#[test]
fn helper_client_parses_arbitrarily_split_stdout_chunks() {
    let request = sample_request();
    let mut session = HelperClientSession::new(&request, test_timeouts());
    session
        .handle_event(HelperEvent::Time(Duration::from_secs(1)))
        .unwrap();

    let mut stream = frame_bytes(HelperFrame::Progress {
        stage: HelperProgressStage::ApplicationReady,
    });
    stream.extend(frame_bytes(HelperFrame::Progress {
        stage: HelperProgressStage::Exporting,
    }));
    stream.extend(frame_bytes(HelperFrame::Result(HelperResult::Ok)));

    let mut completed = false;
    for byte in stream {
        completed = session
            .handle_event(HelperEvent::Stdout(vec![byte]))
            .unwrap()
            .is_some()
            || completed;
    }
    assert!(completed);
    assert!(session
        .handle_event(HelperEvent::StdoutEof)
        .unwrap()
        .is_some());
    assert_eq!(session.take_kill_reason(), None);
}

#[test]
fn helper_client_times_out_before_application_ready() {
    let request = sample_request();
    let mut session = HelperClientSession::new(&request, test_timeouts());
    let error = session
        .handle_event(HelperEvent::Time(STARTUP_TIMEOUT))
        .unwrap_err();

    assert_eq!(error.code, CommandErrorCode::DocumentRendererTimeout);
    assert_eq!(error.stage, Some(RendererStage::Launch));
    assert_eq!(session.take_kill_reason(), Some(KillReason::StartupTimeout));
}

#[test]
fn helper_client_applies_export_deadline_after_readiness() {
    let request = sample_request();
    let mut session = HelperClientSession::new(
        &request,
        HelperClientTimeouts {
            startup: STARTUP_TIMEOUT,
            export: EXPORT_TIMEOUT,
            overall: Duration::from_secs(999),
        },
    );
    session
        .handle_event(HelperEvent::Time(Duration::from_secs(5)))
        .unwrap();
    session
        .handle_event(HelperEvent::Stdout(frame_bytes(HelperFrame::Progress {
            stage: HelperProgressStage::ApplicationReady,
        })))
        .unwrap();

    let error = session
        .handle_event(HelperEvent::Time(Duration::from_secs(125)))
        .unwrap_err();
    assert_eq!(error.code, CommandErrorCode::DocumentRendererTimeout);
    assert_eq!(error.stage, Some(RendererStage::Exporting));
    assert_eq!(session.take_kill_reason(), Some(KillReason::ExportTimeout));
}

#[test]
fn helper_client_enforces_overall_deadline() {
    let request = sample_request();
    let mut session = HelperClientSession::new(
        &request,
        HelperClientTimeouts {
            startup: Duration::from_secs(999),
            export: Duration::from_secs(999),
            overall: OVERALL_TIMEOUT,
        },
    );

    let error = session
        .handle_event(HelperEvent::Time(OVERALL_TIMEOUT))
        .unwrap_err();
    assert_eq!(error.code, CommandErrorCode::DocumentRendererTimeout);
    assert_eq!(session.take_kill_reason(), Some(KillReason::OverallTimeout));
}

#[test]
fn helper_client_requests_exactly_one_helper_kill() {
    let request = sample_request();
    let mut session = HelperClientSession::new(&request, test_timeouts());
    session
        .handle_event(HelperEvent::Time(STARTUP_TIMEOUT))
        .unwrap_err();

    assert_eq!(session.take_kill_reason(), Some(KillReason::StartupTimeout));
    assert_eq!(session.take_kill_reason(), None);
    session
        .handle_event(HelperEvent::Time(OVERALL_TIMEOUT))
        .unwrap_err();
    assert_eq!(session.take_kill_reason(), None);
}

#[test]
fn helper_client_rejects_malformed_and_oversized_output() {
    let request = sample_request();
    let mut malformed = HelperClientSession::new(&request, test_timeouts());
    let error = malformed
        .handle_event(HelperEvent::Stdout(b"not-json\n".to_vec()))
        .unwrap_err();
    assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
    assert_eq!(
        malformed.take_kill_reason(),
        Some(KillReason::ProtocolViolation)
    );

    let mut oversized = HelperClientSession::new(&request, test_timeouts());
    let error = oversized
        .handle_event(HelperEvent::Stdout(vec![b'x'; MAX_FRAME_BYTES + 1]))
        .unwrap_err();
    assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
    assert_eq!(
        oversized.take_kill_reason(),
        Some(KillReason::ProtocolViolation)
    );
}

#[test]
fn helper_client_rejects_eof_without_terminal_result() {
    let request = sample_request();
    let mut session = HelperClientSession::new(&request, test_timeouts());
    session
        .handle_event(HelperEvent::Stdout(frame_bytes(HelperFrame::Progress {
            stage: HelperProgressStage::Starting,
        })))
        .unwrap();

    let error = session.handle_event(HelperEvent::StdoutEof).unwrap_err();
    assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
    assert_eq!(session.take_kill_reason(), Some(KillReason::UnexpectedEof));
}

#[test]
fn helper_client_bounds_stderr_and_redacts_known_paths() {
    let request = sample_request();
    let mut session = HelperClientSession::new(&request, test_timeouts());
    let noisy = format!(
        "{} {} {}",
        request.source_path.display(),
        request.output_pdf_path.display(),
        "x".repeat(MAX_STDERR_BYTES * 2)
    );
    session
        .handle_event(HelperEvent::Stderr(noisy.into_bytes()))
        .unwrap();

    let diagnostic = session.stderr_diagnostic();
    assert!(diagnostic.len() <= MAX_STDERR_BYTES);
    assert!(!diagnostic.contains("secret-report"));
    assert!(!diagnostic.contains("bridge.pdf"));
}

#[test]
fn helper_client_maps_terminal_error_without_killing() {
    let request = sample_request();
    let expected = CommandError::new(CommandErrorCode::DocumentRendererExportFailed, "导出失败")
        .with_stage(RendererStage::Exporting)
        .with_renderer(DocumentRendererKind::Word);
    let mut session = HelperClientSession::new(&request, test_timeouts());

    let error = session
        .handle_event(HelperEvent::Stdout(frame_bytes(HelperFrame::Result(
            HelperResult::Err(expected.clone()),
        ))))
        .unwrap_err();
    assert_eq!(error, expected);
    assert_eq!(session.take_kill_reason(), None);
}

#[test]
fn helper_client_has_no_office_process_enumeration_or_kill_api() {
    let source = include_str!("../src/document_renderer/helper_client.rs").to_ascii_lowercase();
    for forbidden in [
        "taskkill",
        "winword.exe",
        "wps.exe",
        "getprocessesbyname",
        "create_toolhelp32_snapshot",
    ] {
        assert!(
            !source.contains(forbidden),
            "forbidden API/token: {forbidden}"
        );
    }
}

struct FakeTransport {
    events: std::collections::VecDeque<HelperEvent>,
    writes: Vec<Vec<u8>>,
    kills: usize,
}

impl HelperTransport for FakeTransport {
    fn write_request(&mut self, request_line: &[u8]) -> Result<(), CommandError> {
        self.writes.push(request_line.to_vec());
        Ok(())
    }

    async fn next_event(&mut self) -> Option<HelperEvent> {
        self.events.pop_front()
    }

    fn kill_child(&mut self) -> Result<(), CommandError> {
        self.kills += 1;
        Ok(())
    }
}

#[tokio::test]
async fn helper_client_fake_child_writes_once_and_completes_without_kill() {
    let request = sample_request();
    let mut events = std::collections::VecDeque::new();
    events.push_back(HelperEvent::Stdout(frame_bytes(HelperFrame::Progress {
        stage: HelperProgressStage::ApplicationReady,
    })));
    events.push_back(HelperEvent::Stdout(frame_bytes(HelperFrame::Result(
        HelperResult::Ok,
    ))));
    // 多请求会话：终帧后无需 StdoutEof 即可返回，并保留子进程。
    let mut transport = FakeTransport {
        events,
        writes: Vec::new(),
        kills: 0,
    };

    run_helper_with_transport(&mut transport, &request, test_timeouts())
        .await
        .unwrap();

    assert_eq!(
        transport.writes,
        vec![request.to_line().unwrap().into_bytes()]
    );
    assert_eq!(transport.kills, 0);
}

#[tokio::test]
async fn helper_client_reuses_transport_for_second_request_without_kill() {
    let request = sample_request();
    let mut events = std::collections::VecDeque::new();
    // 第一次请求
    events.push_back(HelperEvent::Stdout(frame_bytes(HelperFrame::Progress {
        stage: HelperProgressStage::ApplicationReady,
    })));
    events.push_back(HelperEvent::Stdout(frame_bytes(HelperFrame::Result(
        HelperResult::Ok,
    ))));
    // 第二次请求（复用同一 transport / 子进程）
    events.push_back(HelperEvent::Stdout(frame_bytes(HelperFrame::Progress {
        stage: HelperProgressStage::DocumentOpened,
    })));
    events.push_back(HelperEvent::Stdout(frame_bytes(HelperFrame::Result(
        HelperResult::Ok,
    ))));
    let mut transport = FakeTransport {
        events,
        writes: Vec::new(),
        kills: 0,
    };

    run_helper_with_transport(&mut transport, &request, test_timeouts())
        .await
        .unwrap();
    run_helper_with_transport(&mut transport, &request, test_timeouts())
        .await
        .unwrap();

    assert_eq!(transport.writes.len(), 2);
    assert_eq!(transport.kills, 0);
}

#[tokio::test]
async fn helper_client_fake_child_timeout_kills_exactly_once() {
    let request = sample_request();
    let mut events = std::collections::VecDeque::new();
    events.push_back(HelperEvent::Time(STARTUP_TIMEOUT));
    let mut transport = FakeTransport {
        events,
        writes: Vec::new(),
        kills: 0,
    };

    let error = run_helper_with_transport(&mut transport, &request, test_timeouts())
        .await
        .unwrap_err();

    assert_eq!(error.code, CommandErrorCode::DocumentRendererTimeout);
    assert_eq!(transport.kills, 1);
}
