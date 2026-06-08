use std::{fs, path::PathBuf};

use image::{GenericImageView, ImageBuffer, Rgba};
use tempfile::tempdir;

use imageasy_lib::commands::splitting::{
    inspect_splitting_directory,
    inspect_splitting_file,
    split_image_file_with_resource_dir,
    SplitImageFileRequest,
};

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

    let result = inspect_splitting_file(source.to_string_lossy().into_owned()).unwrap();

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

    let result = inspect_splitting_directory(dir.path().to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.len(), 2);
    assert_eq!(result[0].kind, "image");
    assert_eq!(result[1].kind, "pdf");
}

#[test]
fn split_image_file_splits_left_and_right_by_ratio() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("wide.png");
    let out = dir.path().join("out");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(10, 4, Rgba([100, 120, 140, 255]))
        .save(&source)
        .unwrap();

    let result = split_image_file_with_resource_dir(
        SplitImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_directory: out.to_string_lossy().into_owned(),
            output_format: "png".into(),
            split_direction: "vertical".into(),
            ratio: 30,
            naming_pattern: "source-name-index".into(),
        },
        None,
    )
    .unwrap();

    assert_eq!(result.split_count, 2);
    assert_eq!(result.skipped_count, 0);
    assert_eq!(result.output_paths.len(), 2);
    let left = image::open(PathBuf::from(&result.output_paths[0])).unwrap();
    let right = image::open(PathBuf::from(&result.output_paths[1])).unwrap();
    assert_eq!(left.dimensions(), (3, 4));
    assert_eq!(right.dimensions(), (7, 4));
    assert!(result.output_paths[0].ends_with("wide-001-left.png"));
    assert!(result.output_paths[1].ends_with("wide-001-right.png"));
}

#[test]
fn split_image_file_splits_top_and_bottom_by_ratio() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("tall.png");
    let out = dir.path().join("out");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(10, 6, Rgba([90, 40, 200, 255]))
        .save(&source)
        .unwrap();

    let result = split_image_file_with_resource_dir(
        SplitImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_directory: out.to_string_lossy().into_owned(),
            output_format: "jpg".into(),
            split_direction: "horizontal".into(),
            ratio: 50,
            naming_pattern: "source-name-index".into(),
        },
        None,
    )
    .unwrap();

    let top = image::open(PathBuf::from(&result.output_paths[0])).unwrap();
    let bottom = image::open(PathBuf::from(&result.output_paths[1])).unwrap();
    assert_eq!(top.dimensions(), (10, 3));
    assert_eq!(bottom.dimensions(), (10, 3));
    assert!(result.output_paths[0].ends_with("tall-001-top.jpg"));
    assert!(result.output_paths[1].ends_with("tall-001-bottom.jpg"));
}

#[test]
fn split_image_file_rejects_invalid_ratio_and_tiny_image() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("tiny.png");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(1, 4, Rgba([255, 0, 0, 255]))
        .save(&source)
        .unwrap();

    let bad_ratio = split_image_file_with_resource_dir(
        SplitImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_directory: dir.path().join("out").to_string_lossy().into_owned(),
            output_format: "png".into(),
            split_direction: "vertical".into(),
            ratio: 100,
            naming_pattern: "source-name-index".into(),
        },
        None,
    )
    .unwrap_err();
    assert!(bad_ratio.to_string().contains("比例必须在 1 到 99 之间"));

    let tiny = split_image_file_with_resource_dir(
        SplitImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_directory: dir.path().join("out").to_string_lossy().into_owned(),
            output_format: "png".into(),
            split_direction: "vertical".into(),
            ratio: 50,
            naming_pattern: "source-name-index".into(),
        },
        None,
    )
    .unwrap_err();
    assert!(tiny.to_string().contains("图片尺寸过小"));
}

#[test]
fn split_image_file_skips_existing_outputs() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("wide.png");
    let out = dir.path().join("out");
    fs::create_dir_all(&out).unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(10, 4, Rgba([100, 120, 140, 255]))
        .save(&source)
        .unwrap();
    fs::write(out.join("wide-001-left.png"), b"existing").unwrap();

    let result = split_image_file_with_resource_dir(
        SplitImageFileRequest {
            source_path: source.to_string_lossy().into_owned(),
            output_directory: out.to_string_lossy().into_owned(),
            output_format: "png".into(),
            split_direction: "vertical".into(),
            ratio: 50,
            naming_pattern: "source-name-index".into(),
        },
        None,
    )
    .unwrap();

    assert_eq!(result.split_count, 1);
    assert_eq!(result.skipped_count, 1);
    assert_eq!(result.output_paths.len(), 1);
    assert!(result.output_paths[0].ends_with("wide-001-right.png"));
}
