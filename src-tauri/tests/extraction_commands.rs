use std::{fs, path::PathBuf};

use tempfile::tempdir;

use image_batch_helper_lib::commands::extraction::{
    extract_document_images, inspect_extraction_document, ExtractDocumentImagesRequest,
};

#[test]
fn inspect_extraction_document_reads_supported_document_info() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.pdf");
    fs::write(&source, b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF").unwrap();

    let result = inspect_extraction_document(source.to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.source_name, "demo.pdf");
    assert_eq!(result.extension, "pdf");
    assert_eq!(result.page_count, 1);
    assert_eq!(result.embedded_image_count, 0);
}

#[test]
fn extract_document_images_writes_output_files_from_image_sources() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("photo.png");
    let output_directory = dir.path().join("out");

    image::ImageBuffer::<image::Rgba<u8>, _>::from_pixel(6, 4, image::Rgba([10, 80, 140, 255]))
        .save(&source)
        .unwrap();

    let result = extract_document_images(ExtractDocumentImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: output_directory.to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        naming_pattern: "source-name-index".into(),
    })
    .unwrap();

    assert_eq!(result.extracted_count, 1);
    assert_eq!(result.skipped_count, 0);
    assert_eq!(result.output_paths.len(), 1);

    let output_path = PathBuf::from(&result.output_paths[0]);
    assert_eq!(output_path.file_name().unwrap().to_string_lossy(), "photo_001.jpg");
    assert!(output_path.exists());
}
