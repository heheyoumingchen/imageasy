use std::{fs, path::PathBuf};

use image::{GenericImageView, ImageBuffer, Rgba};
use tempfile::tempdir;

use imageasy_lib::commands::stitching::{
    inspect_stitching_directory,
    inspect_stitching_file,
    stitch_image_files,
    StitchImageFilesRequest,
};

#[test]
fn inspect_stitching_file_reads_image_metadata() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.webp");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 6, Rgba([120, 90, 80, 255]))
        .save(&source)
        .unwrap();

    let result = inspect_stitching_file(source.to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.kind, "image");
    assert_eq!(result.source_name, "demo.webp");
    assert_eq!(result.image_metadata.unwrap().height, 6);
}

#[test]
fn inspect_stitching_directory_collects_images_only() {
    let dir = tempdir().unwrap();
    let nested = dir.path().join("nested");
    fs::create_dir_all(&nested).unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(4, 4, Rgba([1, 2, 3, 255]))
        .save(dir.path().join("a.png"))
        .unwrap();
    fs::write(nested.join("b.pdf"), b"pdf").unwrap();
    fs::write(nested.join("c.txt"), b"unsupported").unwrap();

    let result = inspect_stitching_directory(dir.path().to_string_lossy().into_owned()).unwrap();

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].source_name, "a.png");
}

#[test]
fn stitch_image_files_outputs_grid_with_max_cell_size() {
    let dir = tempdir().unwrap();
    let a = dir.path().join("a.png");
    let b = dir.path().join("b.png");
    let c = dir.path().join("c.png");
    let out = dir.path().join("out");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(10, 6, Rgba([255, 0, 0, 255])).save(&a).unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(4, 12, Rgba([0, 255, 0, 255])).save(&b).unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 8, Rgba([0, 0, 255, 255])).save(&c).unwrap();

    let result = stitch_image_files(StitchImageFilesRequest {
        source_paths: vec![
            a.to_string_lossy().into_owned(),
            b.to_string_lossy().into_owned(),
            c.to_string_lossy().into_owned(),
        ],
        output_directory: out.to_string_lossy().into_owned(),
        output_format: "png".into(),
        columns: 2,
        background_color: "#FFFFFF".into(),
        naming_pattern: "source-name-index".into(),
    })
    .unwrap();

    assert_eq!(result.stitched_count, 3);
    assert!(result.output_path.ends_with("a-stitch-001.png"));
    let output = image::open(PathBuf::from(&result.output_path)).unwrap();
    assert_eq!(output.dimensions(), (20, 24));
}

#[test]
fn stitch_image_files_rejects_too_few_images_and_invalid_columns() {
    let dir = tempdir().unwrap();
    let a = dir.path().join("a.png");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(10, 6, Rgba([255, 0, 0, 255])).save(&a).unwrap();

    let too_few = stitch_image_files(StitchImageFilesRequest {
        source_paths: vec![a.to_string_lossy().into_owned()],
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "png".into(),
        columns: 2,
        background_color: "#FFFFFF".into(),
        naming_pattern: "source-name-index".into(),
    })
    .unwrap_err();
    assert!(too_few.contains("请至少选择 2 张图片进行拼接"));

    let invalid_columns = stitch_image_files(StitchImageFilesRequest {
        source_paths: vec![a.to_string_lossy().into_owned(), a.to_string_lossy().into_owned()],
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "png".into(),
        columns: 13,
        background_color: "#FFFFFF".into(),
        naming_pattern: "source-name-index".into(),
    })
    .unwrap_err();
    assert!(invalid_columns.contains("列数必须在 1 到 12 之间"));
}

#[test]
fn stitch_image_files_increments_output_name_when_file_exists() {
    let dir = tempdir().unwrap();
    let a = dir.path().join("photo.png");
    let b = dir.path().join("other.png");
    let out = dir.path().join("out");
    fs::create_dir_all(&out).unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(4, 4, Rgba([255, 0, 0, 255])).save(&a).unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(4, 4, Rgba([0, 255, 0, 255])).save(&b).unwrap();
    fs::write(out.join("photo-stitch-001.png"), b"existing").unwrap();

    let result = stitch_image_files(StitchImageFilesRequest {
        source_paths: vec![a.to_string_lossy().into_owned(), b.to_string_lossy().into_owned()],
        output_directory: out.to_string_lossy().into_owned(),
        output_format: "png".into(),
        columns: 2,
        background_color: "#FFFFFF".into(),
        naming_pattern: "source-name-index".into(),
    })
    .unwrap();

    assert!(result.output_path.ends_with("photo-stitch-002.png"));
}
