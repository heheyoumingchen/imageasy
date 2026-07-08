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
        // 兼容旧配置里的 gray-cmyk；两者都输出真正的单通道灰度。
        "grayscale" | "gray-cmyk" => DynamicImage::ImageLuma8(image.into_luma8()),
        // 已经是 RGB8 时避免重复转换拷贝。
        _ => match image {
            DynamicImage::ImageRgb8(_) => image,
            other => DynamicImage::ImageRgb8(other.into_rgb8()),
        },
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
        DynamicImage::ImageLuma8(luma) => {
            let (width, height) = luma.dimensions();
            match normalized_format(output_format).as_str() {
                "jpg" => JpegEncoder::new_with_quality(&mut writer, quality.unwrap_or(90))
                    .encode(luma, width, height, ColorType::L8.into())?,
                "png" => PngEncoder::new(&mut writer).write_image(luma, width, height, ColorType::L8.into())?,
                // WebP 无损编码器支持单通道 L8，灰度直接写入不再回退到 RGB。
                "webp" => WebPEncoder::new_lossless(&mut writer).encode(luma, width, height, ColorType::L8.into())?,
                other => anyhow::bail!("不支持的输出格式: {other}"),
            }
        }
        _ => {
            // 已是 RGB8 时避免多一次拷贝，其它类型再转换。
            let rgb = image.as_rgb8().cloned().unwrap_or_else(|| image.to_rgb8());
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

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, ImageBuffer, Rgb};

    #[test]
    fn rgb_color_mode_keeps_rgb_images_rgb() {
        let source = DynamicImage::ImageRgb8(ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([1, 2, 3])));
        let output = apply_color_mode(source, "rgb");
        assert!(matches!(output, DynamicImage::ImageRgb8(_)));
    }

    #[test]
    fn grayscale_color_mode_returns_single_channel_luma() {
        let source = DynamicImage::ImageRgb8(ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([1, 2, 3])));
        let output = apply_color_mode(source, "grayscale");
        assert!(matches!(output, DynamicImage::ImageLuma8(_)));
    }

    #[test]
    fn legacy_gray_cmyk_still_maps_to_single_channel_luma() {
        let source = DynamicImage::ImageRgb8(ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([1, 2, 3])));
        let output = apply_color_mode(source, "gray-cmyk");
        assert!(matches!(output, DynamicImage::ImageLuma8(_)));
    }
}
