//! Office 渲染 helper 的一次性请求/响应协议。
//!
//! 传输为 JSON Lines：每帧一行 UTF-8 JSON。helper 只读取恰好一个请求行，
//! 随后输出零或多个 `Progress` 帧，最终以恰好一个 `Result` 终帧收尾。
//! 严格限长，拒绝越权数据，且任何序列化结果都不得包含源/输出绝对路径。

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::error::{CommandError, DocumentRendererKind};

/// 当前协议版本；不匹配一律拒绝。
pub const PROTOCOL_VERSION: u16 = 1;
/// 请求行最大字节数。
pub const MAX_REQUEST_BYTES: usize = 16 * 1024;
/// 单个 stdout 帧最大字节数。
pub const MAX_FRAME_BYTES: usize = 8 * 1024;
/// 一次会话 stdout 累计最大字节数。
pub const MAX_TOTAL_OUTPUT_BYTES: usize = 64 * 1024;

/// helper 支持的操作类型。当前仅“转换为 PDF”。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HelperOperation {
    ConvertToPdf,
}

/// 一次 helper 请求。序列化后必须能装入 `MAX_REQUEST_BYTES`。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelperRequest {
    pub protocol_version: u16,
    pub operation: HelperOperation,
    pub renderer: DocumentRendererKind,
    pub source_path: PathBuf,
    pub output_pdf_path: PathBuf,
}

impl HelperRequest {
    /// 序列化为单行 JSON（含结尾换行），并校验版本与长度上限。
    pub fn to_line(&self) -> Result<String, CommandError> {
        if self.protocol_version != PROTOCOL_VERSION {
            return Err(CommandError::protocol("请求协议版本不受支持"));
        }
        let mut line = serde_json::to_string(self)
            .map_err(|error| CommandError::protocol(format!("无法序列化请求: {error}")))?;
        if line.len() > MAX_REQUEST_BYTES {
            return Err(CommandError::protocol("请求超过长度上限"));
        }
        line.push('\n');
        Ok(line)
    }

    /// 从单行 JSON 解析请求，校验版本、长度与渲染器合法性。
    pub fn from_line(line: &str) -> Result<Self, CommandError> {
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.len() > MAX_REQUEST_BYTES {
            return Err(CommandError::protocol("请求超过长度上限"));
        }
        let request: HelperRequest = serde_json::from_str(trimmed)
            .map_err(|error| CommandError::protocol(format!("无法解析请求: {error}")))?;
        if request.protocol_version != PROTOCOL_VERSION {
            return Err(CommandError::protocol("请求协议版本不受支持"));
        }
        Ok(request)
    }
}

/// helper 进度阶段。用于向用户反馈但不携带敏感路径。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HelperProgressStage {
    Starting,
    ApplicationReady,
    DocumentOpened,
    Exporting,
    Cleanup,
}

/// helper 输出帧：多个 Progress，最终恰好一个 Result。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum HelperFrame {
    Progress { stage: HelperProgressStage },
    Result(HelperResult),
}

/// 终帧结果。成功不携带任何路径（输出路径由父进程已知）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HelperResult {
    Ok,
    Err(CommandError),
}

impl HelperFrame {
    /// 序列化为单行 JSON（含换行），校验帧长度上限。
    pub fn to_line(&self) -> Result<String, CommandError> {
        let mut line = serde_json::to_string(self)
            .map_err(|error| CommandError::protocol(format!("无法序列化帧: {error}")))?;
        if line.len() > MAX_FRAME_BYTES {
            return Err(CommandError::protocol("输出帧超过长度上限"));
        }
        line.push('\n');
        Ok(line)
    }

    /// 从单行 JSON 解析帧，校验长度上限。
    pub fn from_line(line: &str) -> Result<Self, CommandError> {
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.len() > MAX_FRAME_BYTES {
            return Err(CommandError::protocol("输出帧超过长度上限"));
        }
        serde_json::from_str(trimmed)
            .map_err(|error| CommandError::protocol(format!("无法解析帧: {error}")))
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, HelperFrame::Result(_))
    }
}

/// 会话内累积输出帧的解析器：强制单终帧、总长上限、终帧后无数据。
#[derive(Debug, Default)]
pub struct FrameAccumulator {
    total_bytes: usize,
    terminal_seen: bool,
}

impl FrameAccumulator {
    pub fn new() -> Self {
        Self::default()
    }

    /// 接收一行输出，返回解析后的帧。违反协议约束时返回错误。
    pub fn push_line(&mut self, line: &str) -> Result<HelperFrame, CommandError> {
        if self.terminal_seen {
            return Err(CommandError::protocol("终帧之后仍有数据"));
        }
        let trimmed = line.trim_end_matches(['\r', '\n']);
        self.total_bytes = self.total_bytes.saturating_add(trimmed.len());
        if self.total_bytes > MAX_TOTAL_OUTPUT_BYTES {
            return Err(CommandError::protocol("累计输出超过上限"));
        }
        let frame = HelperFrame::from_line(trimmed)?;
        if frame.is_terminal() {
            self.terminal_seen = true;
        }
        Ok(frame)
    }

    pub fn terminal_seen(&self) -> bool {
        self.terminal_seen
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document_renderer::error::{CommandErrorCode, DocumentRendererKind};

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
    fn protocol_request_roundtrips_through_one_line() {
        let request = sample_request();
        let line = request.to_line().unwrap();
        assert!(line.ends_with('\n'));
        assert_eq!(line.matches('\n').count(), 1);
        let parsed = HelperRequest::from_line(&line).unwrap();
        assert_eq!(parsed, request);
    }

    #[test]
    fn protocol_request_rejects_wrong_version() {
        let mut request = sample_request();
        request.protocol_version = 999;
        let raw = serde_json::to_string(&request).unwrap();
        let error = HelperRequest::from_line(&raw).unwrap_err();
        assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
    }

    #[test]
    fn protocol_request_rejects_unknown_renderer_token() {
        // renderer 是枚举；未知取值无法反序列化。
        let raw = r#"{"protocolVersion":1,"operation":"convertToPdf","renderer":"excel","sourcePath":"a","outputPdfPath":"b"}"#;
        let error = HelperRequest::from_line(raw).unwrap_err();
        assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
    }

    #[test]
    fn protocol_request_rejects_unknown_operation_token() {
        let raw = r#"{"protocolVersion":1,"operation":"print","renderer":"word","sourcePath":"a","outputPdfPath":"b"}"#;
        let error = HelperRequest::from_line(raw).unwrap_err();
        assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
    }

    #[test]
    fn protocol_request_rejects_oversized_line() {
        let huge = "x".repeat(MAX_REQUEST_BYTES + 1);
        let error = HelperRequest::from_line(&huge).unwrap_err();
        assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
    }

    #[test]
    fn protocol_progress_and_result_frames_roundtrip() {
        let progress = HelperFrame::Progress {
            stage: HelperProgressStage::Exporting,
        };
        let parsed = HelperFrame::from_line(&progress.to_line().unwrap()).unwrap();
        assert_eq!(parsed, progress);

        let result = HelperFrame::Result(HelperResult::Ok);
        let parsed = HelperFrame::from_line(&result.to_line().unwrap()).unwrap();
        assert_eq!(parsed, result);
        assert!(parsed.is_terminal());
    }

    #[test]
    fn protocol_frame_rejects_oversized_frame() {
        let error = HelperFrame::from_line(&"y".repeat(MAX_FRAME_BYTES + 1)).unwrap_err();
        assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
    }

    #[test]
    fn protocol_accumulator_rejects_data_after_terminal_result() {
        let mut acc = FrameAccumulator::new();
        let terminal = HelperFrame::Result(HelperResult::Ok).to_line().unwrap();
        acc.push_line(&terminal).unwrap();
        assert!(acc.terminal_seen());
        let progress = HelperFrame::Progress {
            stage: HelperProgressStage::Cleanup,
        }
        .to_line()
        .unwrap();
        let error = acc.push_line(&progress).unwrap_err();
        assert_eq!(error.code, CommandErrorCode::ProtocolViolation);
    }

    #[test]
    fn protocol_accumulator_rejects_total_output_overflow() {
        let mut acc = FrameAccumulator::new();
        // 每个进度帧远小于单帧上限，但累计需超过总上限。
        let progress = HelperFrame::Progress {
            stage: HelperProgressStage::Starting,
        }
        .to_line()
        .unwrap();
        let mut error = None;
        // 累加的是去掉换行后的长度，循环上界据此计算并留足余量，保证累计必然越过总上限；命中即停。
        let trimmed_len = progress.trim_end_matches(['\r', '\n']).len().max(1);
        for _ in 0..(MAX_TOTAL_OUTPUT_BYTES / trimmed_len + 2) {
            if let Err(caught) = acc.push_line(&progress) {
                error = Some(caught);
                break;
            }
        }
        assert_eq!(error.unwrap().code, CommandErrorCode::ProtocolViolation);
    }

    #[test]
    fn protocol_result_serialization_contains_no_paths() {
        // 成功终帧绝不携带源/输出路径。
        let line = HelperFrame::Result(HelperResult::Ok).to_line().unwrap();
        assert!(!line.contains("bridge.pdf"));
        assert!(!line.contains("secret-report"));

        // 错误终帧的 diagnostic 也不应含路径（调用方负责脱敏；此处验证结构不强制携带）。
        let err_frame = HelperFrame::Result(HelperResult::Err(CommandError::new(
            CommandErrorCode::DocumentRendererExportFailed,
            "导出失败",
        )));
        let line = err_frame.to_line().unwrap();
        assert!(!line.contains("secret-report"));
        assert!(!line.contains("bridge.pdf"));
    }
}
