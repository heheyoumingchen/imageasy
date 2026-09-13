use std::{
    fs::{self, File},
    io::BufReader,
    path::Path,
};

use anyhow::{Context, Result};
use image::{DynamicImage, ImageBuffer, Luma, Rgb};
use jpeg_decoder::{Decoder, PixelFormat};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SourcePixelFormat {
    Luma8,
    Rgb8,
    Cmyk8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct SourceImageInfo {
    pub width: u32,
    pub height: u32,
    pub pixel_format: SourcePixelFormat,
    pub compressed_bytes: u64,
}

pub(crate) fn read_jpeg_info(path: &Path) -> Result<SourceImageInfo> {
    let file = File::open(path).with_context(|| format!("无法打开 JPEG: {}", path.display()))?;
    let compressed_bytes = file.metadata()?.len();
    read_jpeg_info_from_reader(BufReader::new(file), compressed_bytes)
}

fn read_jpeg_info_from_reader<R: std::io::Read>(
    reader: R,
    compressed_bytes: u64,
) -> Result<SourceImageInfo> {
    let mut decoder = Decoder::new(reader);
    decoder.read_info().context("无法读取 JPEG 头部")?;
    let info = decoder.info().context("JPEG 头部缺少图片信息")?;
    let pixel_format = match info.pixel_format {
        PixelFormat::L8 => SourcePixelFormat::Luma8,
        PixelFormat::RGB24 => SourcePixelFormat::Rgb8,
        PixelFormat::CMYK32 => SourcePixelFormat::Cmyk8,
        other => anyhow::bail!("不支持的 JPEG 像素格式: {other:?}"),
    };
    Ok(SourceImageInfo {
        width: info.width.into(),
        height: info.height.into(),
        pixel_format,
        compressed_bytes,
    })
}

pub(crate) fn decode_jpeg(path: &Path, color_mode: &str) -> Result<DynamicImage> {
    let file = File::open(path).with_context(|| format!("无法打开 JPEG: {}", path.display()))?;
    let mut decoder = Decoder::new(BufReader::new(file));
    decoder.read_info().context("无法读取 JPEG 头部")?;
    let info = decoder.info().context("JPEG 头部缺少图片信息")?;
    let width = u32::from(info.width);
    let height = u32::from(info.height);
    let channels = match info.pixel_format {
        PixelFormat::L8 => 1usize,
        PixelFormat::RGB24 => 3,
        PixelFormat::CMYK32 => 4,
        other => anyhow::bail!("不支持的 JPEG 像素格式: {other:?}"),
    };
    let maximum = checked_image_buffer_bytes(width, height, channels)?;
    decoder.set_max_decoding_buffer_size(maximum);
    let pixels = decoder.decode().context("JPEG 解码失败")?;

    match info.pixel_format {
        PixelFormat::L8 => {
            let luma = ImageBuffer::<Luma<u8>, _>::from_raw(width, height, pixels)
                .context("无法构建 JPEG 灰度图像")?;
            if matches!(color_mode, "grayscale" | "gray-cmyk") {
                Ok(DynamicImage::ImageLuma8(luma))
            } else {
                Ok(DynamicImage::ImageRgb8(
                    DynamicImage::ImageLuma8(luma).into_rgb8(),
                ))
            }
        }
        PixelFormat::RGB24 => {
            let rgb = ImageBuffer::<Rgb<u8>, _>::from_raw(width, height, pixels)
                .context("无法构建 JPEG RGB 图像")?;
            let image = DynamicImage::ImageRgb8(rgb);
            if matches!(color_mode, "grayscale" | "gray-cmyk") {
                Ok(DynamicImage::ImageLuma8(image.into_luma8()))
            } else {
                Ok(image)
            }
        }
        PixelFormat::CMYK32 => {
            let mut rgb = Vec::with_capacity(checked_image_buffer_bytes(width, height, 3)?);
            for pixel in pixels.as_chunks::<4>().0 {
                let c = u16::from(pixel[0]);
                let m = u16::from(pixel[1]);
                let y = u16::from(pixel[2]);
                let k = u16::from(pixel[3]);
                rgb.push((255 - (c + k).min(255)) as u8);
                rgb.push((255 - (m + k).min(255)) as u8);
                rgb.push((255 - (y + k).min(255)) as u8);
            }
            let image = DynamicImage::ImageRgb8(
                ImageBuffer::<Rgb<u8>, _>::from_raw(width, height, rgb)
                    .context("无法构建 JPEG CMYK 转换图像")?,
            );
            if matches!(color_mode, "grayscale" | "gray-cmyk") {
                Ok(DynamicImage::ImageLuma8(image.into_luma8()))
            } else {
                Ok(image)
            }
        }
        other => anyhow::bail!("不支持的 JPEG 像素格式: {other:?}"),
    }
}

fn checked_image_buffer_bytes(width: u32, height: u32, channels: usize) -> Result<usize> {
    let pixels = usize::try_from(width)?
        .checked_mul(usize::try_from(height)?)
        .context("图片像素数量过大")?;
    pixels.checked_mul(channels).context("图片缓冲区过大")
}

/// JPG→JPG 严格无变换复制的资格判定输入。任一条件不满足都必须走重编码路径。
#[derive(Debug, Clone, Copy)]
pub(crate) struct JpegCopyEligibility {
    pub source_is_confirmed_jpeg: bool,
    pub output_is_jpeg: bool,
    pub quality: Option<u8>,
    pub preserves_original_color: bool,
    pub has_pixel_transform: bool,
    pub changes_metadata: bool,
    pub source_equals_destination: bool,
}

pub(crate) fn qualifies_for_jpeg_copy(input: JpegCopyEligibility) -> bool {
    input.source_is_confirmed_jpeg
        && input.output_is_jpeg
        && input.quality == Some(100)
        && input.preserves_original_color
        && !input.has_pixel_transform
        && !input.changes_metadata
        && !input.source_equals_destination
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ImageConversionOperation {
    CopyJpeg,
    Transcode,
}

#[derive(Debug, Clone)]
pub(crate) struct ImageConversionPlan {
    pub operation: ImageConversionOperation,
    pub actual_output_path: std::path::PathBuf,
    /// 规范化后源与目标是否指向同一文件；由后端权威判定，不信任前端。
    pub source_equals_destination: bool,
}

/// 在 Windows 上对已规范化路径做大小写不敏感比较。
pub(crate) fn paths_equal_for_copy(left: &Path, right: &Path) -> bool {
    #[cfg(windows)]
    {
        left.to_string_lossy()
            .eq_ignore_ascii_case(&right.to_string_lossy())
    }
    #[cfg(not(windows))]
    {
        left == right
    }
}

/// 规范化已存在路径；目标不存在时规范化其父目录再拼接文件名。
pub(crate) fn canonicalize_for_compare(path: &Path) -> Result<std::path::PathBuf> {
    if path.exists() {
        return path
            .canonicalize()
            .with_context(|| format!("无法规范化路径: {}", path.display()));
    }
    let parent = path.parent().context("输出文件缺少父目录")?;
    let file_name = path.file_name().context("输出文件缺少文件名")?;
    let canonical_parent = if parent.as_os_str().is_empty() {
        std::env::current_dir().context("无法获取当前目录")?
    } else {
        fs::create_dir_all(parent)
            .with_context(|| format!("无法创建输出目录: {}", parent.display()))?;
        parent
            .canonicalize()
            .with_context(|| format!("无法规范化输出目录: {}", parent.display()))?
    };
    Ok(canonical_parent.join(file_name))
}

pub(crate) fn plan_image_conversion(
    source_path: &Path,
    output_path: &Path,
    output_format: &str,
    color_mode: &str,
    quality: Option<u8>,
    source_is_confirmed_jpeg: bool,
) -> Result<ImageConversionPlan> {
    let format_lower = output_format.to_ascii_lowercase();
    let format = match format_lower.as_str() {
        "jpeg" | "jpg" => "jpg",
        other => other,
    };
    let actual_output_path = output_path.with_extension(format);
    let source_canonical = canonicalize_for_compare(source_path)?;
    let output_canonical = canonicalize_for_compare(&actual_output_path)?;
    let source_equals_destination = paths_equal_for_copy(&source_canonical, &output_canonical);
    let preserves_original_color = matches!(color_mode, "rgb" | "original" | "");

    let operation = if qualifies_for_jpeg_copy(JpegCopyEligibility {
        source_is_confirmed_jpeg,
        output_is_jpeg: format == "jpg",
        quality,
        preserves_original_color,
        has_pixel_transform: false,
        changes_metadata: false,
        source_equals_destination,
    }) {
        ImageConversionOperation::CopyJpeg
    } else {
        ImageConversionOperation::Transcode
    };

    Ok(ImageConversionPlan {
        operation,
        actual_output_path,
        source_equals_destination,
    })
}

/// 峰值内存估算（字节）。用于加权信号量，宁可高估不可低估。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ImageMemoryEstimate {
    pub peak_bytes: u64,
}

const ALLOCATION_SAFETY_LIMIT_BYTES: u64 = 8 * 1024 * 1024 * 1024; // 8 GiB hard reject

fn checked_mul_u64(a: u64, b: u64) -> Result<u64> {
    a.checked_mul(b).context("内存估算乘法溢出")
}

fn checked_add_u64(a: u64, b: u64) -> Result<u64> {
    a.checked_add(b).context("内存估算加法溢出")
}

fn pixels_u64(width: u32, height: u32) -> Result<u64> {
    checked_mul_u64(u64::from(width), u64::from(height))
}

fn reject_if_too_large(bytes: u64) -> Result<u64> {
    if bytes == 0 {
        anyhow::bail!("内存估算结果为零");
    }
    if bytes > ALLOCATION_SAFETY_LIMIT_BYTES {
        anyhow::bail!("图片缓冲区超过安全上限");
    }
    // 确认能装进 usize（32 位平台上的额外保护）
    let _ = usize::try_from(bytes).context("图片缓冲区无法装入平台 usize")?;
    Ok(bytes)
}

/// 根据已规划的操作与源信息估算峰值占用。
pub(crate) fn estimate_conversion_memory(
    info: &SourceImageInfo,
    operation: ImageConversionOperation,
    output_format: &str,
    color_mode: &str,
    quality: Option<u8>,
) -> Result<ImageMemoryEstimate> {
    if operation == ImageConversionOperation::CopyJpeg {
        // 复制路径只缓冲压缩流，外加少量 IO 开销。
        let peak = checked_add_u64(info.compressed_bytes.max(1), 64 * 1024)?;
        return Ok(ImageMemoryEstimate {
            peak_bytes: reject_if_too_large(peak)?,
        });
    }

    let pixels = pixels_u64(info.width, info.height)?;
    let source_channels: u64 = match info.pixel_format {
        SourcePixelFormat::Luma8 => 1,
        SourcePixelFormat::Rgb8 => 3,
        SourcePixelFormat::Cmyk8 => 4,
    };
    let wants_luma = matches!(color_mode, "grayscale" | "gray-cmyk");
    let wants_cmyk = color_mode == "cmyk";
    let decoded = checked_mul_u64(pixels, source_channels)?;

    // 色彩转换后的工作缓冲区。CMYK JPEG 另有 4 通道油墨缓冲。
    let working_channels: u64 = if wants_luma {
        1
    } else if wants_cmyk {
        4
    } else {
        3
    };
    let working = checked_mul_u64(pixels, working_channels)?;

    // 源与工作缓冲可能同时存在（CMYK→RGB、RGB→Luma）。
    let mut peak = checked_add_u64(decoded, working)?;

    let format_lower = output_format.to_ascii_lowercase();
    let format = match format_lower.as_str() {
        "jpeg" | "jpg" => "jpg",
        "png" => "png",
        "webp" => "webp",
        other => other,
    };

    // 编码侧额外缓冲。CMYK 路径同时保留 RGB 工作图与 4 通道油墨缓冲。
    let encode_extra = match format {
        "jpg" if wants_cmyk => checked_add_u64(checked_mul_u64(pixels, 3)?, working)?,
        "jpg" => {
            // JPEG 编码器输出缓冲约等于工作图。
            working
        }
        "png" => working,
        "webp" => {
            let lossless = quality.unwrap_or(90) >= 100;
            if wants_luma && !lossless {
                // lossy 灰度 WebP 需扩展为 RGB。
                checked_mul_u64(pixels, 3)?
            } else {
                working
            }
        }
        _ => working,
    };
    peak = checked_add_u64(peak, encode_extra)?;
    // 压缩结果缓冲粗估：工作图的一半，至少 256 KiB。
    let compressed_estimate = (working / 2).max(256 * 1024);
    peak = checked_add_u64(peak, compressed_estimate)?;

    Ok(ImageMemoryEstimate {
        peak_bytes: reject_if_too_large(peak)?,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        checked_image_buffer_bytes, estimate_conversion_memory, plan_image_conversion,
        qualifies_for_jpeg_copy, ImageConversionOperation, JpegCopyEligibility, SourceImageInfo,
        SourcePixelFormat, ALLOCATION_SAFETY_LIMIT_BYTES,
    };
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn checked_image_buffer_bytes_rejects_overflow() {
        if usize::BITS == 32 {
            assert!(checked_image_buffer_bytes(u32::MAX, u32::MAX, 4).is_err());
        } else {
            assert_eq!(checked_image_buffer_bytes(100, 200, 3).unwrap(), 60_000);
        }
    }

    fn eligible() -> JpegCopyEligibility {
        JpegCopyEligibility {
            source_is_confirmed_jpeg: true,
            output_is_jpeg: true,
            quality: Some(100),
            preserves_original_color: true,
            has_pixel_transform: false,
            changes_metadata: false,
            source_equals_destination: false,
        }
    }

    #[test]
    fn jpeg_copy_only_when_every_condition_holds() {
        assert!(qualifies_for_jpeg_copy(eligible()));
        assert!(!qualifies_for_jpeg_copy(JpegCopyEligibility {
            quality: Some(99),
            ..eligible()
        }));
        assert!(!qualifies_for_jpeg_copy(JpegCopyEligibility {
            quality: None,
            ..eligible()
        }));
        assert!(!qualifies_for_jpeg_copy(JpegCopyEligibility {
            preserves_original_color: false,
            ..eligible()
        }));
        assert!(!qualifies_for_jpeg_copy(JpegCopyEligibility {
            output_is_jpeg: false,
            ..eligible()
        }));
        assert!(!qualifies_for_jpeg_copy(JpegCopyEligibility {
            source_is_confirmed_jpeg: false,
            ..eligible()
        }));
        assert!(!qualifies_for_jpeg_copy(JpegCopyEligibility {
            has_pixel_transform: true,
            ..eligible()
        }));
        assert!(!qualifies_for_jpeg_copy(JpegCopyEligibility {
            changes_metadata: true,
            ..eligible()
        }));
        assert!(!qualifies_for_jpeg_copy(JpegCopyEligibility {
            source_equals_destination: true,
            ..eligible()
        }));
    }

    #[test]
    fn plan_image_conversion_copies_only_strict_quality_100_rgb_jpeg() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("a.jpg");
        let dest = dir.path().join("b.jpg");
        fs::write(&source, b"\xFF\xD8\xFF\xD9").unwrap();

        let plan = plan_image_conversion(&source, &dest, "jpg", "rgb", Some(100), true).unwrap();
        assert_eq!(plan.operation, ImageConversionOperation::CopyJpeg);

        let plan = plan_image_conversion(&source, &dest, "jpg", "rgb", Some(99), true).unwrap();
        assert_eq!(plan.operation, ImageConversionOperation::Transcode);

        let plan =
            plan_image_conversion(&source, &dest, "jpg", "grayscale", Some(100), true).unwrap();
        assert_eq!(plan.operation, ImageConversionOperation::Transcode);

        let plan = plan_image_conversion(&source, &dest, "jpg", "cmyk", Some(100), true).unwrap();
        assert_eq!(plan.operation, ImageConversionOperation::Transcode);

        let plan = plan_image_conversion(&source, &source, "jpg", "rgb", Some(100), true).unwrap();
        assert_eq!(plan.operation, ImageConversionOperation::Transcode);
    }

    fn rgb_info(w: u32, h: u32, compressed: u64) -> SourceImageInfo {
        SourceImageInfo {
            width: w,
            height: h,
            pixel_format: SourcePixelFormat::Rgb8,
            compressed_bytes: compressed,
        }
    }

    #[test]
    fn memory_estimate_copy_is_near_compressed_size() {
        let info = rgb_info(1000, 1000, 120_000);
        let estimate = estimate_conversion_memory(
            &info,
            ImageConversionOperation::CopyJpeg,
            "jpg",
            "rgb",
            Some(100),
        )
        .unwrap();
        assert!(estimate.peak_bytes >= 120_000);
        assert!(estimate.peak_bytes < 120_000 + 200_000);
    }

    #[test]
    fn memory_estimate_rgb_jpeg_transcode_is_nonzero_and_scales() {
        let small = estimate_conversion_memory(
            &rgb_info(100, 100, 1_000),
            ImageConversionOperation::Transcode,
            "jpg",
            "rgb",
            Some(90),
        )
        .unwrap();
        let large = estimate_conversion_memory(
            &rgb_info(1000, 1000, 1_000),
            ImageConversionOperation::Transcode,
            "jpg",
            "rgb",
            Some(90),
        )
        .unwrap();
        assert!(small.peak_bytes > 0);
        assert!(large.peak_bytes > small.peak_bytes);
        // 至少覆盖 3 通道解码 + 工作 + 编码。
        assert!(large.peak_bytes >= 1000 * 1000 * 3);
    }

    #[test]
    fn memory_estimate_grayscale_and_cmyk_and_webp_paths() {
        let rgb_to_luma = estimate_conversion_memory(
            &rgb_info(200, 100, 500),
            ImageConversionOperation::Transcode,
            "jpg",
            "grayscale",
            Some(90),
        )
        .unwrap();
        let cmyk = estimate_conversion_memory(
            &SourceImageInfo {
                width: 200,
                height: 100,
                pixel_format: SourcePixelFormat::Cmyk8,
                compressed_bytes: 500,
            },
            ImageConversionOperation::Transcode,
            "jpg",
            "rgb",
            Some(90),
        )
        .unwrap();
        let lossy_luma_webp = estimate_conversion_memory(
            &SourceImageInfo {
                width: 200,
                height: 100,
                pixel_format: SourcePixelFormat::Luma8,
                compressed_bytes: 500,
            },
            ImageConversionOperation::Transcode,
            "webp",
            "grayscale",
            Some(90),
        )
        .unwrap();
        let lossless_webp = estimate_conversion_memory(
            &rgb_info(200, 100, 500),
            ImageConversionOperation::Transcode,
            "webp",
            "rgb",
            Some(100),
        )
        .unwrap();
        let png = estimate_conversion_memory(
            &rgb_info(200, 100, 500),
            ImageConversionOperation::Transcode,
            "png",
            "rgb",
            None,
        )
        .unwrap();

        assert!(rgb_to_luma.peak_bytes > 0);
        assert!(cmyk.peak_bytes > rgb_to_luma.peak_bytes);
        assert!(lossy_luma_webp.peak_bytes > 0);
        assert!(lossless_webp.peak_bytes > 0);
        assert!(png.peak_bytes > 0);
    }

    #[test]
    fn memory_estimate_rejects_overflow_and_safety_limit() {
        let huge = SourceImageInfo {
            width: u32::MAX,
            height: u32::MAX,
            pixel_format: SourcePixelFormat::Rgb8,
            compressed_bytes: 1,
        };
        assert!(estimate_conversion_memory(
            &huge,
            ImageConversionOperation::Transcode,
            "jpg",
            "rgb",
            Some(90),
        )
        .is_err());

        let over_limit = SourceImageInfo {
            width: 50_000,
            height: 50_000,
            pixel_format: SourcePixelFormat::Rgb8,
            compressed_bytes: 1,
        };
        // 50k² * 3 * ~3 buffers 远超 8 GiB 安全上限或 usize 限制。
        let result = estimate_conversion_memory(
            &over_limit,
            ImageConversionOperation::Transcode,
            "jpg",
            "rgb",
            Some(90),
        );
        assert!(result.is_err() || result.unwrap().peak_bytes <= ALLOCATION_SAFETY_LIMIT_BYTES);
    }
}
