//! Windows COM Word/WPS 适配器。
//!
//! 设计分两层：
//!  - **可测逻辑层**：基于可 fake 的 [`Dispatch`] 抽象实现自动化序列、能力探测、参数逆序、
//!    属性 put 的命名参数、VARIANT 清理记账、EXCEPINFO→有界阶段错误。这层不依赖真实 COM，
//!    单元测试用 [`tests::FakeDispatch`] 覆盖。
//!  - **真实桥接层**：`RealDispatch` 用 `windows` crate 的 `IDispatch::Invoke` 实现 [`Dispatch`]。
//!    这层没有安装 Word/WPS 时无法端到端验证，仅编译保证；真实冒烟测试在 unified-windows 批次。
//!
//! COM 纪律：`CoInitializeEx(APARTMENTTHREADED)` / `CLSIDFromProgID` /
//! `CoCreateInstance::<IDispatch>(CLSCTX_LOCAL_SERVER)`；绝不用 `GetActiveObject`、PowerShell、
//! VBScript 或 `taskkill`。

#![cfg(windows)]

use imageasy_lib::document_renderer::error::{
    CommandError, CommandErrorCode, DocumentRendererKind, RendererStage,
};
use imageasy_lib::document_renderer::protocol::HelperProgressStage;

use crate::automation::AutomationBackend;

/// 调用类型：方法、取属性、置属性。对应 COM `DISPATCH_*` 标志。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InvokeKind {
    Method,
    PropertyGet,
    PropertyPut,
}

/// 中立的 COM 值抽象（真实层映射到 VARIANT，fake 层直接持有）。
#[derive(Debug, Clone, PartialEq)]
pub enum ComValue {
    Empty,
    /// COM 可选参数缺省值（VT_ERROR / DISP_E_PARAMNOTFOUND）。
    Missing,
    Bool(bool),
    I32(i32),
    Str(String),
    /// 对象引用的占位：真实层是 IDispatch 代理，逻辑层只需类型标识。
    Object(&'static str),
}

/// 一次 dispatch 调用的描述。`args` 按“调用顺序”给出（人类可读顺序），
/// 真实层负责在构造 DISPPARAMS 时逆序（COM 约定）。
#[derive(Debug, Clone, PartialEq)]
pub struct DispatchCall {
    pub name: String,
    pub kind: InvokeKind,
    pub args: Vec<ComValue>,
}

/// 可 fake 的 dispatch 边界。真实实现是 `IDispatch::Invoke` 包装。
pub trait Dispatch {
    /// 目标是否具备某成员（能力探测用）。
    fn has_member(&self, name: &str) -> bool;
    /// 执行一次调用。
    fn invoke(&mut self, call: DispatchCall) -> Result<ComValue, CommandError>;
}

/// COM 约定：`DISPPARAMS::rgvarg` 的实参需按逆序排列。逻辑层以正序描述，
/// 这里集中做逆序，既供真实层使用，也可单测。
pub fn dispatch_args_in_reverse(args: &[ComValue]) -> Vec<ComValue> {
    let mut reversed = args.to_vec();
    reversed.reverse();
    reversed
}

/// 已解析为 COM `DISPPARAMS` 顺序的调用参数。
#[derive(Debug, Clone, PartialEq)]
pub struct MarshalledDispatchCall {
    pub args: Vec<ComValue>,
    pub named_dispids: Vec<i32>,
}

pub fn marshal_dispatch_call(call: &DispatchCall) -> MarshalledDispatchCall {
    MarshalledDispatchCall {
        args: dispatch_args_in_reverse(&call.args),
        named_dispids: if call.kind == InvokeKind::PropertyPut {
            vec![DISPID_PROPERTYPUT]
        } else {
            Vec::new()
        },
    }
}

/// 属性 put 需要命名参数 `DISPID_PROPERTYPUT`（值为 -3）。集中定义避免散落魔数。
pub const DISPID_PROPERTYPUT: i32 = -3;

/// 把 COM `EXCEPINFO` 的描述转成有界、无路径的阶段错误。
///
/// `description` 可能很长或包含内部细节；此处仅取有界摘要，并绑定阶段与渲染器。
pub fn excepinfo_to_stage_error(
    renderer: DocumentRendererKind,
    stage: HelperProgressStage,
    code: CommandErrorCode,
    description: &str,
    known_paths: &[&str],
) -> CommandError {
    let diagnostic = known_paths
        .iter()
        .filter(|path| !path.is_empty())
        .fold(description.to_string(), |text, path| {
            text.replace(path, "[path]")
        });
    CommandError::new(code, stage_message(stage))
        .with_renderer(renderer)
        .with_stage(renderer_stage(stage))
        .with_diagnostic(diagnostic)
}

fn renderer_stage(stage: HelperProgressStage) -> RendererStage {
    match stage {
        HelperProgressStage::Starting => RendererStage::Launch,
        HelperProgressStage::ApplicationReady => RendererStage::ApplicationReady,
        HelperProgressStage::DocumentOpened => RendererStage::DocumentOpened,
        HelperProgressStage::Exporting => RendererStage::Exporting,
        HelperProgressStage::Cleanup => RendererStage::Cleanup,
    }
}

fn stage_message(stage: HelperProgressStage) -> &'static str {
    match stage {
        HelperProgressStage::Starting => "启动 Office 自动化失败",
        HelperProgressStage::ApplicationReady => "创建 Office 应用失败",
        HelperProgressStage::DocumentOpened => "打开文档失败",
        HelperProgressStage::Exporting => "导出 PDF 失败",
        HelperProgressStage::Cleanup => "清理 Office 自动化失败",
    }
}

/// Word/WPS 安全序列所需成员。仅对 `Options.UpdateLinksAtOpen` 保持兼容性可选。
pub const REQUIRED_APP_MEMBERS: [&str; 5] = [
    "Visible",
    "DisplayAlerts",
    "AutomationSecurity",
    "Documents",
    "Quit",
];
pub const REQUIRED_OPTIONS_MEMBERS: [&str; 1] = ["UpdateLinksAtOpen"];
pub const REQUIRED_DOCUMENTS_MEMBERS: [&str; 1] = ["Open"];
pub const REQUIRED_DOCUMENT_MEMBERS: [&str; 2] = ["ExportAsFixedFormat", "Close"];

pub fn probe_app_capabilities<D: Dispatch>(app: &D) -> bool {
    REQUIRED_APP_MEMBERS
        .iter()
        .all(|member| app.has_member(member))
}

pub fn probe_options_capabilities<D: Dispatch>(options: &D) -> bool {
    REQUIRED_OPTIONS_MEMBERS
        .iter()
        .all(|member| options.has_member(member))
}

pub fn probe_documents_capabilities<D: Dispatch>(documents: &D) -> bool {
    REQUIRED_DOCUMENTS_MEMBERS
        .iter()
        .all(|member| documents.has_member(member))
}

pub fn probe_document_capabilities<D: Dispatch>(document: &D) -> bool {
    REQUIRED_DOCUMENT_MEMBERS
        .iter()
        .all(|member| document.has_member(member))
}

/// Word `WdExportFormatPDF` 常量。
pub const WD_EXPORT_FORMAT_PDF: i32 = 17;
/// Word `WdDoNotSaveChanges` 常量（关闭/退出不保存）。
pub const WD_DO_NOT_SAVE_CHANGES: i32 = 0;
/// Word `msoAutomationSecurityForceDisable` 常量。
pub const MSO_AUTOMATION_SECURITY_FORCE_DISABLE: i32 = 3;
/// Office 应用的选项对象。
pub const OPTIONS_MEMBER: &str = "Options";
/// Office 选项中控制打开时链接更新的属性。
pub const UPDATE_LINKS_AT_OPEN: &str = "UpdateLinksAtOpen";

/// 打开文档前必须完成的安全属性设置。
fn security_property_calls() -> Vec<DispatchCall> {
    vec![
        DispatchCall {
            name: "Visible".into(),
            kind: InvokeKind::PropertyPut,
            args: vec![ComValue::Bool(false)],
        },
        DispatchCall {
            name: "DisplayAlerts".into(),
            kind: InvokeKind::PropertyPut,
            args: vec![ComValue::I32(0)],
        },
        DispatchCall {
            name: "AutomationSecurity".into(),
            kind: InvokeKind::PropertyPut,
            args: vec![ComValue::I32(MSO_AUTOMATION_SECURITY_FORCE_DISABLE)],
        },
    ]
}

fn update_links_at_open_call() -> DispatchCall {
    DispatchCall {
        name: UPDATE_LINKS_AT_OPEN.into(),
        kind: InvokeKind::PropertyPut,
        args: vec![ComValue::Bool(false)],
    }
}

/// `Documents.Open` 的安全参数规格。保留中间缺省项，避免位置参数漂移。
fn document_open_call(source_path: &str) -> DispatchCall {
    DispatchCall {
        name: "Open".into(),
        kind: InvokeKind::Method,
        args: vec![
            ComValue::Str(source_path.into()), // FileName
            ComValue::Missing,                 // ConfirmConversions
            ComValue::Bool(true),              // ReadOnly
            ComValue::Bool(false),             // AddToRecentFiles
            ComValue::Missing,                 // PasswordDocument
            ComValue::Missing,                 // PasswordTemplate
            ComValue::Missing,                 // Revert
            ComValue::Missing,                 // WritePasswordDocument
            ComValue::Missing,                 // WritePasswordTemplate
            ComValue::Missing,                 // Format
            ComValue::Missing,                 // Encoding
            ComValue::Bool(false),             // Visible
            ComValue::Missing,                 // OpenAndRepair
            ComValue::Missing,                 // DocumentDirection
            ComValue::Bool(true),              // NoEncodingDialog
            ComValue::Missing,                 // XMLTransform
        ],
    }
}

fn export_pdf_call(output_path: &str) -> DispatchCall {
    DispatchCall {
        name: "ExportAsFixedFormat".into(),
        kind: InvokeKind::Method,
        args: vec![
            ComValue::Str(output_path.into()),
            ComValue::I32(WD_EXPORT_FORMAT_PDF),
            ComValue::Bool(false),
        ],
    }
}

fn close_document_call() -> DispatchCall {
    DispatchCall {
        name: "Close".into(),
        kind: InvokeKind::Method,
        args: vec![ComValue::I32(WD_DO_NOT_SAVE_CHANGES)],
    }
}

fn quit_application_call() -> DispatchCall {
    DispatchCall {
        name: "Quit".into(),
        kind: InvokeKind::Method,
        args: vec![ComValue::I32(WD_DO_NOT_SAVE_CHANGES)],
    }
}

/// 渲染器对应的 ProgID 候选（按优先级）。WPS 先试新版 KWPS，再退回旧版 WPS。
pub fn progid_candidates(renderer: DocumentRendererKind) -> &'static [&'static str] {
    match renderer {
        DocumentRendererKind::Word => &["Word.Application"],
        DocumentRendererKind::Wps => &["KWPS.Application", "WPS.Application"],
        // Pdfium 不走 COM helper；返回空候选。
        DocumentRendererKind::Pdfium => &[],
    }
}

/// 依据渲染器构造后端。真实实现绑定 COM；此处仅编译保证。
pub fn backend_for(
    renderer: DocumentRendererKind,
) -> Result<Box<dyn AutomationBackend>, CommandError> {
    match renderer {
        DocumentRendererKind::Word | DocumentRendererKind::Wps => {
            Ok(Box::new(real::RealComBackend::new(renderer)))
        }
        DocumentRendererKind::Pdfium => Err(CommandError::new(
            CommandErrorCode::InternalError,
            "PDF 不应经由 Office helper",
        )),
    }
}

/// 真实 COM 桥接层。没有安装 Office 时无法端到端验证，仅编译保证。
mod real {
    use super::*;
    use imageasy_lib::document_renderer::protocol::HelperProgressStage;
    use std::mem::ManuallyDrop;
    use std::path::Path;
    use windows::core::{GUID, PCWSTR};
    use windows::Win32::Foundation::DISP_E_PARAMNOTFOUND;
    use windows::Win32::System::Com::{
        IDispatch, DISPATCH_METHOD, DISPATCH_PROPERTYGET, DISPATCH_PROPERTYPUT, DISPPARAMS,
        EXCEPINFO,
    };
    use windows::Win32::System::Variant::{
        VARIANT, VARIANT_0, VARIANT_0_0, VARIANT_0_0_0, VT_ERROR,
    };

    const LOCALE_SYSTEM_DEFAULT: u32 = 0x0800;

    fn resolve_member_id(dispatch: &IDispatch, name: &str) -> windows::core::Result<i32> {
        let wide: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
        let name_ptr = PCWSTR(wide.as_ptr());
        let mut dispid = 0;
        // SAFETY: 名称缓冲区、指针和输出 DISPID 在同步调用期间有效。
        unsafe {
            dispatch.GetIDsOfNames(
                &GUID::zeroed(),
                &name_ptr,
                1,
                LOCALE_SYSTEM_DEFAULT,
                &mut dispid,
            )?;
        }
        Ok(dispid)
    }

    /// 带调用阶段的真实迟绑定代理。所有 `VARIANT` 都由 `windows` 的 Drop 自动清理。
    struct LateDispatch {
        inner: IDispatch,
        renderer: DocumentRendererKind,
        stage: HelperProgressStage,
        error_code: CommandErrorCode,
        known_paths: Vec<String>,
    }

    impl LateDispatch {
        fn new(
            inner: IDispatch,
            renderer: DocumentRendererKind,
            stage: HelperProgressStage,
            error_code: CommandErrorCode,
        ) -> Self {
            Self {
                inner,
                renderer,
                stage,
                error_code,
                known_paths: Vec::new(),
            }
        }

        fn with_known_paths(mut self, known_paths: &[String]) -> Self {
            self.known_paths = known_paths.to_vec();
            self
        }

        fn member_id(&self, name: &str) -> windows::core::Result<i32> {
            resolve_member_id(&self.inner, name)
        }

        fn has_member(&self, name: &str) -> bool {
            self.member_id(name).is_ok()
        }

        fn invoke(&self, call: DispatchCall) -> Result<VARIANT, CommandError> {
            let dispid = self
                .member_id(&call.name)
                .map_err(|error| self.stage_error(&call.name, None, &error))?;
            let marshalled = marshal_dispatch_call(&call);
            let mut variants = marshalled
                .args
                .into_iter()
                .map(com_value_to_variant)
                .collect::<Vec<_>>();
            let mut named_dispids = marshalled.named_dispids;
            let params = DISPPARAMS {
                rgvarg: variants.as_mut_ptr(),
                rgdispidNamedArgs: named_dispids.as_mut_ptr(),
                cArgs: variants.len() as u32,
                cNamedArgs: named_dispids.len() as u32,
            };
            let mut result = VARIANT::default();
            let mut excepinfo = EXCEPINFO::default();
            let mut argument_error = 0;
            let flags = match call.kind {
                InvokeKind::Method => DISPATCH_METHOD,
                InvokeKind::PropertyGet => DISPATCH_PROPERTYGET,
                InvokeKind::PropertyPut => DISPATCH_PROPERTYPUT,
            };
            // SAFETY: DISPPARAMS 指向本栈存活的 variants/named DISPID，结果与 EXCEPINFO
            // 均由调用方初始化；Invoke 是同步调用。
            let invoked = unsafe {
                self.inner.Invoke(
                    dispid,
                    &GUID::zeroed(),
                    LOCALE_SYSTEM_DEFAULT,
                    flags,
                    &params,
                    Some(&mut result),
                    Some(&mut excepinfo),
                    Some(&mut argument_error),
                )
            };
            match invoked {
                Ok(()) => Ok(result),
                Err(error) => Err(self.stage_error(&call.name, Some(&mut excepinfo), &error)),
            }
        }

        fn invoke_object(&self, call: DispatchCall) -> Result<IDispatch, CommandError> {
            let result = self.invoke(call)?;
            IDispatch::try_from(&result).map_err(|error| self.stage_error("返回对象", None, &error))
        }

        fn stage_error(
            &self,
            member: &str,
            excepinfo: Option<&mut EXCEPINFO>,
            error: &windows::core::Error,
        ) -> CommandError {
            let detail = excepinfo
                .map(excepinfo_description)
                .filter(|description| !description.is_empty())
                .unwrap_or_else(|| format!("{member}: {error}"));
            let known_paths = self
                .known_paths
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>();
            excepinfo_to_stage_error(
                self.renderer,
                self.stage,
                self.error_code,
                &detail,
                &known_paths,
            )
        }
    }

    impl Dispatch for LateDispatch {
        fn has_member(&self, name: &str) -> bool {
            LateDispatch::has_member(self, name)
        }

        fn invoke(&mut self, call: DispatchCall) -> Result<ComValue, CommandError> {
            LateDispatch::invoke(self, call).map(|_| ComValue::Empty)
        }
    }

    fn com_value_to_variant(value: ComValue) -> VARIANT {
        match value {
            ComValue::Empty => VARIANT::default(),
            ComValue::Missing => missing_variant(),
            ComValue::Bool(value) => value.into(),
            ComValue::I32(value) => value.into(),
            ComValue::Str(value) => value.as_str().into(),
            ComValue::Object(_) => VARIANT::default(),
        }
    }

    fn missing_variant() -> VARIANT {
        VARIANT {
            Anonymous: VARIANT_0 {
                Anonymous: ManuallyDrop::new(VARIANT_0_0 {
                    vt: VT_ERROR,
                    wReserved1: 0,
                    wReserved2: 0,
                    wReserved3: 0,
                    Anonymous: VARIANT_0_0_0 {
                        scode: DISP_E_PARAMNOTFOUND.0,
                    },
                }),
            },
        }
    }

    fn excepinfo_description(excepinfo: &mut EXCEPINFO) -> String {
        if let Some(fill) = excepinfo.pfnDeferredFillIn {
            // SAFETY: COM 提供的 deferred fill 回调以当前 EXCEPINFO 指针为参数。
            let _ = unsafe { fill(excepinfo) };
        }
        excepinfo.bstrDescription.to_string()
    }

    /// 真实 COM 后端：持有 ProgID 候选与运行期代理句柄。
    pub struct RealComBackend {
        renderer: DocumentRendererKind,
        com_initialized: bool,
        #[cfg(windows)]
        application: Option<windows::Win32::System::Com::IDispatch>,
        #[cfg(windows)]
        document: Option<windows::Win32::System::Com::IDispatch>,
        known_paths: Vec<String>,
    }

    impl RealComBackend {
        pub fn new(renderer: DocumentRendererKind) -> Self {
            Self {
                renderer,
                com_initialized: false,
                #[cfg(windows)]
                application: None,
                #[cfg(windows)]
                document: None,
                known_paths: Vec::new(),
            }
        }

        fn renderer_unavailable_code(&self) -> CommandErrorCode {
            match self.renderer {
                DocumentRendererKind::Wps => CommandErrorCode::WpsRendererNotAvailable,
                _ => CommandErrorCode::WordRendererNotAvailable,
            }
        }

        fn missing_proxy_error(&self, stage: HelperProgressStage) -> CommandError {
            excepinfo_to_stage_error(
                self.renderer,
                stage,
                CommandErrorCode::InternalError,
                "Office COM 代理未初始化",
                &[],
            )
        }
    }

    #[cfg(windows)]
    impl AutomationBackend for RealComBackend {
        fn initialize_sta(&mut self) -> Result<(), CommandError> {
            use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};
            // SAFETY: 进程内每线程调用一次；失败返回结构化错误。
            let hr = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
            if hr.is_err() {
                return Err(excepinfo_to_stage_error(
                    self.renderer,
                    HelperProgressStage::Starting,
                    self.renderer_unavailable_code(),
                    &format!("CoInitializeEx 失败: {hr:?}"),
                    &[],
                ));
            }
            self.com_initialized = true;
            Ok(())
        }

        fn create_application(&mut self) -> Result<(), CommandError> {
            use windows::core::HSTRING;
            use windows::Win32::System::Com::{
                CLSIDFromProgID, CoCreateInstance, IDispatch, CLSCTX_LOCAL_SERVER,
            };

            let mut last_error = String::from("无候选 ProgID");
            for progid in progid_candidates(self.renderer) {
                let wide = HSTRING::from(*progid);
                // SAFETY: progid 为静态字符串；失败继续下一个候选。
                let clsid = match unsafe { CLSIDFromProgID(&wide) } {
                    Ok(clsid) => clsid,
                    Err(error) => {
                        last_error = format!("CLSIDFromProgID({progid}) 失败: {error:?}");
                        continue;
                    }
                };
                // SAFETY: 本地服务器创建；成功即持有 IDispatch 代理。
                match unsafe { CoCreateInstance::<_, IDispatch>(&clsid, None, CLSCTX_LOCAL_SERVER) }
                {
                    Ok(app) => {
                        let dispatch = LateDispatch::new(
                            app.clone(),
                            self.renderer,
                            HelperProgressStage::ApplicationReady,
                            self.renderer_unavailable_code(),
                        );
                        if !probe_app_capabilities(&dispatch) {
                            last_error = format!("{progid} 缺少必要的 Office 自动化成员");
                            let _ = dispatch.invoke(quit_application_call());
                            continue;
                        }
                        self.application = Some(app);
                        return Ok(());
                    }
                    Err(error) => {
                        last_error = format!("CoCreateInstance({progid}) 失败: {error:?}");
                    }
                }
            }
            Err(excepinfo_to_stage_error(
                self.renderer,
                HelperProgressStage::ApplicationReady,
                self.renderer_unavailable_code(),
                &last_error,
                &[],
            ))
        }

        fn configure_security(&mut self) -> Result<(), CommandError> {
            let application = self
                .application
                .clone()
                .ok_or_else(|| self.missing_proxy_error(HelperProgressStage::ApplicationReady))?;
            let dispatch = LateDispatch::new(
                application,
                self.renderer,
                HelperProgressStage::ApplicationReady,
                self.renderer_unavailable_code(),
            );
            for call in security_property_calls() {
                dispatch.invoke(call)?;
            }
            if dispatch.has_member(OPTIONS_MEMBER) {
                let options = dispatch.invoke_object(DispatchCall {
                    name: OPTIONS_MEMBER.into(),
                    kind: InvokeKind::PropertyGet,
                    args: Vec::new(),
                })?;
                let options = LateDispatch::new(
                    options,
                    self.renderer,
                    HelperProgressStage::ApplicationReady,
                    self.renderer_unavailable_code(),
                );
                if probe_options_capabilities(&options) {
                    options.invoke(update_links_at_open_call())?;
                }
            }
            Ok(())
        }

        fn open_document(&mut self, source_path: &Path) -> Result<(), CommandError> {
            let source_path = source_path.to_str().ok_or_else(|| {
                excepinfo_to_stage_error(
                    self.renderer,
                    HelperProgressStage::DocumentOpened,
                    CommandErrorCode::DocumentRendererExportFailed,
                    "源文档路径不是有效 Unicode",
                    &[],
                )
            })?;
            let application = self
                .application
                .clone()
                .ok_or_else(|| self.missing_proxy_error(HelperProgressStage::DocumentOpened))?;
            let application = LateDispatch::new(
                application,
                self.renderer,
                HelperProgressStage::DocumentOpened,
                self.renderer_unavailable_code(),
            )
            .with_known_paths(&[source_path.to_string()]);
            let documents = application.invoke_object(DispatchCall {
                name: "Documents".into(),
                kind: InvokeKind::PropertyGet,
                args: Vec::new(),
            })?;
            let documents = LateDispatch::new(
                documents,
                self.renderer,
                HelperProgressStage::DocumentOpened,
                self.renderer_unavailable_code(),
            )
            .with_known_paths(&[source_path.to_string()]);
            if !probe_documents_capabilities(&documents) {
                return Err(excepinfo_to_stage_error(
                    self.renderer,
                    HelperProgressStage::DocumentOpened,
                    self.renderer_unavailable_code(),
                    "Office 文档集合缺少打开能力",
                    &[source_path],
                ));
            }
            let document = documents.invoke_object(document_open_call(source_path))?;
            let document_dispatch = LateDispatch::new(
                document.clone(),
                self.renderer,
                HelperProgressStage::DocumentOpened,
                self.renderer_unavailable_code(),
            )
            .with_known_paths(&[source_path.to_string()]);
            if !probe_document_capabilities(&document_dispatch) {
                let _ = document_dispatch.invoke(close_document_call());
                return Err(excepinfo_to_stage_error(
                    self.renderer,
                    HelperProgressStage::DocumentOpened,
                    self.renderer_unavailable_code(),
                    "Office 文档对象缺少导出或关闭能力",
                    &[source_path],
                ));
            }
            self.known_paths = vec![source_path.to_string()];
            self.document = Some(document);
            Ok(())
        }

        fn export_pdf(&mut self, output_pdf_path: &Path) -> Result<(), CommandError> {
            let output_path = output_pdf_path.to_str().ok_or_else(|| {
                excepinfo_to_stage_error(
                    self.renderer,
                    HelperProgressStage::Exporting,
                    CommandErrorCode::DocumentRendererExportFailed,
                    "目标 PDF 路径不是有效 Unicode",
                    &[],
                )
            })?;
            let document = self
                .document
                .clone()
                .ok_or_else(|| self.missing_proxy_error(HelperProgressStage::Exporting))?;
            self.known_paths.push(output_path.to_string());
            LateDispatch::new(
                document,
                self.renderer,
                HelperProgressStage::Exporting,
                CommandErrorCode::DocumentRendererExportFailed,
            )
            .with_known_paths(&self.known_paths)
            .invoke(export_pdf_call(output_path))?;
            Ok(())
        }

        fn close_document(&mut self) -> Result<(), CommandError> {
            let Some(document) = self.document.take() else {
                return Ok(());
            };
            LateDispatch::new(
                document,
                self.renderer,
                HelperProgressStage::Cleanup,
                CommandErrorCode::DocumentRendererExportFailed,
            )
            .invoke(close_document_call())?;
            Ok(())
        }

        fn quit_application(&mut self) -> Result<(), CommandError> {
            let Some(application) = self.application.take() else {
                return Ok(());
            };
            LateDispatch::new(
                application,
                self.renderer,
                HelperProgressStage::Cleanup,
                CommandErrorCode::DocumentRendererExportFailed,
            )
            .invoke(quit_application_call())?;
            Ok(())
        }

        fn release_proxies(&mut self) {
            self.document = None;
            self.application = None;
        }

        fn uninitialize(&mut self) {
            if self.com_initialized {
                use windows::Win32::System::Com::CoUninitialize;
                // SAFETY: 与 initialize_sta 的 CoInitializeEx 配对。
                unsafe { CoUninitialize() };
                self.com_initialized = false;
            }
        }
    }

    // 非 Windows 不会编译到（模块 #![cfg(windows)]），此实现仅为类型完备兜底。
    #[cfg(not(windows))]
    impl AutomationBackend for RealComBackend {
        fn initialize_sta(&mut self) -> Result<(), CommandError> {
            Err(CommandError::new(
                self.renderer_unavailable_code(),
                "非 Windows 不支持 COM",
            ))
        }
        fn create_application(&mut self) -> Result<(), CommandError> {
            Err(CommandError::new(
                self.renderer_unavailable_code(),
                "非 Windows 不支持 COM",
            ))
        }
        fn configure_security(&mut self) -> Result<(), CommandError> {
            Ok(())
        }
        fn open_document(&mut self, _source_path: &Path) -> Result<(), CommandError> {
            Err(CommandError::new(
                self.renderer_unavailable_code(),
                "非 Windows 不支持 COM",
            ))
        }
        fn export_pdf(&mut self, _output_pdf_path: &Path) -> Result<(), CommandError> {
            Err(CommandError::new(
                self.renderer_unavailable_code(),
                "非 Windows 不支持 COM",
            ))
        }
        fn close_document(&mut self) -> Result<(), CommandError> {
            Ok(())
        }
        fn quit_application(&mut self) -> Result<(), CommandError> {
            Ok(())
        }
        fn release_proxies(&mut self) {}
        fn uninitialize(&mut self) {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fake dispatch：仅记录成员集合，用于能力探测测试。
    struct FakeDispatch {
        members: Vec<&'static str>,
    }

    impl FakeDispatch {
        fn new(members: &[&'static str]) -> Self {
            Self {
                members: members.to_vec(),
            }
        }
    }

    impl Dispatch for FakeDispatch {
        fn has_member(&self, name: &str) -> bool {
            self.members.contains(&name)
        }
        fn invoke(&mut self, _call: DispatchCall) -> Result<ComValue, CommandError> {
            Ok(ComValue::Empty)
        }
    }

    struct TrackedVariant {
        drops: std::rc::Rc<std::cell::Cell<usize>>,
    }

    impl TrackedVariant {
        fn new(drops: std::rc::Rc<std::cell::Cell<usize>>) -> Self {
            Self { drops }
        }
    }

    impl Drop for TrackedVariant {
        fn drop(&mut self) {
            self.drops.set(self.drops.get() + 1);
        }
    }

    #[test]
    fn windows_com_reverses_dispatch_arguments() {
        let args = vec![
            ComValue::Str("path".into()),
            ComValue::Bool(true),
            ComValue::I32(17),
        ];
        let reversed = dispatch_args_in_reverse(&args);
        assert_eq!(
            reversed,
            vec![
                ComValue::I32(17),
                ComValue::Bool(true),
                ComValue::Str("path".into())
            ]
        );
    }

    #[test]
    fn windows_com_property_put_marshalling_has_named_dispid_and_reversed_value() {
        let call = DispatchCall {
            name: UPDATE_LINKS_AT_OPEN.into(),
            kind: InvokeKind::PropertyPut,
            args: vec![ComValue::Bool(false)],
        };
        let marshalled = marshal_dispatch_call(&call);
        assert_eq!(marshalled.args, vec![ComValue::Bool(false)]);
        assert_eq!(marshalled.named_dispids, vec![DISPID_PROPERTYPUT]);
    }

    #[test]
    fn windows_com_excepinfo_becomes_bounded_pathfree_stage_error() {
        let source_path = r"C:\Users\private\secret-report.docx";
        let output_path = r"C:\Temp\private\bridge.pdf";
        let description = format!("{} {source_path} {output_path}", "错".repeat(1000));
        let error = excepinfo_to_stage_error(
            DocumentRendererKind::Word,
            HelperProgressStage::Exporting,
            CommandErrorCode::DocumentRendererExportFailed,
            &description,
            &[source_path, output_path],
        );
        assert_eq!(error.code, CommandErrorCode::DocumentRendererExportFailed);
        assert_eq!(error.renderer_kind, Some(DocumentRendererKind::Word));
        assert_eq!(error.stage, Some(RendererStage::Exporting));
        assert_eq!(error.message, "导出 PDF 失败");
        let diagnostic = error.diagnostic.expect("diagnostic present");
        assert!(diagnostic.chars().count() <= 300);
        assert!(!diagnostic.contains(source_path));
        assert!(!diagnostic.contains(output_path));
    }

    #[test]
    fn windows_com_stage_mapping_is_exact() {
        assert_eq!(
            renderer_stage(HelperProgressStage::Starting),
            RendererStage::Launch
        );
        assert_eq!(
            renderer_stage(HelperProgressStage::ApplicationReady),
            RendererStage::ApplicationReady
        );
        assert_eq!(
            renderer_stage(HelperProgressStage::DocumentOpened),
            RendererStage::DocumentOpened
        );
        assert_eq!(
            renderer_stage(HelperProgressStage::Exporting),
            RendererStage::Exporting
        );
        assert_eq!(
            renderer_stage(HelperProgressStage::Cleanup),
            RendererStage::Cleanup
        );
    }

    #[test]
    fn windows_com_capability_probe_requires_exact_member_lists() {
        assert_eq!(
            REQUIRED_APP_MEMBERS,
            [
                "Visible",
                "DisplayAlerts",
                "AutomationSecurity",
                "Documents",
                "Quit"
            ]
        );
        assert_eq!(REQUIRED_OPTIONS_MEMBERS, ["UpdateLinksAtOpen"]);
        assert_eq!(REQUIRED_DOCUMENTS_MEMBERS, ["Open"]);
        assert_eq!(REQUIRED_DOCUMENT_MEMBERS, ["ExportAsFixedFormat", "Close"]);

        let complete = FakeDispatch::new(&REQUIRED_APP_MEMBERS);
        assert!(probe_app_capabilities(&complete));

        for omitted in REQUIRED_APP_MEMBERS {
            let members = REQUIRED_APP_MEMBERS
                .into_iter()
                .filter(|member| *member != omitted)
                .collect::<Vec<_>>();
            assert!(
                !probe_app_capabilities(&FakeDispatch::new(&members)),
                "{omitted}"
            );
        }

        assert!(probe_options_capabilities(&FakeDispatch::new(
            &REQUIRED_OPTIONS_MEMBERS
        )));
        assert!(!probe_options_capabilities(&FakeDispatch::new(&[])));
        assert!(probe_documents_capabilities(&FakeDispatch::new(
            &REQUIRED_DOCUMENTS_MEMBERS
        )));
        assert!(!probe_documents_capabilities(&FakeDispatch::new(&[])));
        assert!(probe_document_capabilities(&FakeDispatch::new(
            &REQUIRED_DOCUMENT_MEMBERS
        )));
        assert!(!probe_document_capabilities(&FakeDispatch::new(&["Close"])));
    }

    #[test]
    fn windows_com_wps_tries_kwps_then_legacy_wps() {
        assert_eq!(
            progid_candidates(DocumentRendererKind::Wps),
            &["KWPS.Application", "WPS.Application"]
        );
        assert_eq!(
            progid_candidates(DocumentRendererKind::Word),
            &["Word.Application"]
        );
    }

    #[test]
    fn windows_com_word_export_constants_match_office_values() {
        assert_eq!(WD_EXPORT_FORMAT_PDF, 17);
        assert_eq!(WD_DO_NOT_SAVE_CHANGES, 0);
        assert_eq!(MSO_AUTOMATION_SECURITY_FORCE_DISABLE, 3);
    }

    #[test]
    fn windows_com_safe_call_specs_cover_security_open_export_and_cleanup() {
        let security = security_property_calls();
        assert_eq!(
            security,
            vec![
                DispatchCall {
                    name: "Visible".into(),
                    kind: InvokeKind::PropertyPut,
                    args: vec![ComValue::Bool(false)],
                },
                DispatchCall {
                    name: "DisplayAlerts".into(),
                    kind: InvokeKind::PropertyPut,
                    args: vec![ComValue::I32(0)],
                },
                DispatchCall {
                    name: "AutomationSecurity".into(),
                    kind: InvokeKind::PropertyPut,
                    args: vec![ComValue::I32(3)],
                },
            ]
        );

        let open = document_open_call("C:/docs/report.docx");
        assert_eq!(open.name, "Open");
        assert_eq!(open.kind, InvokeKind::Method);
        assert_eq!(open.args.len(), 16);
        assert_eq!(open.args[0], ComValue::Str("C:/docs/report.docx".into()));
        assert_eq!(open.args[2], ComValue::Bool(true));
        assert_eq!(open.args[3], ComValue::Bool(false));
        assert_eq!(open.args[11], ComValue::Bool(false));
        assert_eq!(open.args[14], ComValue::Bool(true));
        assert_eq!(open.args[1], ComValue::Missing);
        assert_eq!(open.args[15], ComValue::Missing);

        assert_eq!(
            export_pdf_call("C:/temp/bridge.pdf").args,
            vec![
                ComValue::Str("C:/temp/bridge.pdf".into()),
                ComValue::I32(17),
                ComValue::Bool(false),
            ]
        );
        assert_eq!(close_document_call().args, vec![ComValue::I32(0)]);
        assert_eq!(quit_application_call().args, vec![ComValue::I32(0)]);
    }

    #[test]
    fn windows_com_variant_raii_cleans_owned_values_on_success_and_error() {
        use std::cell::Cell;
        use std::rc::Rc;

        let drops = Rc::new(Cell::new(0));
        {
            let _values = [
                TrackedVariant::new(drops.clone()),
                TrackedVariant::new(drops.clone()),
                TrackedVariant::new(drops.clone()),
            ];
        }
        assert_eq!(drops.get(), 3);

        let result: Result<(), ()> = (|| {
            let _values = [
                TrackedVariant::new(drops.clone()),
                TrackedVariant::new(drops.clone()),
            ];
            Err(())
        })();
        assert!(result.is_err());
        assert_eq!(drops.get(), 5);
    }
}
