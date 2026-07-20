//! 文档渲染域：结构化错误、助手协议、Office 协调器与 PDFium 桥接。
//!
//! PDF 直接进入回调式 PDFium 流水线；Office 文档经异步协调器串行化调用独立的 Windows 助手 sidecar，
//! 由后者用 COM STA 生成私有 PDF，再复用同一条 PDFium 流水线渲染。

pub mod bridge_cache;
pub mod coordinator;
pub mod error;
pub mod helper_client;
pub mod protocol;
pub mod timing;

pub use error::{
    bound_diagnostic, CommandError, CommandErrorCode, DocumentRendererKind, RendererStage,
    DIAGNOSTIC_MAX_CHARS,
};
