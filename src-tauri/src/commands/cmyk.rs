use anyhow::{Context, Result};
use image::RgbImage;
use jpeg_encoder::{ColorType, Encoder};
use lcms2::{Flags, Intent, PixelFormat, Profile, Transform};
use std::io::Write;
use std::sync::{Mutex, OnceLock};

const SRGB_ICC: &[u8] = include_bytes!("../../resources/color/sRGB_IEC61966-2.1.icm");
const SWOP_ICC: &[u8] = include_bytes!("../../resources/color/USWebCoatedSWOP.icc");

type CmykTransform = Transform<u8, u8>;

/// Photoshop「转换为配置文件」默认：sRGB IEC61966-2.1 → U.S. Web Coated (SWOP) v2，
/// 相对比色 + 黑点补偿。Little CMS 的 1-pixel cache 不是 Sync，因此用互斥锁保护。
fn with_cmyk_transform<T>(run: impl FnOnce(&CmykTransform) -> T) -> Result<T> {
    static TRANSFORM: OnceLock<Result<Mutex<CmykTransform>, String>> = OnceLock::new();
    let stored = TRANSFORM.get_or_init(|| {
        let srgb = Profile::new_icc(SRGB_ICC).map_err(|error| format!("无法解析 sRGB ICC: {error}"))?;
        let swop = Profile::new_icc(SWOP_ICC).map_err(|error| format!("无法解析 SWOP ICC: {error}"))?;
        let transform = Transform::new_flags(
            &srgb,
            PixelFormat::RGB_8,
            &swop,
            PixelFormat::CMYK_8,
            Intent::RelativeColorimetric,
            Flags::BLACKPOINT_COMPENSATION | Flags::HIGHRES_PRECALC,
        )
        .map_err(|error| format!("无法创建 sRGB→CMYK 转换: {error}"))?;
        Ok(Mutex::new(transform))
    });
    let transform = stored.as_ref().map_err(|message| anyhow::anyhow!("{message}"))?;
    let guard = transform
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    Ok(run(&guard))
}

pub(crate) fn rgb_image_to_cmyk_bytes(rgb: &RgbImage) -> Result<Vec<u8>> {
    let pixel_count = usize::try_from(rgb.width())?
        .checked_mul(usize::try_from(rgb.height())?)
        .context("图片尺寸过大")?;
    let mut cmyk = vec![0u8; pixel_count.checked_mul(4).context("CMYK 缓冲区过大")?];
    with_cmyk_transform(|transform| {
        transform.transform_pixels(rgb.as_raw(), &mut cmyk);
    })?;
    Ok(cmyk)
}

pub(crate) fn write_cmyk_jpeg<W: Write>(
    writer: &mut W,
    rgb: &RgbImage,
    quality: Option<u8>,
) -> Result<()> {
    let (width, height) = rgb.dimensions();
    let width = u16::try_from(width).context("图片宽度超出 JPEG 上限")?;
    let height = u16::try_from(height).context("图片高度超出 JPEG 上限")?;
    let cmyk = rgb_image_to_cmyk_bytes(rgb)?;
    let mut encoder = Encoder::new(writer, quality.unwrap_or(90));
    encoder
        .add_icc_profile(SWOP_ICC)
        .map_err(|error| anyhow::anyhow!("无法写入 CMYK ICC: {error}"))?;
    encoder
        .encode(&cmyk, width, height, ColorType::Cmyk)
        .map_err(|error| anyhow::anyhow!("无法编码 CMYK JPEG: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{rgb_image_to_cmyk_bytes, SRGB_ICC, SWOP_ICC};
    use image::{ImageBuffer, Rgb};

    #[test]
    fn bundled_icc_files_are_profiles() {
        assert!(SRGB_ICC.len() > 256);
        assert!(SWOP_ICC.len() > 1024);
        assert_eq!(&SRGB_ICC[36..40], b"acsp");
        assert_eq!(&SWOP_ICC[36..40], b"acsp");
    }

    #[test]
    fn icc_white_has_almost_no_ink() {
        let rgb = ImageBuffer::<Rgb<u8>, _>::from_pixel(1, 1, Rgb([255, 255, 255]));
        let cmyk = rgb_image_to_cmyk_bytes(&rgb).unwrap();
        assert_eq!(cmyk.len(), 4);
        assert!(cmyk.iter().all(|channel| *channel < 8), "white CMYK={cmyk:?}");
    }

    #[test]
    fn icc_black_is_mostly_key() {
        let rgb = ImageBuffer::<Rgb<u8>, _>::from_pixel(1, 1, Rgb([0, 0, 0]));
        let cmyk = rgb_image_to_cmyk_bytes(&rgb).unwrap();
        assert_eq!(cmyk.len(), 4);
        assert!(cmyk[3] > 180, "black should be K-heavy, got {cmyk:?}");
    }
}
