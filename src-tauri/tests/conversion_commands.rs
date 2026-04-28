use std::{fs, path::PathBuf};

use image::{GenericImageView, ImageBuffer, Rgb, Rgba};
use tempfile::tempdir;

use image_batch_helper_lib::commands::conversion::{
    convert_image_file, inspect_conversion_directory, inspect_conversion_file, render_document_to_images,
    ConvertImageFileRequest, RenderDocumentToImagesRequest,
};

#[test]
fn inspect_conversion_file_reads_image_metadata() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 6, Rgba([120, 90, 80, 255]))
        .save(&source)
        .unwrap();

    let result = inspect_conversion_file(source.to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.kind, "image");
    assert_eq!(result.image_metadata.unwrap().width, 8);
    assert_eq!(result.source_name, "demo.png");
}

#[test]
fn inspect_conversion_directory_recursively_collects_supported_files() {
    let dir = tempdir().unwrap();
    let nested = dir.path().join("nested");
    fs::create_dir_all(&nested).unwrap();

    ImageBuffer::<Rgb<u8>, _>::from_pixel(4, 4, Rgb([1, 2, 3]))
        .save(dir.path().join("a.jpg"))
        .unwrap();
    fs::write(nested.join("b.pdf"), b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF").unwrap();
    fs::write(nested.join("c.txt"), b"unsupported").unwrap();

    let result = inspect_conversion_directory(dir.path().to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.len(), 2);
    assert_eq!(result[0].kind, "image");
    assert_eq!(result[1].kind, "document");
}

#[test]
fn convert_image_file_writes_requested_format() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let target = dir.path().join("out").join("result.webp");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(12, 10, Rgba([160, 90, 40, 255]))
        .save(&source)
        .unwrap();

    let output_paths = convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "webp".into(),
        color_mode: "rgb".into(),
        quality: Some(88),
    })
    .unwrap();

    let output_path = PathBuf::from(&output_paths[0]);
    let output = image::open(&output_path).unwrap();

    assert_eq!(output_path.extension().unwrap().to_string_lossy(), "webp");
    assert_eq!(output.dimensions(), (12, 10));
}

#[test]
fn render_document_to_images_rejects_missing_docx_runtime_with_clear_error() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.docx");
    fs::write(&source, b"fake-docx").unwrap();

    let error = render_document_to_images(RenderDocumentToImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        page_numbers: vec![1],
        render_density: "standard".into(),
        naming_pattern: "source-name-page".into(),
    })
    .unwrap_err();

    assert!(error.contains("DOCX_RENDERER_NOT_AVAILABLE") || error.contains("无法转换 Word 文档"));
}

#[test]
fn render_document_to_images_rejects_missing_pdf_runtime_with_clear_error() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.pdf");
    fs::write(&source, b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF").unwrap();

    let error = render_document_to_images(RenderDocumentToImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        page_numbers: vec![1],
        render_density: "standard".into(),
        naming_pattern: "source-name-page".into(),
    })
    .unwrap_err();

    assert!(error.contains("PDF_RENDERER_NOT_AVAILABLE") || error.contains("无法渲染 PDF 文档"));
}
