use std::{fs, path::PathBuf, sync::Mutex};

use image::{codecs::jpeg::JpegEncoder, ColorType, GenericImageView, ImageBuffer, Rgb, Rgba};
use tempfile::tempdir;

use std::path::Path;

use imageasy_lib::commands::conversion::{
    convert_image_file, inspect_conversion_directory_with_counter,
    inspect_conversion_file_with_counter, prepare_document_render, ConvertImageFileRequest,
    InspectConversionFileResult, RenderDocumentToImagesRequest,
};
use imageasy_lib::commands::pdf_rendering::{
    count_pdf_pages, render_pdf_pages_with_callback, BitmapOutputFormat,
};
use imageasy_lib::document_renderer::bridge_cache::clear_bridge_cache;
use imageasy_lib::document_renderer::coordinator::{OfficeRenderFuture, OfficeRenderer};
use imageasy_lib::document_renderer::error::{
    CommandError, CommandErrorCode, DocumentRendererKind,
};

/// 假 PDF 页数计数器：所有 .pdf 返回固定页数，绝不绑定真实 PDFium。
fn fake_pdf_counter(pages: u32) -> impl FnMut(&Path) -> anyhow::Result<u32> {
    move |_path: &Path| Ok(pages)
}

/// 会 panic 的计数器：断言 Office 文档从不调用 PDF 页数探测。
fn never_called_counter() -> impl FnMut(&Path) -> anyhow::Result<u32> {
    move |path: &Path| panic!("PDF 页数计数器不应被调用: {}", path.display())
}

fn run_inspect_conversion_file(path: String) -> Result<InspectConversionFileResult, String> {
    inspect_conversion_file_with_counter(&path, &mut fake_pdf_counter(1))
}

fn run_inspect_conversion_directory(
    path: String,
) -> Result<Vec<InspectConversionFileResult>, String> {
    inspect_conversion_directory_with_counter(&path, fake_pdf_counter(1))
}

fn run_convert_image_file(request: ConvertImageFileRequest) -> Result<Vec<String>, String> {
    tauri::async_runtime::block_on(convert_image_file(request))
}

#[test]
fn inspect_conversion_file_reads_image_metadata() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 6, Rgba([120, 90, 80, 255]))
        .save(&source)
        .unwrap();

    let result = run_inspect_conversion_file(source.to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.kind, "image");
    assert_eq!(result.image_metadata.unwrap().width, 8);
    assert_eq!(result.source_name, "demo.png");
}

#[test]
fn inspect_conversion_file_reads_jpeg_metadata() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.jpg");
    let image = ImageBuffer::<Rgb<u8>, _>::from_pixel(13, 7, Rgb([20, 40, 60]));
    let mut bytes = Vec::new();
    JpegEncoder::new_with_quality(&mut bytes, 90)
        .encode(image.as_raw(), 13, 7, ColorType::Rgb8.into())
        .unwrap();
    fs::write(&source, bytes).unwrap();

    let result = run_inspect_conversion_file(source.to_string_lossy().into_owned()).unwrap();

    let metadata = result.image_metadata.unwrap();
    assert_eq!((metadata.width, metadata.height), (13, 7));
    assert_eq!(metadata.extension, "jpg");
}

#[test]
fn inspect_conversion_directory_recursively_collects_supported_files() {
    let dir = tempdir().unwrap();
    let nested = dir.path().join("nested");
    fs::create_dir_all(&nested).unwrap();

    ImageBuffer::<Rgb<u8>, _>::from_pixel(4, 4, Rgb([1, 2, 3]))
        .save(dir.path().join("a.jpg"))
        .unwrap();
    fs::write(
        nested.join("b.pdf"),
        b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF",
    )
    .unwrap();
    fs::write(nested.join("c.txt"), b"unsupported").unwrap();

    let result =
        run_inspect_conversion_directory(dir.path().to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.len(), 2);
    assert_eq!(result[0].kind, "image");
    assert_eq!(result[1].kind, "document");
}

#[test]
fn inspect_document_pdf_uses_injected_page_counter() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("report.pdf");
    fs::write(
        &source,
        b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF",
    )
    .unwrap();

    let result =
        inspect_conversion_file_with_counter(&source.to_string_lossy(), &mut fake_pdf_counter(7))
            .unwrap();

    assert_eq!(result.kind, "document");
    let metadata = result.document_metadata.unwrap();
    assert_eq!(metadata.page_count, Some(7));
    assert_eq!(metadata.extension, "pdf");
    assert!(result.error_message.is_none());
}

#[test]
fn inspect_document_pdf_keeps_document_kind_when_page_count_fails() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("broken.pdf");
    fs::write(&source, b"%PDF-not-readable").unwrap();

    let mut failing_counter = |_path: &Path| -> anyhow::Result<u32> {
        anyhow::bail!("无法读取 PDF 页数: mock failure")
    };

    let result =
        inspect_conversion_file_with_counter(&source.to_string_lossy(), &mut failing_counter)
            .unwrap();

    assert_eq!(result.kind, "document");
    let metadata = result.document_metadata.unwrap();
    assert_eq!(metadata.page_count, None);
    assert_eq!(metadata.extension, "pdf");
    assert!(
        result
            .error_message
            .as_deref()
            .is_some_and(|message| message.contains("已导入") && message.contains("页数")),
        "expected soft import warning, got {:?}",
        result.error_message
    );
}

#[test]
fn inspect_document_office_returns_unknown_page_count_without_probing() {
    for extension in ["docx", "doc", "wps"] {
        let dir = tempdir().unwrap();
        let source = dir.path().join(format!("report.{extension}"));
        fs::write(&source, b"fake-office").unwrap();

        // never_called_counter panics if a renderer probe runs for Office imports.
        let result = inspect_conversion_file_with_counter(
            &source.to_string_lossy(),
            &mut never_called_counter(),
        )
        .unwrap();

        assert_eq!(
            result.kind, "document",
            "{extension} should classify as document"
        );
        let metadata = result.document_metadata.unwrap();
        assert_eq!(
            metadata.page_count, None,
            "{extension} page count must be unknown"
        );
        assert_eq!(metadata.extension, extension);
    }
}

#[test]
fn inspect_document_rejects_missing_source_at_boundary() {
    let dir = tempdir().unwrap();
    let missing = dir.path().join("nope.pdf");

    let error = inspect_conversion_file_with_counter(
        &missing.to_string_lossy(),
        &mut never_called_counter(),
    )
    .unwrap_err();

    assert!(!error.is_empty());
}

#[test]
fn inspect_document_rejects_directory_source_at_boundary() {
    let dir = tempdir().unwrap();

    let error = inspect_conversion_file_with_counter(
        &dir.path().to_string_lossy(),
        &mut never_called_counter(),
    )
    .unwrap_err();

    assert!(!error.is_empty());
}

#[test]
fn inspect_document_directory_scan_includes_all_document_formats() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("a.docx"), b"fake").unwrap();
    fs::write(dir.path().join("b.doc"), b"fake").unwrap();
    fs::write(dir.path().join("c.wps"), b"fake").unwrap();
    fs::write(dir.path().join("d.pdf"), b"%PDF-1.4\n%%EOF").unwrap();

    let result = inspect_conversion_directory_with_counter(
        &dir.path().to_string_lossy(),
        fake_pdf_counter(3),
    )
    .unwrap();

    assert_eq!(result.len(), 4);
    assert!(result.iter().all(|item| item.kind == "document"));
    let pdf = result
        .iter()
        .find(|item| item.source_name == "d.pdf")
        .unwrap();
    assert_eq!(pdf.document_metadata.as_ref().unwrap().page_count, Some(3));
    let docx = result
        .iter()
        .find(|item| item.source_name == "a.docx")
        .unwrap();
    assert_eq!(docx.document_metadata.as_ref().unwrap().page_count, None);
}

#[test]
fn convert_image_file_writes_requested_format() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let target = dir.path().join("out").join("result.webp");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(12, 10, Rgba([160, 90, 40, 255]))
        .save(&source)
        .unwrap();

    let output_paths = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "webp".into(),
        color_mode: "rgb".into(),
        quality: Some(88),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap();

    let output_path = PathBuf::from(&output_paths[0]);
    let output = image::open(&output_path).unwrap();

    assert_eq!(output_path.extension().unwrap().to_string_lossy(), "webp");
    assert_eq!(output.dimensions(), (12, 10));
}

#[test]
fn convert_image_file_reencodes_jpeg_family_to_requested_jpg_name() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.jpg");
    let target = dir.path().join("out").join("result.png");

    let image = ImageBuffer::<Rgb<u8>, _>::from_pixel(10, 8, Rgb([50, 90, 130]));
    let mut bytes = Vec::new();
    let mut writer = std::io::BufWriter::new(&mut bytes);
    JpegEncoder::new_with_quality(&mut writer, 90)
        .encode(image.as_raw(), 10, 8, ColorType::Rgb8.into())
        .unwrap();
    drop(writer);
    fs::write(&source, bytes).unwrap();

    let output_paths = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "grayscale".into(),
        quality: Some(80),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap();

    let output_path = PathBuf::from(&output_paths[0]);
    let output = image::open(&output_path).unwrap();

    assert_eq!(
        output_path.file_name().unwrap().to_string_lossy(),
        "result.jpg"
    );
    assert_eq!(output.dimensions(), (10, 8));
}

#[test]
fn convert_image_file_writes_single_channel_grayscale_png() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let target = dir.path().join("out.png");

    ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([10, 120, 240]))
        .save(&source)
        .unwrap();

    let output_paths = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "png".into(),
        color_mode: "grayscale".into(),
        quality: Some(90),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap();

    assert_eq!(output_paths.len(), 1);
    let decoded = image::open(&output_paths[0]).unwrap();
    assert!(matches!(decoded, image::DynamicImage::ImageLuma8(_)));
}

#[test]
fn convert_image_file_writes_cmyk_jpeg() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let target = dir.path().join("out.jpg");

    ImageBuffer::<Rgb<u8>, _>::from_pixel(6, 4, Rgb([200, 20, 30]))
        .save(&source)
        .unwrap();

    let output_paths = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "cmyk".into(),
        quality: Some(90),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap();

    let bytes = fs::read(&output_paths[0]).unwrap();
    assert_eq!(&bytes[..2], [0xFF, 0xD8]);
    assert!(
        bytes.windows(5).any(|window| window == b"Adobe"),
        "CMYK JPEG must include Adobe APP14"
    );
    assert!(
        bytes.windows(12).any(|window| window == b"ICC_PROFILE\0"),
        "CMYK JPEG must embed the SWOP ICC profile"
    );
    assert_eq!(jpeg_sof_component_count(&bytes), Some(4));
}

fn jpeg_sof_component_count(bytes: &[u8]) -> Option<u8> {
    let mut index = 0;
    while index + 1 < bytes.len() {
        if bytes[index] != 0xFF {
            index += 1;
            continue;
        }
        let marker = bytes[index + 1];
        if marker == 0xD8 || marker == 0xD9 || (0xD0..=0xD7).contains(&marker) {
            index += 2;
            continue;
        }
        if index + 3 >= bytes.len() {
            return None;
        }
        let length = u16::from_be_bytes([bytes[index + 2], bytes[index + 3]]) as usize;
        if matches!(marker, 0xC0..=0xC2) {
            return bytes.get(index + 9).copied();
        }
        index = index.saturating_add(2).saturating_add(length);
    }
    None
}

#[test]
fn convert_image_file_rejects_cmyk_png() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let target = dir.path().join("out.png");

    ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([10, 20, 30]))
        .save(&source)
        .unwrap();

    let error = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "png".into(),
        color_mode: "cmyk".into(),
        quality: Some(90),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap_err();

    assert!(error.contains("CMYK 仅支持 JPG"));
    assert!(!target.exists());
}

#[test]
fn convert_image_file_writes_single_channel_grayscale_webp() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let target = dir.path().join("out.webp");

    ImageBuffer::<Rgb<u8>, _>::from_pixel(4, 4, Rgb([10, 120, 240]))
        .save(&source)
        .unwrap();

    let output_paths = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "webp".into(),
        color_mode: "grayscale".into(),
        quality: Some(90),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap();

    assert_eq!(output_paths.len(), 1);
    let decoded = image::open(&output_paths[0]).unwrap();
    assert_eq!(decoded.dimensions(), (4, 4));
}

#[test]
fn convert_image_file_applies_webp_quality() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let low_target = dir.path().join("out").join("low.webp");
    let high_target = dir.path().join("out").join("high.webp");

    let image = ImageBuffer::from_fn(96, 64, |x, y| {
        Rgb([
            ((x * 3 + y * 5) % 256) as u8,
            ((x * 7 + y * 11) % 256) as u8,
            ((x * 13 + y * 17) % 256) as u8,
        ])
    });
    image.save(&source).unwrap();

    let low_output = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: low_target.to_string_lossy().into_owned(),
        output_format: "webp".into(),
        color_mode: "rgb".into(),
        quality: Some(30),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap();
    let high_output = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: high_target.to_string_lossy().into_owned(),
        output_format: "webp".into(),
        color_mode: "rgb".into(),
        quality: Some(90),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap();

    let low_size = fs::metadata(&low_output[0]).unwrap().len();
    let high_size = fs::metadata(&high_output[0]).unwrap().len();

    assert_ne!(low_size, high_size);
}

fn write_test_jpeg(path: &std::path::Path, width: u32, height: u32, quality: u8) -> Vec<u8> {
    let image = ImageBuffer::<Rgb<u8>, _>::from_fn(width, height, |x, y| {
        Rgb([
            ((x * 17 + y * 3) % 256) as u8,
            ((x * 5 + y * 11) % 256) as u8,
            ((x * 7 + y * 13) % 256) as u8,
        ])
    });
    let mut bytes = Vec::new();
    JpegEncoder::new_with_quality(&mut bytes, quality)
        .encode(image.as_raw(), width, height, ColorType::Rgb8.into())
        .unwrap();
    fs::write(path, &bytes).unwrap();
    bytes
}

#[test]
fn convert_image_file_jpeg_copy_is_byte_identical_at_quality_100() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.jpg");
    let target = dir.path().join("out").join("copied.jpg");
    let original = write_test_jpeg(&source, 24, 16, 85);

    let output_paths = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: Some(100),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap();

    assert_eq!(output_paths.len(), 1);
    let copied = fs::read(&output_paths[0]).unwrap();
    assert_eq!(
        copied, original,
        "quality 100 JPG→JPG must copy bytes unchanged"
    );
}

#[test]
fn convert_image_file_jpeg_copy_reencodes_when_quality_is_99() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.jpg");
    let target = dir.path().join("out").join("reencoded.jpg");
    let original = write_test_jpeg(&source, 24, 16, 85);

    let output_paths = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: Some(99),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap();

    let reencoded = fs::read(&output_paths[0]).unwrap();
    assert_ne!(
        reencoded, original,
        "quality 99 must re-encode, not byte-copy"
    );
    assert_eq!(
        image::open(&output_paths[0]).unwrap().dimensions(),
        (24, 16)
    );
}

#[test]
fn convert_image_file_jpeg_copy_reencodes_when_color_mode_is_grayscale() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.jpg");
    let target = dir.path().join("out").join("gray.jpg");
    let original = write_test_jpeg(&source, 16, 12, 90);

    let output_paths = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "grayscale".into(),
        quality: Some(100),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap();

    let gray = fs::read(&output_paths[0]).unwrap();
    assert_ne!(gray, original);
    let decoded = image::open(&output_paths[0]).unwrap();
    assert!(matches!(decoded, image::DynamicImage::ImageLuma8(_)));
}

#[test]
fn convert_image_file_jpeg_copy_rejects_non_jpeg_bytes_with_jpg_extension() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("fake.jpg");
    let target = dir.path().join("out").join("should-not-exist.jpg");
    fs::write(&source, b"this is not a jpeg file").unwrap();

    let error = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: Some(100),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap_err();

    assert!(!target.exists(), "invalid JPEG must not be copied");
    assert!(!error.is_empty());
}

#[test]
fn convert_image_file_reencodes_in_place_when_source_overwrite_authorized() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("same.jpg");
    let original = write_test_jpeg(&source, 8, 8, 90);

    let output_paths = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: source.to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: Some(100),
        allow_source_overwrite: true,
        task_id: None,
    })
    .unwrap();

    // 授权原地覆盖：走原子重编码而非字节复制，且不得截断源文件。
    assert_eq!(output_paths.len(), 1);
    let after = fs::read(&output_paths[0]).unwrap();
    assert_eq!(image::open(&output_paths[0]).unwrap().dimensions(), (8, 8));
    let _ = (original, after);
}

#[test]
fn convert_image_file_rejects_same_source_output_without_authorization() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("same.jpg");
    let original = write_test_jpeg(&source, 8, 8, 90);

    let error = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: source.to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: Some(90),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap_err();

    assert!(!error.is_empty());
    // 未授权时源文件保持原样，不被截断或改写。
    assert_eq!(fs::read(&source).unwrap(), original);
}

#[test]
fn convert_image_file_rejects_missing_source() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("missing.png");
    let target = dir.path().join("out.png");

    let error = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "png".into(),
        color_mode: "rgb".into(),
        quality: Some(90),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap_err();

    assert!(!error.is_empty());
    assert!(!target.exists());
}

#[test]
fn convert_image_file_rejects_directory_source() {
    let dir = tempdir().unwrap();
    let target = dir.path().join("out.png");

    let error = run_convert_image_file(ConvertImageFileRequest {
        source_path: dir.path().to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "png".into(),
        color_mode: "rgb".into(),
        quality: Some(90),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap_err();

    assert!(!error.is_empty());
    assert!(!target.exists());
}

#[test]
fn convert_image_file_rejects_unsupported_output_format() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let target = dir.path().join("out.tiff");
    ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([1, 2, 3]))
        .save(&source)
        .unwrap();

    let error = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "tiff".into(),
        color_mode: "rgb".into(),
        quality: Some(90),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap_err();

    assert!(!error.is_empty());
}

#[test]
fn convert_image_file_rejects_unsupported_color_mode() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let target = dir.path().join("out.png");
    ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([1, 2, 3]))
        .save(&source)
        .unwrap();

    let error = run_convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "png".into(),
        color_mode: "sepia".into(),
        quality: Some(90),
        allow_source_overwrite: false,
        task_id: None,
    })
    .unwrap_err();

    assert!(!error.is_empty());
}

#[test]
fn convert_image_file_rejects_out_of_range_quality() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let target = dir.path().join("out.png");
    ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([1, 2, 3]))
        .save(&source)
        .unwrap();

    for quality in [Some(0u8), Some(101u8)] {
        let error = run_convert_image_file(ConvertImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_path: target.to_string_lossy().into_owned(),
            output_format: "png".into(),
            color_mode: "rgb".into(),
            quality,
            allow_source_overwrite: false,
            task_id: None,
        })
        .unwrap_err();

        assert!(!error.is_empty(), "quality {quality:?} must be rejected");
    }
}

#[derive(Default)]
struct RouteRenderer {
    calls: Mutex<Vec<DocumentRendererKind>>,
}

impl OfficeRenderer for RouteRenderer {
    fn render_to_pdf<'a>(
        &'a self,
        renderer: DocumentRendererKind,
        _source: &'a Path,
        requested_output: &'a Path,
    ) -> OfficeRenderFuture<'a> {
        Box::pin(async move {
            self.calls.lock().unwrap().push(renderer);
            std::fs::write(requested_output, b"%PDF-1.7\nroute-test").unwrap();
            Ok(requested_output.to_path_buf())
        })
    }
}

fn document_render_request(
    source: &Path,
    output_directory: &Path,
) -> RenderDocumentToImagesRequest {
    RenderDocumentToImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: output_directory.to_string_lossy().into_owned(),
        output_format: "webp".into(),
        color_mode: "grayscale".into(),
        quality: 73,
        page_numbers: vec![],
        render_density: "high".into(),
        naming_pattern: "source-name-index".into(),
        task_id: None,
    }
}

#[tokio::test]
async fn render_document_command_pdf_bypasses_helper_and_keeps_encoding_settings() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("report.pdf");
    std::fs::write(&source, b"%PDF-1.7\ndirect").unwrap();
    let renderer = RouteRenderer::default();

    let job = prepare_document_render(
        document_render_request(&source, &dir.path().join("out")),
        &renderer,
    )
    .await
    .unwrap();

    assert!(renderer.calls.lock().unwrap().is_empty());
    assert_eq!(job.source_path(), source);
    assert_eq!(job.bitmap_output_format(), BitmapOutputFormat::Luma);
    assert_eq!(job.request().quality, 73);
    assert_eq!(job.request().output_format, "webp");
}

#[tokio::test]
async fn render_document_command_doc_and_docx_route_through_word() {
    for extension in ["doc", "docx"] {
        let dir = tempdir().unwrap();
        let source = dir.path().join(format!("report.{extension}"));
        std::fs::write(&source, b"office").unwrap();
        let renderer = RouteRenderer::default();

        let job = prepare_document_render(
            document_render_request(&source, &dir.path().join("out")),
            &renderer,
        )
        .await
        .unwrap();

        assert_eq!(
            renderer.calls.lock().unwrap().as_slice(),
            &[DocumentRendererKind::Word]
        );
        assert!(job.source_path().ends_with("bridge.pdf"));
        assert!(job.source_path().exists());
    }
}

#[tokio::test]
async fn render_document_command_wps_uses_wps_only() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("report.wps");
    std::fs::write(&source, b"office").unwrap();
    let renderer = RouteRenderer::default();

    let job = prepare_document_render(
        document_render_request(&source, &dir.path().join("out")),
        &renderer,
    )
    .await
    .unwrap();

    assert_eq!(
        renderer.calls.lock().unwrap().as_slice(),
        &[DocumentRendererKind::Wps]
    );
    assert!(job.source_path().ends_with("bridge.pdf"));
}

struct FailingRenderer(CommandError);

impl OfficeRenderer for FailingRenderer {
    fn render_to_pdf<'a>(
        &'a self,
        _renderer: DocumentRendererKind,
        _source: &'a Path,
        _requested_output: &'a Path,
    ) -> OfficeRenderFuture<'a> {
        Box::pin(async move { Err(self.0.clone()) })
    }
}

#[tokio::test]
async fn render_document_command_preserves_structured_renderer_error() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("report.wps");
    std::fs::write(&source, b"office").unwrap();
    let expected = CommandError::new(
        CommandErrorCode::WpsRendererNotAvailable,
        "WPS 文件转图片需要 WPS Office。",
    )
    .with_renderer(DocumentRendererKind::Wps);

    let error = prepare_document_render(
        document_render_request(&source, &dir.path().join("out")),
        &FailingRenderer(expected.clone()),
    )
    .await
    .unwrap_err();

    assert_eq!(error, expected);
}

#[tokio::test]
async fn render_document_command_rejects_invalid_inputs_before_helper() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("report.wps");
    std::fs::write(&source, b"office").unwrap();

    for invalid in ["format", "color", "quality", "density", "naming", "page"] {
        let renderer = RouteRenderer::default();
        let mut request = document_render_request(&source, &dir.path().join("out"));
        match invalid {
            "format" => request.output_format = "tiff".into(),
            "color" => request.color_mode = "sepia".into(),
            "quality" => request.quality = 0,
            "density" => request.render_density = "ultra".into(),
            "naming" => request.naming_pattern = "unsafe".into(),
            "page" => request.page_numbers = vec![0],
            _ => unreachable!(),
        }

        assert!(prepare_document_render(request, &renderer).await.is_err());
        assert!(renderer.calls.lock().unwrap().is_empty(), "{invalid}");
    }
}

/// 生成 PDFium 可渲染的空白多页 PDF，供真实渲染冒烟使用。
fn write_blank_multipage_pdf(path: &Path, page_count: u32) {
    assert!(page_count >= 1);
    let mut objects: Vec<Vec<u8>> = Vec::new();
    let pages_kids: String = (0..page_count)
        .map(|index| format!("{} 0 R", 3 + index * 2))
        .collect::<Vec<_>>()
        .join(" ");
    objects.push(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n".to_vec());
    objects.push(
        format!("2 0 obj\n<< /Type /Pages /Kids [{pages_kids}] /Count {page_count} >>\nendobj\n")
            .into_bytes(),
    );
    for index in 0..page_count {
        let page_id = 3 + index * 2;
        let content_id = page_id + 1;
        let gray = 0.2 + 0.15 * f64::from(index);
        let stream = format!("q\n{gray:.2} g\n0 0 200 200 re\nf\nQ\n");
        objects.push(
            format!(
                "{page_id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents {content_id} 0 R >>\nendobj\n"
            )
            .into_bytes(),
        );
        objects.push(
            format!(
                "{content_id} 0 obj\n<< /Length {} >>\nstream\n{stream}endstream\nendobj\n",
                stream.len()
            )
            .into_bytes(),
        );
    }
    let mut content = b"%PDF-1.4\n".to_vec();
    let mut offsets = vec![0usize];
    for object in &objects {
        offsets.push(content.len());
        content.extend_from_slice(object);
    }
    let xref_start = content.len();
    let size = objects.len() + 1;
    content.extend_from_slice(format!("xref\n0 {size}\n").as_bytes());
    content.extend_from_slice(b"0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        content.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    content.extend_from_slice(
        format!("trailer\n<< /Size {size} /Root 1 0 R >>\nstartxref\n").as_bytes(),
    );
    content.extend_from_slice(xref_start.to_string().as_bytes());
    content.extend_from_slice(b"\n%%EOF\n");
    fs::write(path, content).unwrap();
}

fn test_pdfium_resource_dir() -> Option<PathBuf> {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dll = manifest.join("pdfium").join("pdfium.dll");
    dll.is_file().then_some(manifest)
}

/// Fake Office 导出真实多页 PDF；第二次 prepare 走桥接缓存，再经 PDFium 并行渲染。
#[derive(Default)]
struct MultipagePdfRenderer {
    calls: Mutex<Vec<DocumentRendererKind>>,
}

impl OfficeRenderer for MultipagePdfRenderer {
    fn render_to_pdf<'a>(
        &'a self,
        renderer: DocumentRendererKind,
        _source: &'a Path,
        requested_output: &'a Path,
    ) -> OfficeRenderFuture<'a> {
        Box::pin(async move {
            self.calls.lock().unwrap().push(renderer);
            write_blank_multipage_pdf(requested_output, 4);
            Ok(requested_output.to_path_buf())
        })
    }
}

#[tokio::test]
async fn office_bridge_cache_then_pdfium_parallel_rasterize() {
    let Some(resource_dir) = test_pdfium_resource_dir() else {
        eprintln!("skip office_bridge_cache_then_pdfium_parallel_rasterize: pdfium.dll missing");
        return;
    };
    clear_bridge_cache();

    let dir = tempdir().unwrap();
    let source = dir.path().join("report.docx");
    fs::write(&source, b"office-body-for-pdfium").unwrap();
    let renderer = MultipagePdfRenderer::default();

    let first = prepare_document_render(
        document_render_request(&source, &dir.path().join("out-a")),
        &renderer,
    )
    .await
    .unwrap();
    assert_eq!(
        renderer.calls.lock().unwrap().as_slice(),
        &[DocumentRendererKind::Word]
    );
    assert_eq!(
        count_pdf_pages(first.source_path(), Some(resource_dir.as_path())).unwrap(),
        4
    );
    drop(first);

    // 改输出格式语义：同源二次 prepare 应命中桥接缓存，不再调用 Office。
    let second = prepare_document_render(
        {
            let mut request = document_render_request(&source, &dir.path().join("out-b"));
            request.output_format = "png".into();
            request.color_mode = "rgb".into();
            request.quality = 90;
            request
        },
        &renderer,
    )
    .await
    .unwrap();
    assert_eq!(
        renderer.calls.lock().unwrap().as_slice(),
        &[DocumentRendererKind::Word],
        "same source must reuse cached bridge.pdf"
    );

    let mut pages = Vec::new();
    render_pdf_pages_with_callback(
        second.source_path(),
        Some(resource_dir.as_path()),
        &[],
        "standard",
        |page| {
            pages.push(page.page_number);
            assert!(page.image.width() > 0);
            Ok(())
        },
    )
    .expect("cached bridge must rasterize via PDFium");
    assert_eq!(pages, vec![1, 2, 3, 4]);
    clear_bridge_cache();
}
