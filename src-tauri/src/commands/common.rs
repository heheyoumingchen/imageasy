use super::cmyk::write_cmyk_jpeg;
use anyhow::{Context, Result};
use image::{
    codecs::jpeg::JpegEncoder, codecs::png::PngEncoder, codecs::webp::WebPEncoder, ColorType,
    DynamicImage, ImageEncoder,
};
use std::{
    fs,
    io::{BufWriter, Write},
    path::Path,
};

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
        // CMYK 在 write_dynamic_image 里编码为 4 通道 JPEG；这里保持 RGB 作为输入。
        _ => match image {
            DynamicImage::ImageRgb8(_) => image,
            other => DynamicImage::ImageRgb8(other.into_rgb8()),
        },
    }
}

fn webp_uses_lossless(quality: Option<u8>) -> bool {
    quality.unwrap_or(90) >= 100
}

#[cfg(test)]
fn webp_encoding_mode_for_test(quality: Option<u8>) -> &'static str {
    if webp_uses_lossless(quality) {
        "lossless"
    } else {
        "lossy"
    }
}

fn expand_luma_to_rgb(luma: &image::GrayImage) -> Result<image::RgbImage> {
    let pixel_count = usize::try_from(luma.width())?
        .checked_mul(usize::try_from(luma.height())?)
        .context("灰度图像尺寸过大")?;
    let mut bytes = Vec::with_capacity(pixel_count.checked_mul(3).context("RGB 缓冲区过大")?);
    for value in luma.as_raw() {
        bytes.extend_from_slice(&[*value, *value, *value]);
    }
    image::RgbImage::from_raw(luma.width(), luma.height(), bytes)
        .context("无法构建灰度 WebP 的 RGB 缓冲区")
}

pub(crate) fn write_atomically<F>(output_path: &Path, write: F) -> Result<()>
where
    F: FnOnce(&mut dyn Write) -> Result<()>,
{
    let parent = output_path.parent().context("输出文件缺少父目录")?;
    fs::create_dir_all(parent)
        .with_context(|| format!("无法创建输出目录: {}", parent.display()))?;
    let mut temporary = tempfile::Builder::new()
        .prefix(".imageasy-")
        .tempfile_in(parent)
        .with_context(|| format!("无法创建临时输出文件: {}", parent.display()))?;
    write(temporary.as_file_mut())?;
    temporary.as_file_mut().flush()?;
    temporary.as_file_mut().sync_all()?;
    temporary
        .persist(output_path)
        .map_err(|error| error.error)
        .with_context(|| format!("无法保存输出文件: {}", output_path.display()))?;
    Ok(())
}

/// 将源文件原子复制到目标路径（同目录临时文件 → persist），避免中途失败留下截断目标。
pub(crate) fn copy_file_atomically(source: &Path, output: &Path) -> Result<u64> {
    let mut copied = 0u64;
    write_atomically(output, |writer| {
        let mut reader = fs::File::open(source)
            .with_context(|| format!("无法打开源文件: {}", source.display()))?;
        copied = std::io::copy(&mut reader, writer)
            .with_context(|| format!("无法复制到: {}", output.display()))?;
        Ok(())
    })?;
    Ok(copied)
}

fn write_webp_rgb<W: Write>(
    writer: &mut W,
    rgb: &image::RgbImage,
    width: u32,
    height: u32,
    quality: Option<u8>,
) -> Result<()> {
    if webp_uses_lossless(quality) {
        WebPEncoder::new_lossless(&mut *writer).encode(
            rgb,
            width,
            height,
            ColorType::Rgb8.into(),
        )?;
    } else {
        webpx::Encoder::new_rgb(rgb.as_raw(), width, height)
            .quality(f32::from(quality.unwrap_or(90)))
            .encode_to_writer(webpx::Unstoppable, &mut *writer)
            .map_err(|error| anyhow::anyhow!("无法编码有损 WebP: {error:?}"))?;
    }
    Ok(())
}

fn write_webp_luma<W: Write>(
    writer: &mut W,
    luma: &image::GrayImage,
    width: u32,
    height: u32,
    quality: Option<u8>,
) -> Result<()> {
    if webp_uses_lossless(quality) {
        WebPEncoder::new_lossless(&mut *writer).encode(
            luma,
            width,
            height,
            ColorType::L8.into(),
        )?;
    } else {
        let rgb = expand_luma_to_rgb(luma)?;
        write_webp_rgb(writer, &rgb, width, height, quality)?;
    }
    Ok(())
}

fn write_rgb_image<W: Write>(
    writer: &mut W,
    rgb: &image::RgbImage,
    output_format: &str,
    quality: Option<u8>,
) -> Result<()> {
    let (width, height) = rgb.dimensions();
    match normalized_format(output_format).as_str() {
        "jpg" => JpegEncoder::new_with_quality(&mut *writer, quality.unwrap_or(90)).encode(
            rgb,
            width,
            height,
            ColorType::Rgb8.into(),
        )?,
        "png" => {
            PngEncoder::new(&mut *writer).write_image(rgb, width, height, ColorType::Rgb8.into())?
        }
        "webp" => write_webp_rgb(writer, rgb, width, height, quality)?,
        other => anyhow::bail!("不支持的输出格式: {other}"),
    }
    Ok(())
}

pub fn write_dynamic_image(
    output_path: &Path,
    image: &DynamicImage,
    output_format: &str,
    quality: Option<u8>,
    color_mode: &str,
) -> Result<()> {
    if color_mode == "cmyk" {
        if normalized_format(output_format) != "jpg" {
            anyhow::bail!("CMYK 仅支持 JPG 输出，请将导出格式改为 JPG");
        }
        return write_atomically(output_path, |file| {
            let mut writer = BufWriter::new(file);
            match image {
                DynamicImage::ImageRgb8(rgb) => write_cmyk_jpeg(&mut writer, rgb, quality)?,
                other => {
                    let rgb = other.to_rgb8();
                    write_cmyk_jpeg(&mut writer, &rgb, quality)?;
                }
            }
            writer.flush()?;
            Ok(())
        });
    }

    // 原子写：编码到父目录内的临时文件，成功后再替换目标，避免编码失败留下截断文件。
    write_atomically(output_path, |file| {
        let mut writer = BufWriter::new(file);
        match image {
            DynamicImage::ImageLuma8(luma) => {
                let (width, height) = luma.dimensions();
                match normalized_format(output_format).as_str() {
                    "jpg" => JpegEncoder::new_with_quality(&mut writer, quality.unwrap_or(90))
                        .encode(luma, width, height, ColorType::L8.into())?,
                    "png" => PngEncoder::new(&mut writer).write_image(
                        luma,
                        width,
                        height,
                        ColorType::L8.into(),
                    )?,
                    "webp" => write_webp_luma(&mut writer, luma, width, height, quality)?,
                    other => anyhow::bail!("不支持的输出格式: {other}"),
                }
            }
            DynamicImage::ImageRgb8(rgb) => {
                // 已是 RGB8 时直接借用底层像素，避免大图编码前整图克隆。
                write_rgb_image(&mut writer, rgb, output_format, quality)?;
            }
            _ => {
                let rgb = image.to_rgb8();
                write_rgb_image(&mut writer, &rgb, output_format, quality)?;
            }
        }
        writer.flush()?;
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, GrayImage, ImageBuffer, Luma, Rgb};
    use tempfile::{tempdir, tempfile};

    #[test]
    fn rgb_color_mode_keeps_rgb_images_rgb() {
        let source =
            DynamicImage::ImageRgb8(ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([1, 2, 3])));
        let output = apply_color_mode(source, "rgb");
        assert!(matches!(output, DynamicImage::ImageRgb8(_)));
    }

    #[test]
    fn cmyk_color_mode_keeps_rgb_working_image() {
        let source =
            DynamicImage::ImageRgb8(ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([1, 2, 3])));
        let output = apply_color_mode(source, "cmyk");
        assert!(matches!(output, DynamicImage::ImageRgb8(_)));
    }

    #[test]
    fn grayscale_color_mode_returns_single_channel_luma() {
        let source =
            DynamicImage::ImageRgb8(ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([1, 2, 3])));
        let output = apply_color_mode(source, "grayscale");
        assert!(matches!(output, DynamicImage::ImageLuma8(_)));
    }

    #[test]
    fn legacy_gray_cmyk_still_maps_to_single_channel_luma() {
        let source =
            DynamicImage::ImageRgb8(ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([1, 2, 3])));
        let output = apply_color_mode(source, "gray-cmyk");
        assert!(matches!(output, DynamicImage::ImageLuma8(_)));
    }

    #[test]
    fn webp_quality_below_100_uses_lossy_mode() {
        assert_eq!(webp_encoding_mode_for_test(Some(80)), "lossy");
        assert_eq!(webp_encoding_mode_for_test(Some(100)), "lossless");
        assert_eq!(webp_encoding_mode_for_test(None), "lossy");
    }

    #[test]
    fn lossy_webp_luma_expands_without_changing_the_source() {
        let luma = GrayImage::from_fn(2, 2, |x, y| Luma([(x + y * 2) as u8 * 40]));
        let before = luma.clone();

        let rgb = expand_luma_to_rgb(&luma).unwrap();

        assert_eq!(luma, before);
        assert_eq!(rgb.get_pixel(1, 1).0, [120, 120, 120]);
    }

    #[test]
    fn atomic_write_keeps_existing_target_when_writer_fails() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("target.bin");
        fs::write(&target, b"old-bytes").unwrap();

        let error = write_atomically(&target, |writer| {
            writer.write_all(b"partial")?;
            anyhow::bail!("injected failure")
        })
        .unwrap_err();

        assert!(error.to_string().contains("injected failure"));
        assert_eq!(fs::read(&target).unwrap(), b"old-bytes");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn copy_file_atomically_preserves_bytes_and_replaces_target() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("source.bin");
        let target = dir.path().join("target.bin");
        fs::write(&source, b"fresh-payload").unwrap();
        fs::write(&target, b"stale").unwrap();

        let copied = copy_file_atomically(&source, &target).unwrap();

        assert_eq!(copied, 13);
        assert_eq!(fs::read(&target).unwrap(), b"fresh-payload");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 2);
    }

    #[test]
    fn lossy_webp_encoder_errors_instead_of_panicking_on_invalid_dimensions() {
        let rgb = image::RgbImage::new(0, 1);
        let file = tempfile().unwrap();
        let mut writer = BufWriter::new(file);

        let result = write_webp_rgb(&mut writer, &rgb, 0, 1, Some(80));

        assert!(result.is_err());
    }

    #[test]
    fn cmyk_jpeg_write_is_decoded_as_cmyk32() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("cmyk.jpg");
        let rgb = DynamicImage::ImageRgb8(ImageBuffer::<Rgb<u8>, _>::from_pixel(8, 6, Rgb([200, 20, 30])));

        write_dynamic_image(&target, &rgb, "jpg", Some(90), "cmyk").unwrap();

        let file = fs::File::open(&target).unwrap();
        let mut decoder = jpeg_decoder::Decoder::new(std::io::BufReader::new(file));
        decoder.read_info().unwrap();
        assert_eq!(
            decoder.info().unwrap().pixel_format,
            jpeg_decoder::PixelFormat::CMYK32
        );
    }

    #[test]
    fn cmyk_png_is_rejected() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("cmyk.png");
        let rgb = DynamicImage::ImageRgb8(ImageBuffer::<Rgb<u8>, _>::from_pixel(2, 2, Rgb([1, 2, 3])));

        let error = write_dynamic_image(&target, &rgb, "png", Some(90), "cmyk").unwrap_err();
        assert!(error.to_string().contains("CMYK 仅支持 JPG"));
        assert!(!target.exists());
    }
}
