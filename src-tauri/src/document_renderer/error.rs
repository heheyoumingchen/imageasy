//! 跨 Tauri 边界的结构化文档渲染错误。
//!
//! 前端拿到的是对象而非字符串，`code` 稳定可分派本地化文案，`diagnostic` 长度受限且不含完整源路径。

use serde::{Deserialize, Serialize};

/// 稳定错误码。序列化为 SCREAMING_SNAKE_CASE，前端据此映射本地化文案。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CommandErrorCode {
    WordRendererNotAvailable,
    WpsRendererNotAvailable,
    DocumentRendererTimeout,
    DocumentRendererExportFailed,
    DocumentPageRangeInvalid,
    PdfRendererNotAvailable,
    PdfRendererBindFailed,
    /// helper 协议违规：版本/长度/帧结构非法。
    ProtocolViolation,
    /// 兜底：未归类的内部错误。
    InternalError,
}

/// 渲染阶段，用于诊断定位。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RendererStage {
    Inspect,
    Launch,
    ApplicationReady,
    DocumentOpened,
    Exporting,
    Bridging,
    Rasterizing,
    Encoding,
    Cleanup,
}

/// 渲染器种类。序列化为前端可识别的小写标签。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DocumentRendererKind {
    Word,
    Wps,
    Pdfium,
}

/// 诊断信息最大长度（字符），避免把冗长内部堆栈或路径透传给前端。
pub const DIAGNOSTIC_MAX_CHARS: usize = 300;

/// 结构化命令错误。序列化为 camelCase 对象。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: CommandErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostic: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage: Option<RendererStage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub renderer_kind: Option<DocumentRendererKind>,
}

/// 将诊断字符串裁到 [`DIAGNOSTIC_MAX_CHARS`] 字符以内（按字符而非字节，避免截断多字节序列）。
pub fn bound_diagnostic(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.chars().count() <= DIAGNOSTIC_MAX_CHARS {
        return trimmed.to_string();
    }
    let kept: String = trimmed
        .chars()
        .take(DIAGNOSTIC_MAX_CHARS.saturating_sub(1))
        .collect();
    format!("{kept}…")
}

impl CommandError {
    pub fn new(code: CommandErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            diagnostic: None,
            stage: None,
            renderer_kind: None,
        }
    }

    /// 协议违规错误的便捷构造。
    pub fn protocol(message: impl Into<String>) -> Self {
        Self::new(CommandErrorCode::ProtocolViolation, message)
    }

    pub fn with_diagnostic(mut self, diagnostic: impl AsRef<str>) -> Self {
        let bounded = bound_diagnostic(diagnostic.as_ref());
        self.diagnostic = if bounded.is_empty() {
            None
        } else {
            Some(bounded)
        };
        self
    }

    pub fn with_stage(mut self, stage: RendererStage) -> Self {
        self.stage = Some(stage);
        self
    }

    pub fn with_renderer(mut self, renderer: DocumentRendererKind) -> Self {
        self.renderer_kind = Some(renderer);
        self
    }

    /// 序列化为 `serde_json::Value`，供 Tauri 命令以对象形式 reject。
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::to_value(self).unwrap_or_else(|_| {
            serde_json::json!({
                "code": "INTERNAL_ERROR",
                "message": "序列化错误失败"
            })
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_error_serializes_code_as_screaming_snake_case() {
        let error = CommandError::new(CommandErrorCode::WordRendererNotAvailable, "未找到 Word");
        let value = error.to_json();
        assert_eq!(value["code"], "WORD_RENDERER_NOT_AVAILABLE");
        assert_eq!(value["message"], "未找到 Word");
    }

    #[test]
    fn command_error_omits_absent_optional_fields() {
        let error = CommandError::new(CommandErrorCode::InternalError, "x");
        let value = error.to_json();
        assert!(value.get("diagnostic").is_none());
        assert!(value.get("stage").is_none());
        assert!(value.get("rendererKind").is_none());
    }

    #[test]
    fn command_error_serializes_stage_and_renderer_as_camel_case_labels() {
        let error = CommandError::new(CommandErrorCode::DocumentRendererExportFailed, "导出失败")
            .with_stage(RendererStage::Exporting)
            .with_renderer(DocumentRendererKind::Wps);
        let value = error.to_json();
        assert_eq!(value["stage"], "exporting");
        assert_eq!(value["rendererKind"], "wps");
        assert_eq!(value["code"], "DOCUMENT_RENDERER_EXPORT_FAILED");
    }

    #[test]
    fn command_error_diagnostic_is_length_bounded() {
        let long = "错".repeat(DIAGNOSTIC_MAX_CHARS + 200);
        let error = CommandError::new(CommandErrorCode::DocumentRendererTimeout, "超时")
            .with_diagnostic(long);
        let diagnostic = error.diagnostic.expect("diagnostic present");
        assert!(diagnostic.chars().count() <= DIAGNOSTIC_MAX_CHARS);
        assert!(diagnostic.ends_with('…'));
    }

    #[test]
    fn command_error_all_codes_have_stable_serialized_labels() {
        let cases = [
            (
                CommandErrorCode::WordRendererNotAvailable,
                "WORD_RENDERER_NOT_AVAILABLE",
            ),
            (
                CommandErrorCode::WpsRendererNotAvailable,
                "WPS_RENDERER_NOT_AVAILABLE",
            ),
            (
                CommandErrorCode::DocumentRendererTimeout,
                "DOCUMENT_RENDERER_TIMEOUT",
            ),
            (
                CommandErrorCode::DocumentRendererExportFailed,
                "DOCUMENT_RENDERER_EXPORT_FAILED",
            ),
            (
                CommandErrorCode::DocumentPageRangeInvalid,
                "DOCUMENT_PAGE_RANGE_INVALID",
            ),
            (
                CommandErrorCode::PdfRendererNotAvailable,
                "PDF_RENDERER_NOT_AVAILABLE",
            ),
            (
                CommandErrorCode::PdfRendererBindFailed,
                "PDF_RENDERER_BIND_FAILED",
            ),
        ];
        for (code, expected) in cases {
            let value = serde_json::to_value(code).unwrap();
            assert_eq!(value, expected);
        }
    }

    #[test]
    fn command_error_bounded_diagnostic_trims_whitespace() {
        assert_eq!(bound_diagnostic("  hi  "), "hi");
        assert_eq!(bound_diagnostic(""), "");
    }

    #[test]
    fn command_error_roundtrips_through_json() {
        let error = CommandError::new(CommandErrorCode::PdfRendererBindFailed, "绑定失败")
            .with_stage(RendererStage::Rasterizing)
            .with_renderer(DocumentRendererKind::Pdfium)
            .with_diagnostic("pdfium bind error");
        let json = serde_json::to_string(&error).unwrap();
        let parsed: CommandError = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, error);
    }
}
