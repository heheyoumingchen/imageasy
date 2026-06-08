use anyhow::{Context, Result};
use image::DynamicImage;
use pdfium_render::prelude::*;
use std::path::{Path, PathBuf};

#[derive(Debug)]
pub struct RenderedPdfPage {
    pub page_number: u32,
    pub image: DynamicImage,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PdfiumRuntimePlatform {
    Windows,
    Macos,
}

impl PdfiumRuntimePlatform {
    fn current() -> Option<Self> {
        if cfg!(target_os = "windows") {
            Some(Self::Windows)
        } else if cfg!(target_os = "macos") {
            Some(Self::Macos)
        } else {
            None
        }
    }

    fn library_file_name(self) -> &'static str {
        match self {
            Self::Windows => "pdfium.dll",
            Self::Macos => "libpdfium.dylib",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Windows => "windows",
            Self::Macos => "macos",
        }
    }
}

fn pdfium_candidate_paths(
    platform: PdfiumRuntimePlatform,
    resource_dir: Option<&Path>,
    exe_dir: Option<&Path>,
) -> Vec<PathBuf> {
    let file_name = platform.library_file_name();
    let mut candidates = Vec::new();

    if let Some(resource_dir) = resource_dir {
        candidates.push(resource_dir.join("pdfium").join(file_name));
    }

    if let Some(exe_dir) = exe_dir {
        candidates.push(exe_dir.join(file_name));
        candidates.push(exe_dir.join("pdfium").join(file_name));
    }

    candidates
}

#[cfg(test)]
fn pdfium_candidate_paths_for_test(
    platform: &str,
    resource_dir: Option<&Path>,
    exe_dir: Option<&Path>,
) -> Vec<PathBuf> {
    let platform = match platform {
        "windows" => PdfiumRuntimePlatform::Windows,
        "macos" => PdfiumRuntimePlatform::Macos,
        other => panic!("unsupported test platform: {other}"),
    };
    pdfium_candidate_paths(platform, resource_dir, exe_dir)
}

fn current_exe_dir() -> Option<PathBuf> {
    std::env::current_exe().ok().and_then(|path| path.parent().map(Path::to_path_buf))
}

fn bind_pdfium(resource_dir: Option<&Path>) -> Result<Pdfium> {
    let Some(platform) = PdfiumRuntimePlatform::current() else {
        let bindings = Pdfium::bind_to_system_library()
            .map_err(|_| anyhow::anyhow!("PDF_RENDERER_NOT_AVAILABLE: 当前平台暂不支持自动定位 PDFium 运行库"))?;
        return Ok(Pdfium::new(bindings));
    };

    let exe_dir = current_exe_dir();
    let candidates = pdfium_candidate_paths(platform, resource_dir, exe_dir.as_deref());
    let mut attempted = Vec::new();

    for candidate in &candidates {
        attempted.push(candidate.display().to_string());
        if !candidate.exists() {
            continue;
        }
        if let Ok(bindings) = Pdfium::bind_to_library(candidate) {
            return Ok(Pdfium::new(bindings));
        }
    }

    if let Ok(bindings) = Pdfium::bind_to_system_library() {
        return Ok(Pdfium::new(bindings));
    }

    anyhow::bail!(
        "PDF_RENDERER_NOT_AVAILABLE: 平台={}，期望库名={}，尝试位置={:?}，且系统库绑定失败",
        platform.label(),
        platform.library_file_name(),
        attempted,
    )
}

pub fn render_pdf_pages(
    source_path: &Path,
    resource_dir: Option<&Path>,
    page_numbers: &[u32],
    render_density: &str,
) -> Result<Vec<RenderedPdfPage>> {
    let pdfium = bind_pdfium(resource_dir)?;
    let document = pdfium
        .load_pdf_from_file(source_path, None)
        .with_context(|| format!("无法渲染 PDF 文档: {}", source_path.display()))?;

    let total_pages = document.pages().len() as u32;
    if total_pages == 0 {
        return Ok(Vec::new());
    }

    let selected_pages: Vec<u32> = if page_numbers.is_empty() {
        (1..=total_pages).collect()
    } else {
        page_numbers.to_vec()
    };

    let target_width = if render_density == "high" { 2480 } else { 1240 };
    let mut rendered = Vec::new();

    for page_number in selected_pages {
        if page_number == 0 || page_number > total_pages {
            anyhow::bail!("页码超出范围: {page_number}");
        }
        let page_index = (page_number - 1) as u16;
        let page = document.pages().get(page_index)?;
        let bitmap = page.render_with_config(&PdfRenderConfig::new().set_target_width(target_width))?;
        rendered.push(RenderedPdfPage {
            page_number,
            image: DynamicImage::ImageRgb8(bitmap.as_image().to_rgb8()),
        });
    }

    Ok(rendered)
}

#[cfg(test)]
mod tests {
    use super::pdfium_candidate_paths_for_test;
    use std::path::PathBuf;

    #[test]
    fn windows_pdfium_candidates_include_resource_exe_and_subdir_layouts() {
        let resource_dir = PathBuf::from("C:/app/resources");
        let exe_dir = PathBuf::from("C:/app/bin");

        let candidates = pdfium_candidate_paths_for_test("windows", Some(&resource_dir), Some(&exe_dir));

        assert_eq!(candidates[0], resource_dir.join("pdfium").join("pdfium.dll"));
        assert_eq!(candidates[1], exe_dir.join("pdfium.dll"));
        assert_eq!(candidates[2], exe_dir.join("pdfium").join("pdfium.dll"));
    }

    #[test]
    fn macos_pdfium_candidates_include_resource_exe_and_subdir_layouts() {
        let resource_dir = PathBuf::from("/Applications/Imgere.app/Contents/Resources");
        let exe_dir = PathBuf::from("/Applications/Imgere.app/Contents/MacOS");

        let candidates = pdfium_candidate_paths_for_test("macos", Some(&resource_dir), Some(&exe_dir));

        assert_eq!(candidates[0], resource_dir.join("pdfium").join("libpdfium.dylib"));
        assert_eq!(candidates[1], exe_dir.join("libpdfium.dylib"));
        assert_eq!(candidates[2], exe_dir.join("pdfium").join("libpdfium.dylib"));
    }
}
