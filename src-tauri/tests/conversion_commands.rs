use std::{fs, path::PathBuf};

use image::{codecs::jpeg::JpegEncoder, ColorType, GenericImageView, ImageBuffer, Rgb, Rgba};
use tempfile::tempdir;

use imageasy_lib::commands::conversion::{
    convert_image_file, inspect_conversion_directory, inspect_conversion_file,
    ConvertImageFileRequest,
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
fn convert_image_file_reencodes_jpeg_family_to_requested_jpg_name() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.jpg");
    let target = dir.path().join("out").join("result.png");

    let image = ImageBuffer::<Rgb<u8>, _>::from_pixel(10, 8, Rgb([50, 90, 130]));
    let mut bytes = Vec::new();
    let mut writer = std::io::BufWriter::new(&mut bytes);
    JpegEncoder::new_with_quality(&mut writer, 90)
        .encode(image.as_raw(), 10, 8, ColorType::Rgb8.into())
        .unwrap();
    drop(writer);
    fs::write(&source, bytes).unwrap();

    let output_paths = convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "jpg".into(),
        color_mode: "grayscale".into(),
        quality: Some(80),
    })
    .unwrap();

    let output_path = PathBuf::from(&output_paths[0]);
    let output = image::open(&output_path).unwrap();

    assert_eq!(output_path.file_name().unwrap().to_string_lossy(), "result.jpg");
    assert_eq!(output.dimensions(), (10, 8));
}

#[test]
fn convert_image_file_writes_single_channel_grayscale_png() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let target = dir.path().join("out.png");

    ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([10, 120, 240]))
        .save(&source)
        .unwrap();

    let output_paths = convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "png".into(),
        color_mode: "grayscale".into(),
        quality: Some(90),
    })
    .unwrap();

    assert_eq!(output_paths.len(), 1);
    let decoded = image::open(&output_paths[0]).unwrap();
    assert!(matches!(decoded, image::DynamicImage::ImageLuma8(_)));
}

#[test]
fn convert_image_file_writes_single_channel_grayscale_webp() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source.png");
    let target = dir.path().join("out.webp");

    ImageBuffer::<Rgb<u8>, _>::from_pixel(4, 4, Rgb([10, 120, 240]))
        .save(&source)
        .unwrap();

    let output_paths = convert_image_file(ConvertImageFileRequest {
        source_path: source.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        output_format: "webp".into(),
        color_mode: "grayscale".into(),
        quality: Some(90),
    })
    .unwrap();

    assert_eq!(output_paths.len(), 1);
    let decoded = image::open(&output_paths[0]).unwrap();
    assert_eq!(decoded.dimensions(), (4, 4));
}


