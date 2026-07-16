use std::path::PathBuf;

use base64::Engine as _;
use image::{GenericImageView, ImageBuffer, Rgba};
use tempfile::tempdir;

use imageasy_lib::commands::editor::{
    commit_crop_to_working_image, generate_editor_thumbnail, generate_image_preview,
    open_image_session, prefetch_image_preview, save_image_as_jpg, AdjustmentParams,
    CommitCropRequest, CropRect, GenerateImagePreviewRequest, PrefetchImagePreviewRequest,
    SaveImageAsJpgRequest,
};

fn run_open_image_session(
    path: String,
) -> Result<imageasy_lib::commands::editor::OpenImageSessionResult, String> {
    tauri::async_runtime::block_on(open_image_session(path))
}

fn run_generate_editor_thumbnail(path: String) -> Result<String, String> {
    tauri::async_runtime::block_on(generate_editor_thumbnail(path))
}

fn run_generate_image_preview(
    request: GenerateImagePreviewRequest,
) -> Result<imageasy_lib::commands::editor::GenerateImagePreviewResult, String> {
    tauri::async_runtime::block_on(generate_image_preview(request))
}

fn run_prefetch_image_preview(request: PrefetchImagePreviewRequest) -> Result<(), String> {
    tauri::async_runtime::block_on(prefetch_image_preview(request))
}

fn default_adjustments() -> AdjustmentParams {
    AdjustmentParams {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        temperature: 0,
        tint: 0,
        sharpen: 0,
        clarity: 0,
        quality: 100,
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

    let session = run_open_image_session(first.to_string_lossy().into_owned()).unwrap();

    assert_eq!(session.current_index, 0);
    assert_eq!(session.directory_images[0].summary.name, "1.png");
    assert_eq!(session.directory_images[1].summary.name, "2.png");
}

#[test]
fn generate_editor_thumbnail_returns_jpeg_data_url() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("thumb-source.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(16, 10, Rgba([40, 90, 140, 255]))
        .save(&source)
        .unwrap();

    let thumbnail = run_generate_editor_thumbnail(source.to_string_lossy().into_owned()).unwrap();

    assert!(thumbnail.starts_with("data:image/jpeg;base64,"));
}

#[test]
fn generate_image_preview_returns_preview_file_path() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("demo.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 8, Rgba([120, 100, 80, 255]))
        .save(&source)
        .unwrap();

    let mut adjustments = default_adjustments();
    adjustments.brightness = 10;
    adjustments.contrast = 5;

    let preview = run_generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments,
        max_width: Some(480),
        max_height: Some(320),
    })
    .unwrap();

    assert!(preview.data_url.is_some(), "调整预览应返回 data_url");
    assert!(preview.preview_path.is_none(), "调整预览不应写磁盘");
    assert!(preview
        .data_url
        .as_ref()
        .unwrap()
        .starts_with("data:image/jpeg;base64,"));
    assert!(preview.width > 0);
    assert!(preview.height > 0);
}

#[test]
fn prefetch_image_preview_uses_the_same_async_command_path_as_main_preview() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("prefetch-preview.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(12, 8, Rgba([80, 120, 160, 255]))
        .save(&source)
        .unwrap();

    run_prefetch_image_preview(PrefetchImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        max_width: Some(760),
        max_height: Some(560),
    })
    .unwrap();

    let preview = run_generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: default_adjustments(),
        max_width: Some(760),
        max_height: Some(560),
    })
    .unwrap();

    assert!(preview.preview_path.is_some(), "默认预览应写磁盘");
    assert!(preview.data_url.is_none(), "默认预览不应返回 data_url");
    let preview_path = PathBuf::from(preview.preview_path.as_ref().unwrap());
    assert!(preview_path.exists(), "预览文件应该存在");
    assert!(preview.preview_path.as_ref().unwrap().ends_with(".jpg"));
    assert!(preview.width > 0);
    assert!(preview.height > 0);
    assert!(preview.width <= 760);
    assert!(preview.height <= 560);
}

#[test]
fn generate_image_preview_invalidates_cache_when_source_file_changes() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("cache-source.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 8, Rgba([255, 0, 0, 255]))
        .save(&source)
        .unwrap();

    let first = run_generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: default_adjustments(),
        max_width: Some(320),
        max_height: Some(240),
    })
    .unwrap();

    std::thread::sleep(std::time::Duration::from_millis(5));
    ImageBuffer::<Rgba<u8>, _>::from_pixel(8, 8, Rgba([0, 255, 0, 255]))
        .save(&source)
        .unwrap();

    let second = run_generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: default_adjustments(),
        max_width: Some(320),
        max_height: Some(240),
    })
    .unwrap();

    // 源文件变化后，预览路径应该不同（缓存 key 包含 mtime 和 size）
    assert_ne!(first.preview_path, second.preview_path);
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
    assert_eq!(
        output_path.file_name().unwrap().to_string_lossy(),
        "demo_output.jpg"
    );
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

    let neutral = run_generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: default_adjustments(),
        max_width: Some(320),
        max_height: Some(240),
    })
    .unwrap();

    let mut warm_adjustments = default_adjustments();
    warm_adjustments.filter_type = "warm".into();
    warm_adjustments.filter_intensity = 100;

    let warm = run_generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: warm_adjustments,
        max_width: Some(320),
        max_height: Some(240),
    })
    .unwrap();

    // neutral 是默认预览（磁盘文件），warm 是调整预览（base64）
    let neutral_image = image::open(neutral.preview_path.as_ref().unwrap()).unwrap();
    let warm_data_url = warm.data_url.as_ref().unwrap();
    assert!(warm_data_url.starts_with("data:image/jpeg;base64,"));
    let warm_base64 = warm_data_url
        .strip_prefix("data:image/jpeg;base64,")
        .unwrap();
    let warm_bytes = base64::engine::general_purpose::STANDARD
        .decode(warm_base64)
        .unwrap();
    let warm_image = image::load_from_memory(&warm_bytes).unwrap();

    let neutral_pixel = neutral_image.get_pixel(0, 0).0;
    let warm_pixel = warm_image.get_pixel(0, 0).0;

    assert!(warm_pixel[0] > neutral_pixel[0]);
    assert!(warm_pixel[2] < neutral_pixel[2]);
}

#[test]
fn temperature_and_tint_change_preview_pixels() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("temperature-tint-preview.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(6, 6, Rgba([128, 128, 128, 255]))
        .save(&source)
        .unwrap();

    let neutral = run_generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: default_adjustments(),
        max_width: Some(320),
        max_height: Some(240),
    })
    .unwrap();

    let mut adjusted_adjustments = default_adjustments();
    adjusted_adjustments.temperature = 80;
    adjusted_adjustments.tint = 45;

    let adjusted = run_generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: adjusted_adjustments,
        max_width: Some(320),
        max_height: Some(240),
    })
    .unwrap();

    // neutral 是默认预览（磁盘），adjusted 是调整预览（base64）
    let neutral_image = image::open(neutral.preview_path.as_ref().unwrap()).unwrap();
    let adjusted_data_url = adjusted.data_url.as_ref().unwrap();
    let adjusted_base64 = adjusted_data_url
        .strip_prefix("data:image/jpeg;base64,")
        .unwrap();
    let adjusted_bytes = base64::engine::general_purpose::STANDARD
        .decode(adjusted_base64)
        .unwrap();
    let adjusted_image = image::load_from_memory(&adjusted_bytes).unwrap();

    assert_ne!(
        adjusted_image.get_pixel(0, 0).0,
        neutral_image.get_pixel(0, 0).0
    );
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
fn sepia_filter_changes_preview_pixels() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("sepia-preview.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(6, 6, Rgba([90, 120, 180, 255]))
        .save(&source)
        .unwrap();

    let neutral = run_generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: default_adjustments(),
        max_width: Some(320),
        max_height: Some(240),
    })
    .unwrap();

    let mut sepia_adjustments = default_adjustments();
    sepia_adjustments.filter_type = "sepia".into();
    sepia_adjustments.filter_intensity = 100;

    let sepia = run_generate_image_preview(GenerateImagePreviewRequest {
        path: source.to_string_lossy().into_owned(),
        adjustments: sepia_adjustments,
        max_width: Some(320),
        max_height: Some(240),
    })
    .unwrap();

    // neutral 是默认预览（磁盘），sepia 是调整预览（base64）
    let neutral_image = image::open(neutral.preview_path.as_ref().unwrap()).unwrap();
    let sepia_data_url = sepia.data_url.as_ref().unwrap();
    let sepia_base64 = sepia_data_url
        .strip_prefix("data:image/jpeg;base64,")
        .unwrap();
    let sepia_bytes = base64::engine::general_purpose::STANDARD
        .decode(sepia_base64)
        .unwrap();
    let sepia_image = image::load_from_memory(&sepia_bytes).unwrap();

    assert_ne!(
        sepia_image.get_pixel(0, 0).0,
        neutral_image.get_pixel(0, 0).0
    );
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

    let preview = run_generate_image_preview(GenerateImagePreviewRequest {
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

#[test]
fn commit_crop_creates_a_new_working_canvas_after_rotation() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("crop-commit-source.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(12, 8, Rgba([40, 160, 220, 255]))
        .save(&source)
        .unwrap();

    let result = commit_crop_to_working_image(CommitCropRequest {
        source_path: source.to_string_lossy().into_owned(),
        rotation: 90,
        crop: CropRect {
            x: 1,
            y: 2,
            width: 5,
            height: 4,
        },
    })
    .unwrap();

    let output = image::open(&result.working_image.path).unwrap();
    assert_eq!(output.dimensions(), (5, 4));
    assert_eq!(result.working_image.width, 5);
    assert_eq!(result.working_image.height, 4);
    assert_ne!(result.working_image.path, source.to_string_lossy());
}

#[test]
fn commit_crop_uses_a_stable_working_directory_even_for_existing_working_images() {
    let dir = tempdir().unwrap();
    let working_dir = dir.path().join(".editor-work");
    std::fs::create_dir_all(&working_dir).unwrap();
    let source = working_dir.join("crop-commit-source.png");

    ImageBuffer::<Rgba<u8>, _>::from_pixel(10, 8, Rgba([90, 140, 210, 255]))
        .save(&source)
        .unwrap();

    let result = commit_crop_to_working_image(CommitCropRequest {
        source_path: source.to_string_lossy().into_owned(),
        rotation: 0,
        crop: CropRect {
            x: 1,
            y: 1,
            width: 6,
            height: 5,
        },
    })
    .unwrap();

    let output_path = PathBuf::from(&result.working_image.path);
    let expected_working_dir = std::env::temp_dir().join("imageasy").join("editor-work");

    assert_eq!(output_path.parent(), Some(expected_working_dir.as_path()));
    assert!(output_path.exists());
}
