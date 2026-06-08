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
fn stitch_image_files_outputs_layout_canvas_with_object_cover_crop() {
    let dir = tempdir().unwrap();
    let a = dir.path().join("a.png");
    let b = dir.path().join("b.png");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(20, 10, Rgba([255, 0, 0, 255])).save(&a).unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(10, 20, Rgba([0, 0, 255, 255])).save(&b).unwrap();

    let result = stitch_image_files(StitchImageFilesRequest {
        cells: vec![
            imageasy_lib::commands::stitching::StitchLayoutCell { source_path: a.to_string_lossy().into_owned(), row: 0, col: 0, row_span: 1, col_span: 1 },
            imageasy_lib::commands::stitching::StitchLayoutCell { source_path: b.to_string_lossy().into_owned(), row: 0, col: 1, row_span: 1, col_span: 1 },
        ],
        rows: 1,
        cols: 2,
        canvas_ratio: "1:1".into(),
        resolution: 768,
        padding: 0,
        spacing: 0,
        border_radius: 0,
        background_color: "#FFFFFF".into(),
        quality: 90,
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "png".into(),
        naming_pattern: "source-name-index".into(),
    }).unwrap();

    assert_eq!(result.stitched_count, 2);
    assert!(result.output_path.ends_with("a-stitch-001.png"));
    let output = image::open(PathBuf::from(&result.output_path)).unwrap().to_rgba8();
    assert_eq!(output.dimensions(), (768, 768));
    assert_eq!(output.get_pixel(100, 384).0, [255, 0, 0, 255]);
    assert_eq!(output.get_pixel(668, 384).0, [0, 0, 255, 255]);
}

#[test]
fn stitch_image_files_rejects_too_few_images_and_invalid_columns() {
    let dir = tempdir().unwrap();
    let a = dir.path().join("a.png");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(10, 6, Rgba([255, 0, 0, 255])).save(&a).unwrap();

    let too_few = stitch_image_files(StitchImageFilesRequest {
        cells: vec![imageasy_lib::commands::stitching::StitchLayoutCell { source_path: a.to_string_lossy().into_owned(), row: 0, col: 0, row_span: 1, col_span: 1 }],
        rows: 1,
        cols: 1,
        canvas_ratio: "1:1".into(),
        resolution: 768,
        padding: 0,
        spacing: 0,
        border_radius: 0,
        background_color: "#FFFFFF".into(),
        quality: 90,
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "png".into(),
        naming_pattern: "source-name-index".into(),
    }).unwrap_err();
    assert!(too_few.contains("请至少选择 2 张图片进行拼接"));

    let invalid_layout = stitch_image_files(StitchImageFilesRequest {
        cells: vec![
            imageasy_lib::commands::stitching::StitchLayoutCell { source_path: a.to_string_lossy().into_owned(), row: 0, col: 0, row_span: 1, col_span: 1 },
            imageasy_lib::commands::stitching::StitchLayoutCell { source_path: a.to_string_lossy().into_owned(), row: 1, col: 0, row_span: 1, col_span: 1 },
        ],
        rows: 1,
        cols: 1,
        canvas_ratio: "1:1".into(),
        resolution: 768,
        padding: 0,
        spacing: 0,
        border_radius: 0,
        background_color: "#FFFFFF".into(),
        quality: 90,
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "png".into(),
        naming_pattern: "source-name-index".into(),
    }).unwrap_err();
    assert!(invalid_layout.contains("布局单元格超出画布范围"));
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
        cells: vec![
            imageasy_lib::commands::stitching::StitchLayoutCell { source_path: a.to_string_lossy().into_owned(), row: 0, col: 0, row_span: 1, col_span: 1 },
            imageasy_lib::commands::stitching::StitchLayoutCell { source_path: b.to_string_lossy().into_owned(), row: 0, col: 1, row_span: 1, col_span: 1 },
        ],
        rows: 1,
        cols: 2,
        canvas_ratio: "1:1".into(),
        resolution: 768,
        padding: 0,
        spacing: 0,
        border_radius: 0,
        background_color: "#FFFFFF".into(),
        quality: 90,
        output_directory: out.to_string_lossy().into_owned(),
        output_format: "png".into(),
        naming_pattern: "source-name-index".into(),
    })
    .unwrap();

    assert!(result.output_path.ends_with("photo-stitch-002.png"));
}

#[test]
fn stitch_image_files_uses_short_side_resolution_and_background_spacing() {
    let dir = tempdir().unwrap();
    let a = dir.path().join("a.png");
    let b = dir.path().join("b.png");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(40, 40, Rgba([255, 0, 0, 255])).save(&a).unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(40, 40, Rgba([0, 255, 0, 255])).save(&b).unwrap();

    let result = stitch_image_files(StitchImageFilesRequest {
        cells: vec![
            imageasy_lib::commands::stitching::StitchLayoutCell { source_path: a.to_string_lossy().into_owned(), row: 0, col: 0, row_span: 1, col_span: 1 },
            imageasy_lib::commands::stitching::StitchLayoutCell { source_path: b.to_string_lossy().into_owned(), row: 0, col: 1, row_span: 1, col_span: 1 },
        ],
        rows: 1,
        cols: 2,
        canvas_ratio: "16:9".into(),
        resolution: 1080,
        padding: 20,
        spacing: 10,
        border_radius: 0,
        background_color: "#112233".into(),
        quality: 90,
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "png".into(),
        naming_pattern: "source-name-index".into(),
    }).unwrap();

    let output = image::open(PathBuf::from(&result.output_path)).unwrap().to_rgba8();
    assert_eq!(output.dimensions(), (1920, 1080));
    assert_eq!(output.get_pixel(5, 5).0, [17, 34, 51, 255]);
    assert_eq!(output.get_pixel(960, 540).0, [17, 34, 51, 255]);
}

#[test]
fn stitch_image_files_preserves_background_around_rounded_cell_corners() {
    let dir = tempdir().unwrap();
    let a = dir.path().join("a.png");
    let b = dir.path().join("b.png");
    ImageBuffer::<Rgba<u8>, _>::from_pixel(80, 80, Rgba([255, 0, 0, 255])).save(&a).unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(80, 80, Rgba([0, 0, 255, 255])).save(&b).unwrap();

    let result = stitch_image_files(StitchImageFilesRequest {
        cells: vec![
            imageasy_lib::commands::stitching::StitchLayoutCell { source_path: a.to_string_lossy().into_owned(), row: 0, col: 0, row_span: 1, col_span: 1 },
            imageasy_lib::commands::stitching::StitchLayoutCell { source_path: b.to_string_lossy().into_owned(), row: 0, col: 1, row_span: 1, col_span: 1 },
        ],
        rows: 1,
        cols: 2,
        canvas_ratio: "1:1".into(),
        resolution: 768,
        padding: 20,
        spacing: 0,
        border_radius: 40,
        background_color: "#FFFFFF".into(),
        quality: 90,
        output_directory: dir.path().join("out").to_string_lossy().into_owned(),
        output_format: "png".into(),
        naming_pattern: "source-name-index".into(),
    }).unwrap();

    let output = image::open(PathBuf::from(&result.output_path)).unwrap().to_rgba8();
    assert_eq!(output.get_pixel(20, 20).0, [255, 255, 255, 255]);
    assert_eq!(output.get_pixel(80, 80).0, [255, 0, 0, 255]);
}
