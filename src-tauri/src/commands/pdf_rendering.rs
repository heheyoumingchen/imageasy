use anyhow::{Context, Result};
use image::{DynamicImage, GrayImage, RgbImage};
use pdfium_render::prelude::*;
use std::path::{Path, PathBuf};

#[derive(Debug)]
pub struct RenderedPdfPage {
    pub page_number: u32,
    pub image: DynamicImage,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BitmapPixelFormat {
    Bgra,
    Bgrx,
    Bgr,
    Gray,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BitmapOutputFormat {
    Rgb,
    Luma,
}

#[derive(Debug, Clone, Copy)]
pub struct BitmapView<'a> {
    pub width: u32,
    pub height: u32,
    pub stride: usize,
    pub format: BitmapPixelFormat,
    pub bytes: &'a [u8],
    pub background: [u8; 3],
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
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
}

#[derive(Debug)]
struct PdfiumCandidateAttempt {
    path: PathBuf,
    existed: bool,
    bind_error: Option<String>,
}

fn pdfium_unavailable_message(
    platform: PdfiumRuntimePlatform,
    attempts: &[PdfiumCandidateAttempt],
    system_error: Option<String>,
) -> String {
    let attempted: Vec<String> = attempts
        .iter()
        .map(|attempt| {
            let mut detail = if attempt.existed {
                format!("{}（存在", attempt.path.display())
            } else {
                format!("{}（不存在", attempt.path.display())
            };
            if let Some(error) = &attempt.bind_error {
                detail.push_str(&format!("，存在但绑定失败: {error}"));
            }
            detail.push('）');
            detail
        })
        .collect();
    let system_error = system_error.unwrap_or_else(|| "未知错误".to_string());

    format!(
        "PDF_RENDERER_NOT_AVAILABLE: 平台={}，期望库名={}，尝试位置=[{}]，系统库绑定失败: {}",
        platform.label(),
        platform.library_file_name(),
        attempted.join(", "),
        system_error,
    )
}

#[cfg(test)]
fn pdfium_unavailable_message_for_test<F>(
    platform: &str,
    resource_dir: Option<&Path>,
    exe_dir: Option<&Path>,
    mut bind: F,
) -> String
where
    F: FnMut(&Path) -> std::result::Result<(), String>,
{
    let platform = match platform {
        "windows" => PdfiumRuntimePlatform::Windows,
        "macos" => PdfiumRuntimePlatform::Macos,
        other => panic!("unsupported test platform: {other}"),
    };
    let attempts = pdfium_candidate_paths(platform, resource_dir, exe_dir)
        .into_iter()
        .map(|path| {
            let existed = path.exists();
            let bind_error = if existed { bind(&path).err() } else { None };
            PdfiumCandidateAttempt {
                path,
                existed,
                bind_error,
            }
        })
        .collect::<Vec<_>>();

    pdfium_unavailable_message(platform, &attempts, Some("mock system bind failed".into()))
}

fn bind_pdfium(resource_dir: Option<&Path>) -> Result<Pdfium> {
    let Some(platform) = PdfiumRuntimePlatform::current() else {
        let bindings = Pdfium::bind_to_system_library().map_err(|error| {
            anyhow::anyhow!(
                "PDF_RENDERER_NOT_AVAILABLE: 当前平台暂不支持自动定位 PDFium 运行库，系统库绑定失败: {}",
                error
            )
        })?;
        return Ok(Pdfium::new(bindings));
    };

    let exe_dir = current_exe_dir();
    let candidates = pdfium_candidate_paths(platform, resource_dir, exe_dir.as_deref());
    let mut attempts = Vec::new();

    for candidate in &candidates {
        let existed = candidate.exists();
        if !existed {
            attempts.push(PdfiumCandidateAttempt {
                path: candidate.clone(),
                existed,
                bind_error: None,
            });
            continue;
        }

        match Pdfium::bind_to_library(candidate) {
            Ok(bindings) => return Ok(Pdfium::new(bindings)),
            Err(error) => attempts.push(PdfiumCandidateAttempt {
                path: candidate.clone(),
                existed,
                bind_error: Some(error.to_string()),
            }),
        }
    }

    match Pdfium::bind_to_system_library() {
        Ok(bindings) => Ok(Pdfium::new(bindings)),
        Err(error) => anyhow::bail!(pdfium_unavailable_message(
            platform,
            &attempts,
            Some(error.to_string())
        )),
    }
}

/// 打开 PDF 并返回页数；导入阶段用于填充 `DocumentMetadata.page_count`。
pub fn count_pdf_pages(source_path: &Path, resource_dir: Option<&Path>) -> Result<u32> {
    let pdfium = bind_pdfium(resource_dir)?;
    let document = pdfium
        .load_pdf_from_file(source_path, None)
        .with_context(|| format!("无法读取 PDF 页数: {}", source_path.display()))?;
    Ok(document.pages().len() as u32)
}

fn selected_pdf_pages(total_pages: u32, page_numbers: &[u32]) -> Result<Vec<u32>> {
    let selected = if page_numbers.is_empty() {
        (1..=total_pages).collect()
    } else {
        page_numbers.to_vec()
    };

    if let Some(page_number) = selected
        .iter()
        .copied()
        .find(|page_number| *page_number == 0 || *page_number > total_pages)
    {
        anyhow::bail!("页码超出范围: {page_number}");
    }

    Ok(selected)
}

fn bitmap_bytes_per_pixel(format: BitmapPixelFormat) -> Result<usize> {
    match format {
        BitmapPixelFormat::Bgra | BitmapPixelFormat::Bgrx => Ok(4),
        BitmapPixelFormat::Bgr => Ok(3),
        BitmapPixelFormat::Gray => Ok(1),
        BitmapPixelFormat::Unknown => anyhow::bail!("未知 PDF 位图格式"),
    }
}

fn composite_channel(source: u8, background: u8, alpha: u8) -> u8 {
    let alpha = u32::from(alpha);
    (((u32::from(source) * alpha) + (u32::from(background) * (255 - alpha)) + 127) / 255) as u8
}

fn rgb_to_luma(red: u8, green: u8, blue: u8) -> u8 {
    ((2_126 * u32::from(red) + 7_152 * u32::from(green) + 722 * u32::from(blue) + 5_000) / 10_000)
        as u8
}

pub fn convert_bitmap_view(
    view: BitmapView<'_>,
    output_format: BitmapOutputFormat,
) -> Result<DynamicImage> {
    if view.width == 0 || view.height == 0 {
        anyhow::bail!("PDF 位图尺寸不能为零");
    }

    let width = usize::try_from(view.width).context("PDF 位图宽度过大")?;
    let height = usize::try_from(view.height).context("PDF 位图高度过大")?;
    let bytes_per_pixel = bitmap_bytes_per_pixel(view.format)?;
    let row_bytes = width
        .checked_mul(bytes_per_pixel)
        .context("PDF 位图行字节数溢出")?;
    if view.stride < row_bytes {
        anyhow::bail!("PDF 位图 stride 小于像素行长度");
    }
    let required_bytes = view
        .stride
        .checked_mul(height)
        .context("PDF 位图缓冲区长度溢出")?;
    if view.bytes.len() < required_bytes {
        anyhow::bail!("PDF 位图缓冲区过短");
    }

    let output_channels = match output_format {
        BitmapOutputFormat::Rgb => 3,
        BitmapOutputFormat::Luma => 1,
    };
    let output_len = width
        .checked_mul(height)
        .and_then(|pixels| pixels.checked_mul(output_channels))
        .context("PDF 输出图像尺寸溢出")?;
    let mut output = Vec::with_capacity(output_len);

    for row_index in 0..height {
        let row_start = row_index
            .checked_mul(view.stride)
            .context("PDF 位图行偏移溢出")?;
        let row_end = row_start
            .checked_add(row_bytes)
            .context("PDF 位图行结尾偏移溢出")?;
        let row = view
            .bytes
            .get(row_start..row_end)
            .context("PDF 位图行超出缓冲区")?;

        for pixel in row.chunks_exact(bytes_per_pixel) {
            let [red, green, blue] = match view.format {
                BitmapPixelFormat::Bgra => [
                    composite_channel(pixel[2], view.background[0], pixel[3]),
                    composite_channel(pixel[1], view.background[1], pixel[3]),
                    composite_channel(pixel[0], view.background[2], pixel[3]),
                ],
                BitmapPixelFormat::Bgr | BitmapPixelFormat::Bgrx => [pixel[2], pixel[1], pixel[0]],
                BitmapPixelFormat::Gray => [pixel[0], pixel[0], pixel[0]],
                BitmapPixelFormat::Unknown => unreachable!(),
            };

            match output_format {
                BitmapOutputFormat::Rgb => output.extend_from_slice(&[red, green, blue]),
                BitmapOutputFormat::Luma => output.push(rgb_to_luma(red, green, blue)),
            }
        }
    }

    match output_format {
        BitmapOutputFormat::Rgb => RgbImage::from_raw(view.width, view.height, output)
            .map(DynamicImage::ImageRgb8)
            .context("无法构建 PDF RGB 图像"),
        BitmapOutputFormat::Luma => GrayImage::from_raw(view.width, view.height, output)
            .map(DynamicImage::ImageLuma8)
            .context("无法构建 PDF 灰度图像"),
    }
}

fn convert_pdfium_bitmap(
    bitmap: &PdfBitmap<'_>,
    output_format: BitmapOutputFormat,
) -> Result<DynamicImage> {
    let width = u32::try_from(bitmap.width()).context("PDF 位图宽度无效")?;
    let height = u32::try_from(bitmap.height()).context("PDF 位图高度无效")?;
    let format = match bitmap.format()? {
        PdfBitmapFormat::BGRA => BitmapPixelFormat::Bgra,
        PdfBitmapFormat::BGRx => BitmapPixelFormat::Bgrx,
        PdfBitmapFormat::BGR => BitmapPixelFormat::Bgr,
        PdfBitmapFormat::Gray => BitmapPixelFormat::Gray,
        #[allow(deprecated)]
        PdfBitmapFormat::BRGx => BitmapPixelFormat::Bgrx,
    };
    let bytes = bitmap.as_raw_bytes();
    let height_usize = usize::try_from(height).context("PDF 位图高度过大")?;
    let stride = bytes
        .len()
        .checked_div(height_usize)
        .context("PDF 位图高度不能为零")?;
    convert_bitmap_view(
        BitmapView {
            width,
            height,
            stride,
            format,
            bytes: &bytes,
            background: [255, 255, 255],
        },
        output_format,
    )
}

pub fn run_pdf_page_pipeline<FRender, FCallback>(
    total_pages: u32,
    page_numbers: &[u32],
    mut render_page: FRender,
    mut on_page: FCallback,
) -> Result<()>
where
    FRender: FnMut(u32) -> Result<DynamicImage>,
    FCallback: FnMut(RenderedPdfPage) -> Result<()>,
{
    let selected_pages = selected_pdf_pages(total_pages, page_numbers)?;
    for page_number in selected_pages {
        let image = render_page(page_number)?;
        on_page(RenderedPdfPage { page_number, image })?;
    }
    Ok(())
}

pub fn render_pdf_pages_with_callback<F>(
    source_path: &Path,
    resource_dir: Option<&Path>,
    page_numbers: &[u32],
    render_density: &str,
    on_page: F,
) -> Result<()>
where
    F: FnMut(RenderedPdfPage) -> Result<()>,
{
    render_pdf_pages_with_format(
        source_path,
        resource_dir,
        page_numbers,
        render_density,
        BitmapOutputFormat::Rgb,
        on_page,
    )
}

pub fn render_pdf_pages_with_format<F>(
    source_path: &Path,
    resource_dir: Option<&Path>,
    page_numbers: &[u32],
    render_density: &str,
    output_format: BitmapOutputFormat,
    mut on_page: F,
) -> Result<()>
where
    F: FnMut(RenderedPdfPage) -> Result<()>,
{
    let pdfium = bind_pdfium(resource_dir)?;
    let document = pdfium
        .load_pdf_from_file(source_path, None)
        .with_context(|| format!("无法渲染 PDF 文档: {}", source_path.display()))?;

    let total_pages = document.pages().len() as u32;
    let selected_pages = selected_pdf_pages(total_pages, page_numbers)?;
    let target_width = if render_density == "high" { 2480 } else { 1240 };

    for page_number in selected_pages {
        let page_index = u16::try_from(page_number - 1).context("PDF 页码超过渲染器限制")?;
        let page = document.pages().get(page_index)?;
        let bitmap =
            page.render_with_config(&PdfRenderConfig::new().set_target_width(target_width))?;
        let image = convert_pdfium_bitmap(&bitmap, output_format)?;
        drop(bitmap);
        on_page(RenderedPdfPage { page_number, image })?;
    }

    Ok(())
}

pub fn render_pdf_pages(
    source_path: &Path,
    resource_dir: Option<&Path>,
    page_numbers: &[u32],
    render_density: &str,
) -> Result<Vec<RenderedPdfPage>> {
    let mut rendered = Vec::new();
    render_pdf_pages_with_callback(
        source_path,
        resource_dir,
        page_numbers,
        render_density,
        |page| {
            rendered.push(page);
            Ok(())
        },
    )?;
    Ok(rendered)
}

#[cfg(test)]
mod tests {
    use super::{
        convert_bitmap_view, pdfium_candidate_paths_for_test, pdfium_unavailable_message_for_test,
        run_pdf_page_pipeline, BitmapOutputFormat, BitmapPixelFormat, BitmapView,
    };
    use anyhow::Result;
    use image::DynamicImage;
    use std::{cell::Cell, fs, path::PathBuf, rc::Rc};
    use tempfile::tempdir;

    #[test]
    fn windows_pdfium_candidates_include_resource_exe_and_subdir_layouts() {
        let resource_dir = PathBuf::from("C:/app/resources");
        let exe_dir = PathBuf::from("C:/app/bin");

        let candidates =
            pdfium_candidate_paths_for_test("windows", Some(&resource_dir), Some(&exe_dir));

        assert_eq!(
            candidates[0],
            resource_dir.join("pdfium").join("pdfium.dll")
        );
        assert_eq!(candidates[1], exe_dir.join("pdfium.dll"));
        assert_eq!(candidates[2], exe_dir.join("pdfium").join("pdfium.dll"));
    }

    #[test]
    fn macos_pdfium_candidates_include_resource_exe_and_subdir_layouts() {
        let resource_dir = PathBuf::from("/Applications/Imgere.app/Contents/Resources");
        let exe_dir = PathBuf::from("/Applications/Imgere.app/Contents/MacOS");

        let candidates =
            pdfium_candidate_paths_for_test("macos", Some(&resource_dir), Some(&exe_dir));

        assert_eq!(
            candidates[0],
            resource_dir.join("pdfium").join("libpdfium.dylib")
        );
        assert_eq!(candidates[1], exe_dir.join("libpdfium.dylib"));
        assert_eq!(
            candidates[2],
            exe_dir.join("pdfium").join("libpdfium.dylib")
        );
    }

    #[test]
    fn pdfium_unavailable_message_reports_existing_candidate_bind_failure() {
        let dir = tempdir().unwrap();
        let resource_dir = dir.path().join("resources");
        let exe_dir = dir.path().join("bin");
        let candidate = resource_dir.join("pdfium").join("pdfium.dll");
        fs::create_dir_all(candidate.parent().unwrap()).unwrap();
        fs::create_dir_all(&exe_dir).unwrap();
        fs::write(&candidate, b"not a real dll").unwrap();

        let message = pdfium_unavailable_message_for_test(
            "windows",
            Some(&resource_dir),
            Some(&exe_dir),
            |path| Err(format!("mock bind failed for {}", path.display())),
        );

        assert!(message.contains("PDF_RENDERER_NOT_AVAILABLE"));
        assert!(message.contains(candidate.to_string_lossy().as_ref()));
        assert!(message.contains("存在但绑定失败"));
        assert!(message.contains("mock bind failed"));
    }

    #[test]
    fn pdf_page_pipeline_empty_selection_means_all_and_preserves_order() {
        let mut rendered = Vec::new();
        run_pdf_page_pipeline(
            3,
            &[],
            |page_number| Ok(DynamicImage::new_rgb8(page_number, 1)),
            |page| {
                rendered.push(page.page_number);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(rendered, vec![1, 2, 3]);

        rendered.clear();
        run_pdf_page_pipeline(
            3,
            &[3, 1],
            |page_number| Ok(DynamicImage::new_rgb8(page_number, 1)),
            |page| {
                rendered.push(page.page_number);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(rendered, vec![3, 1]);
    }

    #[test]
    fn pdf_page_pipeline_rejects_every_invalid_page_before_first_callback() {
        for pages in [vec![0, 1], vec![1, 4]] {
            let callbacks = Cell::new(0);
            let error = run_pdf_page_pipeline(
                3,
                &pages,
                |_| Ok(DynamicImage::new_rgb8(1, 1)),
                |_| {
                    callbacks.set(callbacks.get() + 1);
                    Ok(())
                },
            )
            .unwrap_err();
            assert!(error.to_string().contains("页码超出范围"));
            assert_eq!(callbacks.get(), 0);
        }
    }

    struct DropTrackedImage {
        image: Option<DynamicImage>,
        alive: Rc<Cell<bool>>,
    }

    impl DropTrackedImage {
        fn into_image(mut self) -> DynamicImage {
            self.image.take().unwrap()
        }
    }

    impl Drop for DropTrackedImage {
        fn drop(&mut self) {
            self.alive.set(false);
        }
    }

    #[test]
    fn pdf_page_pipeline_drops_render_intermediate_before_callback() {
        let alive = Rc::new(Cell::new(false));
        let observed = Rc::clone(&alive);
        run_pdf_page_pipeline(
            1,
            &[1],
            |_| {
                alive.set(true);
                let tracked = DropTrackedImage {
                    image: Some(DynamicImage::new_rgb8(1, 1)),
                    alive: Rc::clone(&alive),
                };
                Ok(tracked.into_image())
            },
            |_| {
                assert!(!observed.get());
                Ok(())
            },
        )
        .unwrap();
    }

    fn bitmap_view<'a>(
        width: u32,
        height: u32,
        stride: usize,
        format: BitmapPixelFormat,
        bytes: &'a [u8],
    ) -> BitmapView<'a> {
        BitmapView {
            width,
            height,
            stride,
            format,
            bytes,
            background: [255, 255, 255],
        }
    }

    #[test]
    fn pdf_bitmap_conversion_bgrx_and_bgr_rows_are_stride_aware() -> Result<()> {
        let bgrx = convert_bitmap_view(
            bitmap_view(2, 1, 8, BitmapPixelFormat::Bgrx, &[3, 2, 1, 0, 6, 5, 4, 0]),
            BitmapOutputFormat::Rgb,
        )?;
        assert_eq!(bgrx.into_rgb8().into_raw(), vec![1, 2, 3, 4, 5, 6]);

        let bgr = convert_bitmap_view(
            bitmap_view(
                1,
                2,
                4,
                BitmapPixelFormat::Bgr,
                &[30, 20, 10, 99, 60, 50, 40, 88],
            ),
            BitmapOutputFormat::Rgb,
        )?;
        assert_eq!(bgr.into_rgb8().into_raw(), vec![10, 20, 30, 40, 50, 60]);
        Ok(())
    }

    #[test]
    fn pdf_bitmap_conversion_bgra_composites_alpha_onto_white() {
        let image = convert_bitmap_view(
            bitmap_view(
                2,
                1,
                8,
                BitmapPixelFormat::Bgra,
                &[0, 0, 0, 0, 0, 0, 0, 128],
            ),
            BitmapOutputFormat::Rgb,
        )
        .unwrap();
        assert_eq!(
            image.into_rgb8().into_raw(),
            vec![255, 255, 255, 127, 127, 127]
        );
    }

    #[test]
    fn pdf_bitmap_conversion_gray_padding_supports_rgb_and_direct_luma() {
        let view = bitmap_view(
            2,
            2,
            4,
            BitmapPixelFormat::Gray,
            &[10, 20, 0, 0, 30, 40, 0, 0],
        );
        let rgb = convert_bitmap_view(view, BitmapOutputFormat::Rgb).unwrap();
        assert_eq!(
            rgb.into_rgb8().into_raw(),
            vec![10, 10, 10, 20, 20, 20, 30, 30, 30, 40, 40, 40]
        );
        let luma = convert_bitmap_view(view, BitmapOutputFormat::Luma).unwrap();
        assert_eq!(luma.into_luma8().into_raw(), vec![10, 20, 30, 40]);
    }

    #[test]
    fn pdf_bitmap_conversion_rgb_to_luma_uses_final_single_channel_allocation() {
        let image = convert_bitmap_view(
            bitmap_view(1, 1, 3, BitmapPixelFormat::Bgr, &[0, 0, 255]),
            BitmapOutputFormat::Luma,
        )
        .unwrap();
        assert_eq!(image.into_luma8().into_raw(), vec![54]);
    }

    #[test]
    fn pdf_bitmap_conversion_rejects_malformed_or_unsupported_views() {
        let cases = [
            bitmap_view(1, 1, 2, BitmapPixelFormat::Bgr, &[0, 0]),
            bitmap_view(1, 2, 3, BitmapPixelFormat::Bgr, &[0, 0, 0]),
            bitmap_view(0, 1, 0, BitmapPixelFormat::Gray, &[]),
            bitmap_view(1, 1, 1, BitmapPixelFormat::Unknown, &[0]),
            bitmap_view(u32::MAX, u32::MAX, usize::MAX, BitmapPixelFormat::Bgrx, &[]),
        ];
        for view in cases {
            assert!(convert_bitmap_view(view, BitmapOutputFormat::Rgb).is_err());
        }
    }
}
