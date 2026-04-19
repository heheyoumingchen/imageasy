use std::path::PathBuf;

use image::{ImageBuffer, Rgba};
use tempfile::tempdir;

use image_batch_helper_lib::commands::editor::{
    open_image_session, generate_image_preview, save_image_as_jpg, AdjustmentParams,
    GenerateImagePreviewRequest, SaveImageAsJpgRequest,
};

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

    let preview = generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: AdjustmentParams {
            brightness: 10,
            contrast: 5,
            saturation: 0,
        },
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
        adjustments: AdjustmentParams {
            brightness: 0,
            contrast: 0,
            saturation: 0,
        },
        quality: Some(92),
    })
    .unwrap();

    let output_path = PathBuf::from(result.saved_path);
    assert_eq!(output_path.file_name().unwrap().to_string_lossy(), "demo_output.jpg");
    assert!(output_path.exists());
    assert!(result.size_bytes > 0);
}
