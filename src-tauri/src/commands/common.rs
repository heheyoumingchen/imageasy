use anyhow::{Context, Result};
use image::{
    codecs::jpeg::JpegEncoder, codecs::png::PngEncoder, codecs::webp::WebPEncoder, ColorType,
    DynamicImage, ImageEncoder,
};
use std::{fs, io::BufWriter, path::Path};

pub fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase()
}

pub fn normalized_format(value: &str) -> String {
    match value.to_ascii_lowercase().as_str() {
        "jpeg" => "jpg".to_string(),
        other => other.to_string(),
    }
}

pub fn current_date_stamp() -> String {
    chrono::Local::now().format("%Y%m%d").to_string()
}

pub fn apply_color_mode(image: DynamicImage, color_mode: &str) -> DynamicImage {
    match color_mode {
        "gray-cmyk" => DynamicImage::ImageLuma8(image.grayscale().to_luma8()),
        _ => DynamicImage::ImageRgb8(image.to_rgb8()),
    }
}

pub fn write_dynamic_image(
    output_path: &Path,
    image: &DynamicImage,
    output_format: &str,
    quality: Option<u8>,
) -> Result<()> {
    let file = fs::File::create(output_path)
        .with_context(|| format!("无法创建输出文件: {}", output_path.display()))?;
    let mut writer = BufWriter::new(file);

    match image {
        DynamicImage::ImageLuma8(luma) if normalized_format(output_format) != "webp" => {
            let (width, height) = luma.dimensions();
            match normalized_format(output_format).as_str() {
                "jpg" => JpegEncoder::new_with_quality(&mut writer, quality.unwrap_or(90))
                    .encode(luma, width, height, ColorType::L8.into())?,
                "png" => PngEncoder::new(&mut writer).write_image(luma, width, height, ColorType::L8.into())?,
                other => anyhow::bail!("不支持的输出格式: {other}"),
            }
        }
        _ => {
            let rgb = image.to_rgb8();
            let (width, height) = rgb.dimensions();
            match normalized_format(output_format).as_str() {
                "jpg" => JpegEncoder::new_with_quality(&mut writer, quality.unwrap_or(90))
                    .encode(&rgb, width, height, ColorType::Rgb8.into())?,
                "png" => PngEncoder::new(&mut writer).write_image(&rgb, width, height, ColorType::Rgb8.into())?,
                "webp" => WebPEncoder::new_lossless(&mut writer).encode(&rgb, width, height, ColorType::Rgb8.into())?,
                other => anyhow::bail!("不支持的输出格式: {other}"),
            }
        }
    }

    Ok(())
}
