use std::{fs, path::PathBuf};

use image::{GenericImageView, ImageBuffer, Rgba};
use tempfile::tempdir;

use imageasy_lib::commands::splitting::{
    inspect_splitting_directory, inspect_splitting_file, split_image_file_with_resource_dir,
    InspectSplittingFileResult, SplitImageFileRequest,
};

fn run_inspect_splitting_file(path: String) -> Result<InspectSplittingFileResult, String> {
    tauri::async_runtime::block_on(inspect_splitting_file(path))
}

fn run_inspect_splitting_directory(
    path: String,
) -> Result<Vec<InspectSplittingFileResult>, String> {
    tauri::async_runtime::block_on(inspect_splitting_directory(path))
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

#[test]
fn inspect_splitting_file_reads_image_metadata() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.png");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 6, Rgba([120, 90, 80, 255]))
        .save(&source)
        .unwrap();

    let result = run_inspect_splitting_file(source.to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.kind, "image");
    assert_eq!(result.source_name, "demo.png");
    assert_eq!(result.image_metadata.unwrap().width, 8);
}

#[test]
fn inspect_splitting_directory_recursively_collects_images_and_pdf() {
    let dir = tempdir().unwrap();
    let nested = dir.path().join("nested");
    fs::create_dir_all(&nested).unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(4, 4, Rgba([1, 2, 3, 255]))
        .save(dir.path().join("a.png"))
        .unwrap();
    write_minimal_empty_pdf(&nested.join("b.pdf"));
    fs::write(nested.join("c.txt"), b"unsupported").unwrap();

    let result =
        run_inspect_splitting_directory(dir.path().to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.len(), 2);
    assert_eq!(result[0].kind, "image");
    assert_eq!(result[1].kind, "pdf");
}

#[test]
fn split_image_file_splits_grid_with_remainder_on_last_row_and_column() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("wide.png");
    let out = dir.path().join("out");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(10, 7, Rgba([100, 120, 140, 255]))
        .save(&source)
        .unwrap();

    let result = split_image_file_with_resource_dir(
        SplitImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_directory: out.to_string_lossy().into_owned(),
            output_format: "png".into(),
            color_mode: "rgb".into(),
            columns: 3,
            rows: 2,
            quality: 88,
            naming_pattern: "source-name-index".into(),
            include_output_paths: Some(true),
        task_id: None,
        },
        None,
    )
    .unwrap();

    assert_eq!(result.split_count, 6);
    assert_eq!(result.skipped_count, 0);
    assert_eq!(result.output_paths.len(), 6);
    assert!(result.output_paths[0].ends_with("wide-001.png"));
    assert!(result.output_paths[5].ends_with("wide-006.png"));

    let first = image::open(PathBuf::from(&result.output_paths[0])).unwrap();
    let third = image::open(PathBuf::from(&result.output_paths[2])).unwrap();
    let sixth = image::open(PathBuf::from(&result.output_paths[5])).unwrap();
    assert_eq!(first.dimensions(), (3, 3));
    assert_eq!(third.dimensions(), (4, 3));
    assert_eq!(sixth.dimensions(), (4, 4));
}

#[test]
fn split_image_file_splits_vertical_rows_only() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("tall.png");
    let out = dir.path().join("out");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 9, Rgba([90, 40, 200, 255]))
        .save(&source)
        .unwrap();

    let result = split_image_file_with_resource_dir(
        SplitImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_directory: out.to_string_lossy().into_owned(),
            output_format: "jpg".into(),
            color_mode: "rgb".into(),
            columns: 1,
            rows: 3,
            quality: 75,
            naming_pattern: "source-name-index".into(),
            include_output_paths: Some(true),
        task_id: None,
        },
        None,
    )
    .unwrap();

    assert_eq!(result.split_count, 3);
    let first = image::open(PathBuf::from(&result.output_paths[0])).unwrap();
    let third = image::open(PathBuf::from(&result.output_paths[2])).unwrap();
    assert_eq!(first.dimensions(), (8, 3));
    assert_eq!(third.dimensions(), (8, 3));
    assert!(result.output_paths[0].ends_with("tall-001.jpg"));
    assert!(result.output_paths[2].ends_with("tall-003.jpg"));
}

#[test]
fn split_image_file_rejects_invalid_grid_and_tiny_image() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("tiny.png");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(1, 4, Rgba([255, 0, 0, 255]))
        .save(&source)
        .unwrap();

    let no_split = split_image_file_with_resource_dir(
        SplitImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_directory: dir.path().join("out").to_string_lossy().into_owned(),
            output_format: "png".into(),
            color_mode: "rgb".into(),
            columns: 1,
            rows: 1,
            quality: 90,
            naming_pattern: "source-name-index".into(),
            include_output_paths: Some(true),
        task_id: None,
        },
        None,
    )
    .unwrap_err();
    assert!(no_split.to_string().contains("至少需要分割为 2 个部分"));

    let bad_columns = split_image_file_with_resource_dir(
        SplitImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_directory: dir.path().join("out").to_string_lossy().into_owned(),
            output_format: "png".into(),
            color_mode: "rgb".into(),
            columns: 11,
            rows: 1,
            quality: 90,
            naming_pattern: "source-name-index".into(),
            include_output_paths: Some(true),
        task_id: None,
        },
        None,
    )
    .unwrap_err();
    assert!(bad_columns.to_string().contains("列数必须在 1 到 10 之间"));

    let tiny = split_image_file_with_resource_dir(
        SplitImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_directory: dir.path().join("out").to_string_lossy().into_owned(),
            output_format: "png".into(),
            color_mode: "rgb".into(),
            columns: 2,
            rows: 1,
            quality: 90,
            naming_pattern: "source-name-index".into(),
            include_output_paths: Some(true),
        task_id: None,
        },
        None,
    )
    .unwrap_err();
    assert!(tiny.to_string().contains("图片尺寸过小"));
}

#[test]
fn split_image_file_skips_existing_outputs_with_continuous_names() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("wide.png");
    let out = dir.path().join("out");
    fs::create_dir_all(&out).unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(10, 4, Rgba([100, 120, 140, 255]))
        .save(&source)
        .unwrap();
    fs::write(out.join("wide-001.png"), b"existing").unwrap();

    let result = split_image_file_with_resource_dir(
        SplitImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_directory: out.to_string_lossy().into_owned(),
            output_format: "png".into(),
            color_mode: "rgb".into(),
            columns: 2,
            rows: 1,
            quality: 90,
            naming_pattern: "source-name-index".into(),
            include_output_paths: Some(true),
        task_id: None,
        },
        None,
    )
    .unwrap();

    assert_eq!(result.split_count, 1);
    assert_eq!(result.skipped_count, 1);
    assert_eq!(result.output_paths.len(), 1);
    assert!(result.output_paths[0].ends_with("wide-002.png"));
}
