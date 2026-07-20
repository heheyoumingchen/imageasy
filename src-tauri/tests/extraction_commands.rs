use image::{codecs::jpeg::JpegEncoder, ColorType};
use lopdf::Document as LoDocument;
use std::io::Write;
use std::{fs, path::PathBuf};
use tempfile::tempdir;

use imageasy_lib::commands::extraction::{
    extract_document_images, inspect_extraction_directory, inspect_extraction_document,
    ExtractDocumentImagesRequest,
};

fn run_extract_document_images(
    request: ExtractDocumentImagesRequest,
) -> Result<imageasy_lib::commands::extraction::ExtractDocumentImagesResult, String> {
    tauri::async_runtime::block_on(extract_document_images(request))
}

fn run_inspect_extraction_document(
    path: String,
) -> Result<imageasy_lib::commands::extraction::ExtractionDocumentInfo, String> {
    tauri::async_runtime::block_on(inspect_extraction_document(path))
}

fn run_inspect_extraction_directory(
    path: String,
) -> Result<Vec<imageasy_lib::commands::extraction::ExtractionDocumentInfo>, String> {
    tauri::async_runtime::block_on(inspect_extraction_directory(path))
}

fn write_zip_from_dir(source_dir: &std::path::Path, destination: &std::path::Path) {
    let file = fs::File::create(destination).unwrap();
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();

    for entry in walkdir::WalkDir::new(source_dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
    {
        let relative = entry
            .path()
            .strip_prefix(source_dir)
            .unwrap()
            .to_string_lossy()
            .replace('\\', "/");
        zip.start_file(relative, options).unwrap();
        let bytes = fs::read(entry.path()).unwrap();
        zip.write_all(&bytes).unwrap();
    }

    zip.finish().unwrap();
}

fn minimal_jpeg_bytes() -> Vec<u8> {
    let image = image::ImageBuffer::<image::Rgb<u8>, _>::from_pixel(1, 1, image::Rgb([255, 0, 0]));
    let mut bytes = Vec::new();
    let mut writer = std::io::BufWriter::new(&mut bytes);
    JpegEncoder::new_with_quality(&mut writer, 90)
        .encode(image.as_raw(), 1, 1, ColorType::Rgb8.into())
        .unwrap();
    drop(writer);
    bytes
}

fn write_minimal_pdf_with_embedded_image(path: &std::path::Path) {
    let jpeg_bytes = minimal_jpeg_bytes();
    let image_length = jpeg_bytes.len();
    let image_object = format!(
        "4 0 obj\n<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {} >>\nstream\n",
        image_length
    );

    let objects = vec![
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n".to_vec(),
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n".to_vec(),
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n".to_vec(),
        {
            let mut bytes = image_object.into_bytes();
            bytes.extend_from_slice(&jpeg_bytes);
            bytes.extend_from_slice(b"\nendstream\nendobj\n");
            bytes
        },
        b"5 0 obj\n<< /Length 35 >>\nstream\nq\n100 0 0 100 0 0 cm\n/Im0 Do\nQ\nendstream\nendobj\n".to_vec(),
    ];

    let mut content = b"%PDF-1.4\n".to_vec();
    let mut offsets = vec![0usize];
    for object in &objects {
        offsets.push(content.len());
        content.extend_from_slice(object);
    }

    let xref_start = content.len();
    content.extend_from_slice(format!("xref\n0 {}\n", offsets.len()).as_bytes());
    content.extend_from_slice(b"0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        content.extend_from_slice(format!("{:010} 00000 n \n", offset).as_bytes());
    }
    content.extend_from_slice(b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n");
    content.extend_from_slice(xref_start.to_string().as_bytes());
    content.extend_from_slice(b"\n%%EOF\n");
    fs::write(path, content).unwrap();
}

fn write_minimal_empty_pdf(path: &std::path::Path) {
    let objects = vec![
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n".to_vec(),
        b"2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n".to_vec(),
    ];

    let mut content = b"%PDF-1.4\n".to_vec();
    let mut offsets = vec![0usize];
    for object in &objects {
        offsets.push(content.len());
        content.extend_from_slice(object);
    }

    let xref_start = content.len();
    content.extend_from_slice(format!("xref\n0 {}\n", offsets.len()).as_bytes());
    content.extend_from_slice(b"0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        content.extend_from_slice(format!("{:010} 00000 n \n", offset).as_bytes());
    }
    content.extend_from_slice(b"trailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n");
    content.extend_from_slice(xref_start.to_string().as_bytes());
    content.extend_from_slice(b"\n%%EOF\n");
    fs::write(path, content).unwrap();
}

fn write_minimal_docx_with_embedded_image(path: &std::path::Path) {
    let temp_dir = tempdir().unwrap();
    let root = temp_dir.path();
    fs::create_dir_all(root.join("word/media")).unwrap();
    image::ImageBuffer::<image::Rgba<u8>, _>::from_pixel(1, 1, image::Rgba([255, 0, 0, 255]))
        .save(root.join("word/media/image1.png"))
        .unwrap();
    write_zip_from_dir(root, path);
}

fn write_minimal_pptx_with_embedded_image(path: &std::path::Path) {
    let temp_dir = tempdir().unwrap();
    let root = temp_dir.path();
    fs::create_dir_all(root.join("ppt/media")).unwrap();
    image::ImageBuffer::<image::Rgba<u8>, _>::from_pixel(1, 1, image::Rgba([255, 0, 0, 255]))
        .save(root.join("ppt/media/image1.png"))
        .unwrap();
    write_zip_from_dir(root, path);
}

fn write_pptx_with_png_and_unsupported_wdp(path: &std::path::Path) {
    let temp_dir = tempdir().unwrap();
    let root = temp_dir.path();
    fs::create_dir_all(root.join("ppt/media")).unwrap();
    image::ImageBuffer::<image::Rgba<u8>, _>::from_pixel(1, 1, image::Rgba([255, 0, 0, 255]))
        .save(root.join("ppt/media/image1.png"))
        .unwrap();
    fs::write(root.join("ppt/media/image2.wdp"), b"unsupported-wdp").unwrap();
    write_zip_from_dir(root, path);
}

#[test]
fn inspect_extraction_document_reads_pdf_page_and_image_counts() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.pdf");
    write_minimal_pdf_with_embedded_image(&source);

    let document = LoDocument::load(&source).unwrap();
    let pages = document.get_pages();
    assert_eq!(pages.len(), 1);

    let result = run_inspect_extraction_document(source.to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.source_name, "demo.pdf");
    assert_eq!(result.extension, "pdf");
    assert_eq!(result.page_count, 1);
    assert_eq!(result.embedded_image_count, 1);
}

#[test]
fn inspect_extraction_directory_recursively_collects_supported_documents() {
    let dir = tempdir().unwrap();
    let nested = dir.path().join("nested");
    fs::create_dir_all(&nested).unwrap();
    write_minimal_pdf_with_embedded_image(&dir.path().join("demo.pdf"));
    fs::write(nested.join("manual.docx"), b"fake-docx").unwrap();
    fs::write(nested.join("notes.txt"), b"unsupported").unwrap();

    let result =
        run_inspect_extraction_directory(dir.path().to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.len(), 2);
    assert_eq!(result[0].source_name, "demo.pdf");
    assert_eq!(result[1].source_name, "manual.docx");
}

#[test]
fn extract_document_images_writes_output_files_from_image_sources() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("photo.png");
    let output_directory = dir.path().join("out");

    image::ImageBuffer::<image::Rgba<u8>, _>::from_pixel(6, 4, image::Rgba([10, 80, 140, 255]))
        .save(&source)
        .unwrap();

    let result = run_extract_document_images(ExtractDocumentImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: output_directory.to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: 90,
        naming_pattern: "source-name-index".into(),
        include_output_paths: Some(true),
    task_id: None,
    })
    .unwrap();

    assert_eq!(result.extracted_count, 1);
    assert_eq!(result.skipped_count, 0);
    assert_eq!(result.output_paths.len(), 1);

    let output_path = PathBuf::from(&result.output_paths[0]);
    assert_eq!(
        output_path.file_name().unwrap().to_string_lossy(),
        "photo-001.jpg"
    );
    assert!(output_path.exists());
}

#[test]
fn extract_document_images_extracts_embedded_images_from_pdf() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.pdf");
    write_minimal_pdf_with_embedded_image(&source);

    let result = run_extract_document_images(ExtractDocumentImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: 90,
        naming_pattern: "source-name-index".into(),
        include_output_paths: Some(true),
    task_id: None,
    })
    .unwrap();

    assert_eq!(result.extracted_count, 1);
    assert_eq!(result.skipped_count, 0);
    assert_eq!(result.output_paths.len(), 1);

    let output_path = PathBuf::from(&result.output_paths[0]);
    assert_eq!(
        output_path.file_name().unwrap().to_string_lossy(),
        "demo-001.jpg"
    );
    assert!(output_path.exists());

    let image = image::open(&output_path).unwrap();
    assert_eq!(image.width(), 1);
    assert_eq!(image.height(), 1);
}

#[test]
fn inspect_and_extract_return_zero_for_pdf_without_embedded_images() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("empty.pdf");
    write_minimal_empty_pdf(&source);

    let inspect_result =
        run_inspect_extraction_document(source.to_string_lossy().into_owned()).unwrap();
    assert_eq!(inspect_result.page_count, 0);
    assert_eq!(inspect_result.embedded_image_count, 0);

    let extract_result = run_extract_document_images(ExtractDocumentImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: 90,
        naming_pattern: "source-name-index".into(),
        include_output_paths: Some(true),
    task_id: None,
    })
    .unwrap();

    assert_eq!(extract_result.extracted_count, 0);
    assert!(extract_result.output_paths.is_empty());
}

#[test]
fn extract_document_images_extracts_docx_without_soffice() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.docx");
    write_minimal_docx_with_embedded_image(&source);

    let result = run_extract_document_images(ExtractDocumentImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: 90,
        naming_pattern: "source-name-index".into(),
        include_output_paths: Some(true),
    task_id: None,
    })
    .unwrap();

    assert_eq!(result.extracted_count, 1);
    let output_path = PathBuf::from(&result.output_paths[0]);
    assert_eq!(
        output_path.file_name().unwrap().to_string_lossy(),
        "demo-001.jpg"
    );
    assert!(output_path.exists());
}

#[test]
fn extract_document_images_extracts_pptx_original_images_without_recoloring() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("slides.pptx");
    write_minimal_pptx_with_embedded_image(&source);

    let inspected = run_inspect_extraction_document(source.to_string_lossy().into_owned()).unwrap();
    assert_eq!(inspected.extension, "pptx");
    assert_eq!(inspected.embedded_image_count, 1);

    let result = run_extract_document_images(ExtractDocumentImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "png".into(),
        color_mode: "rgb".into(),
        quality: 90,
        naming_pattern: "source-name-index".into(),
        include_output_paths: Some(true),
    task_id: None,
    })
    .unwrap();

    assert_eq!(result.extracted_count, 1);
    let output_path = PathBuf::from(&result.output_paths[0]);
    assert_eq!(
        output_path.file_name().unwrap().to_string_lossy(),
        "slides-001.png"
    );
    let image = image::open(output_path).unwrap().to_rgba8();
    assert_eq!(image.get_pixel(0, 0).0, [255, 0, 0, 255]);
}

#[test]
fn extract_document_images_skips_unsupported_pptx_media_files() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("slides-with-wdp.pptx");
    write_pptx_with_png_and_unsupported_wdp(&source);

    let inspected = run_inspect_extraction_document(source.to_string_lossy().into_owned()).unwrap();
    // 预计数只统计可解码栅格，不包含 wdp 等专有格式。
    assert_eq!(inspected.embedded_image_count, 1);

    let result = run_extract_document_images(ExtractDocumentImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "png".into(),
        color_mode: "rgb".into(),
        quality: 90,
        naming_pattern: "source-name-index".into(),
        include_output_paths: Some(true),
    task_id: None,
    })
    .unwrap();

    assert_eq!(result.extracted_count, 1);
    assert_eq!(result.skipped_count, 1);
    assert_eq!(result.output_paths.len(), 1);
    assert!(PathBuf::from(&result.output_paths[0]).exists());
}

#[test]
fn extract_document_images_counts_existing_pptx_outputs_as_completed() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("slides.pptx");
    write_minimal_pptx_with_embedded_image(&source);
    let out_dir = dir.path().join("out");
    fs::create_dir_all(&out_dir).unwrap();

    let first = run_extract_document_images(ExtractDocumentImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: out_dir.to_string_lossy().into_owned(),
        output_format: "png".into(),
        color_mode: "rgb".into(),
        quality: 90,
        naming_pattern: "source-name-index".into(),
        include_output_paths: Some(true),
    task_id: None,
    })
    .unwrap();
    assert_eq!(first.extracted_count, 1);
    assert!(PathBuf::from(&first.output_paths[0]).exists());

    // 再次提取时目标已存在，仍应计入完成数，避免“目录有文件但界面完成数偏少”。
    let second = run_extract_document_images(ExtractDocumentImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: out_dir.to_string_lossy().into_owned(),
        output_format: "png".into(),
        color_mode: "rgb".into(),
        quality: 90,
        naming_pattern: "source-name-index".into(),
        include_output_paths: Some(true),
    task_id: None,
    })
    .unwrap();
    assert_eq!(second.extracted_count, 1);
    assert_eq!(second.skipped_count, 0);
    assert_eq!(second.output_paths.len(), 1);
}

#[test]
fn extract_document_images_returns_zero_for_docx_without_images() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("empty.docx");
    let temp_dir = tempdir().unwrap();
    let root = temp_dir.path();
    fs::create_dir_all(root.join("_rels")).unwrap();
    fs::create_dir_all(root.join("word/_rels")).unwrap();
    fs::create_dir_all(root.join("word")).unwrap();
    fs::write(root.join("[Content_Types].xml"), b"<Types></Types>").unwrap();
    fs::write(root.join("_rels/.rels"), b"<Relationships></Relationships>").unwrap();
    fs::write(root.join("word/document.xml"), b"<w:document></w:document>").unwrap();
    fs::write(
        root.join("word/_rels/document.xml.rels"),
        b"<Relationships></Relationships>",
    )
    .unwrap();
    write_zip_from_dir(root, &source);

    let result = run_extract_document_images(ExtractDocumentImagesRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: 90,
        naming_pattern: "source-name-index".into(),
        include_output_paths: Some(true),
    task_id: None,
    })
    .unwrap();

    assert_eq!(result.extracted_count, 0);
    assert!(result.output_paths.is_empty());
}
