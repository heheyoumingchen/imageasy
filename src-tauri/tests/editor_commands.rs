use std::path::PathBuf;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{GenericImageView, ImageBuffer, Rgba};
use tempfile::tempdir;

use image_batch_helper_lib::commands::editor::{
    open_image_session, generate_image_preview, save_image_as_jpg, AdjustmentParams,
    CropRect, GenerateImagePreviewRequest, SaveImageAsJpgRequest,
};

fn default_adjustments() -> AdjustmentParams {
    AdjustmentParams {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        sharpen: 0,
        clarity: 0,
        quality: 90,
        filter_type: "none".into(),
        filter_intensity: 0,
        rotation: 0,
        crop: None,
    }
}

#[test]
fn open_image_session_sorts_supported_images_and_tracks_current_index() {
    let dir = tempdir().unwrap();
    let second = dir.path().join("2.png");
    let first = dir.path().join("1.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(4, 4, Rgba([255, 0, 0, 255]))
        .save(&second)
        .unwrap();
    ImageBuffer::<Rgba<u8>, _>::from_pixel(4, 4, Rgba([0, 255, 0, 255]))
        .save(&first)
        .unwrap();

    let session = open_image_session(first.to_string_lossy().into_owned()).unwrap();

    assert_eq!(session.current_index, 0);
    assert_eq!(session.directory_images[0].summary.name, "1.png");
    assert_eq!(session.directory_images[1].summary.name, "2.png");
}

#[test]
fn generate_image_preview_returns_jpeg_data_url() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 8, Rgba([120, 100, 80, 255]))
        .save(&source)
        .unwrap();

    let mut adjustments = default_adjustments();
    adjustments.brightness = 10;
    adjustments.contrast = 5;

    let preview = generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments,
        max_width: Some(480),
        max_height: Some(320),
    })
    .unwrap();

    assert!(preview.data_url.starts_with("data:image/jpeg;base64,"));
    assert!(preview.width > 0);
    assert!(preview.height > 0);
}

#[test]
fn save_image_as_jpg_writes_target_file() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.png");
    let target = dir.path().join("demo_output.jpg");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 8, Rgba([200, 120, 40, 255]))
        .save(&source)
        .unwrap();

    let result = save_image_as_jpg(SaveImageAsJpgRequest {
        source_path: source.to_string_lossy().into_owned(),
        target_path: target.to_string_lossy().into_owned(),
        adjustments: default_adjustments(),
        quality: Some(92),
    })
    .unwrap();

    let output_path = PathBuf::from(result.saved_path);
    assert_eq!(output_path.file_name().unwrap().to_string_lossy(), "demo_output.jpg");
    assert!(output_path.exists());
    assert!(result.size_bytes > 0);
}

#[test]
fn warm_filter_changes_preview_pixels() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("warm-preview.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(6, 6, Rgba([90, 120, 180, 255]))
        .save(&source)
        .unwrap();

    let neutral = generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: default_adjustments(),
        max_width: Some(320),
        max_height: Some(240),
    })
    .unwrap();

    let mut warm_adjustments = default_adjustments();
    warm_adjustments.filter_type = "warm".into();
    warm_adjustments.filter_intensity = 100;

    let warm = generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: warm_adjustments,
        max_width: Some(320),
        max_height: Some(240),
    })
    .unwrap();

    let neutral_image = image::load_from_memory(&STANDARD.decode(neutral.data_url.split(',').nth(1).unwrap()).unwrap()).unwrap();
    let warm_image = image::load_from_memory(&STANDARD.decode(warm.data_url.split(',').nth(1).unwrap()).unwrap()).unwrap();

    let neutral_pixel = neutral_image.get_pixel(0, 0).0;
    let warm_pixel = warm_image.get_pixel(0, 0).0;

    assert!(warm_pixel[0] > neutral_pixel[0]);
    assert!(warm_pixel[2] < neutral_pixel[2]);
}

#[test]
fn grayscale_filter_changes_saved_output_pixels() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("grayscale-source.png");
    let target = dir.path().join("grayscale-output.jpg");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 8, Rgba([40, 140, 220, 255]))
        .save(&source)
        .unwrap();

    let mut adjustments = default_adjustments();
    adjustments.filter_type = "grayscale".into();
    adjustments.filter_intensity = 100;

    save_image_as_jpg(SaveImageAsJpgRequest {
        source_path: source.to_string_lossy().into_owned(),
        target_path: target.to_string_lossy().into_owned(),
        adjustments,
        quality: Some(92),
    })
    .unwrap();

    let output = image::open(&target).unwrap();
    let pixel = output.get_pixel(0, 0).0;

    assert_eq!(pixel[0], pixel[1]);
    assert_eq!(pixel[1], pixel[2]);
}

#[test]
fn rotate_90_changes_output_dimensions() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("rotate-source.png");
    let target = dir.path().join("rotate-output.jpg");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(9, 5, Rgba([180, 80, 60, 255]))
        .save(&source)
        .unwrap();

    let mut adjustments = default_adjustments();
    adjustments.rotation = 90;

    save_image_as_jpg(SaveImageAsJpgRequest {
        source_path: source.to_string_lossy().into_owned(),
        target_path: target.to_string_lossy().into_owned(),
        adjustments,
        quality: Some(90),
    })
    .unwrap();

    let output = image::open(&target).unwrap();
    assert_eq!(output.dimensions(), (5, 9));
}

#[test]
fn crop_changes_output_dimensions() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("crop-source.png");
    let target = dir.path().join("crop-output.jpg");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(10, 8, Rgba([60, 160, 220, 255]))
        .save(&source)
        .unwrap();

    let mut adjustments = default_adjustments();
    adjustments.crop = Some(CropRect {
        x: 2,
        y: 1,
        width: 4,
        height: 3,
    });

    save_image_as_jpg(SaveImageAsJpgRequest {
        source_path: source.to_string_lossy().into_owned(),
        target_path: target.to_string_lossy().into_owned(),
        adjustments,
        quality: Some(90),
    })
    .unwrap();

    let output = image::open(&target).unwrap();
    assert_eq!(output.dimensions(), (4, 3));
}

#[test]
fn preview_and_save_share_rotation_and_crop_semantics() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("consistency-source.png");
    let target = dir.path().join("consistency-output.jpg");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(12, 8, Rgba([120, 90, 200, 255]))
        .save(&source)
        .unwrap();

    let mut adjustments = default_adjustments();
    adjustments.rotation = 90;
    adjustments.crop = Some(CropRect {
        x: 1,
        y: 2,
        width: 5,
        height: 4,
    });

    let preview = generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: adjustments.clone(),
        max_width: Some(320),
        max_height: Some(240),
    })
    .unwrap();

    save_image_as_jpg(SaveImageAsJpgRequest {
        source_path: source.to_string_lossy().into_owned(),
        target_path: target.to_string_lossy().into_owned(),
        adjustments,
        quality: Some(90),
    })
    .unwrap();

    let output = image::open(&target).unwrap();
    assert_eq!((preview.width, preview.height), output.dimensions());
}
