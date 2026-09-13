use std::{fs::File, io::BufReader, path::Path};

use anyhow::{Context, Result};
use image::imageops::FilterType;
use image::{imageops, DynamicImage, ImageBuffer, Luma, Rgb, Rgba, RgbaImage};
use jpeg_decoder::{Decoder as JpegDecoder, PixelFormat};

use super::geometry::{calculate_cover_roi, choose_jpeg_dct_scale, Size};

#[derive(Debug, Clone, Copy)]
pub(super) struct DestinationPlacement {
    pub x: i64,
    pub y: i64,
}

pub(super) fn render_cover_tile(
    source_path: &Path,
    source_size: Size,
    cell: Size,
    scale: f32,
    offset_x: f32,
    offset_y: f32,
) -> Result<RgbaImage> {
    let roi = calculate_cover_roi(source_size, cell, scale, offset_x, offset_y)?;
    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if !matches!(extension.as_str(), "jpg" | "jpeg") {
        let source = image::open(source_path)
            .with_context(|| format!("无法打开图片: {}", source_path.display()))?;
        return render_cover_tile_from_image(&source, cell, scale, offset_x, offset_y);
    }

    let file = File::open(source_path)
        .with_context(|| format!("无法打开 JPEG: {}", source_path.display()))?;
    let mut decoder = JpegDecoder::new(BufReader::new(file));
    decoder
        .read_info()
        .with_context(|| format!("无法读取 JPEG 头部: {}", source_path.display()))?;
    let dct_scale = choose_jpeg_dct_scale(source_size, roi);
    let divisor = dct_scale.divisor();
    let requested_width = source_size.width.div_ceil(divisor).min(u16::MAX as u32) as u16;
    let requested_height = source_size.height.div_ceil(divisor).min(u16::MAX as u32) as u16;
    decoder
        .scale(requested_width, requested_height)
        .with_context(|| format!("无法设置 JPEG 缩放: {}", source_path.display()))?;
    let pixels = decoder
        .decode()
        .with_context(|| format!("JPEG 解码失败: {}", source_path.display()))?;
    let info = decoder.info().context("JPEG 解码信息不可用")?;
    let decoded_size = Size {
        width: info.width as u32,
        height: info.height as u32,
    };
    let decoded = match info.pixel_format {
        PixelFormat::RGB24 => DynamicImage::ImageRgb8(
            ImageBuffer::<Rgb<u8>, _>::from_raw(decoded_size.width, decoded_size.height, pixels)
                .context("无法构建 JPEG RGB 图像")?,
        ),
        PixelFormat::L8 => DynamicImage::ImageLuma8(
            ImageBuffer::<Luma<u8>, _>::from_raw(decoded_size.width, decoded_size.height, pixels)
                .context("无法构建 JPEG 灰度图像")?,
        ),
        PixelFormat::CMYK32 => {
            let expected = decoded_size.width as usize * decoded_size.height as usize * 4;
            if pixels.len() != expected {
                anyhow::bail!("JPEG CMYK 像素缓冲尺寸无效");
            }
            let mut rgb = Vec::with_capacity(expected / 4 * 3);
            for pixel in pixels.as_chunks::<4>().0 {
                let c = pixel[0] as u16;
                let m = pixel[1] as u16;
                let y = pixel[2] as u16;
                let k = pixel[3] as u16;
                rgb.push((255 - (c + k).min(255)) as u8);
                rgb.push((255 - (m + k).min(255)) as u8);
                rgb.push((255 - (y + k).min(255)) as u8);
            }
            DynamicImage::ImageRgb8(
                ImageBuffer::<Rgb<u8>, _>::from_raw(decoded_size.width, decoded_size.height, rgb)
                    .context("无法构建 JPEG CMYK 转换图像")?,
            )
        }
        other => anyhow::bail!("不支持的 JPEG 像素格式: {other:?}"),
    };

    let scaled_source_rect = |start: u32, length: u32, original: u32, decoded: u32| {
        let ratio = decoded as f64 / original as f64;
        let mapped_start = (start as f64 * ratio).floor() as u32;
        let mapped_end = ((start + length) as f64 * ratio).ceil() as u32;
        let clamped_start = mapped_start.min(decoded.saturating_sub(1));
        let clamped_end = mapped_end.clamp(clamped_start + 1, decoded);
        (clamped_start, clamped_end - clamped_start)
    };
    let (crop_x, crop_width) = scaled_source_rect(
        roi.source.x,
        roi.source.width,
        source_size.width,
        decoded_size.width,
    );
    let (crop_y, crop_height) = scaled_source_rect(
        roi.source.y,
        roi.source.height,
        source_size.height,
        decoded_size.height,
    );
    let cropped = decoded.crop_imm(crop_x, crop_y, crop_width, crop_height);
    // CatmullRom 比 Lanczos3 明显更快，导出观感差异很小。
    let resized = cropped.resize_exact(
        roi.destination.width,
        roi.destination.height,
        FilterType::CatmullRom,
    );
    let mut tile = RgbaImage::from_pixel(cell.width, cell.height, Rgba([0, 0, 0, 0]));
    imageops::overlay(
        &mut tile,
        &resized.to_rgba8(),
        roi.destination.x,
        roi.destination.y,
    );
    Ok(tile)
}

pub(super) fn render_cover_tile_from_image(
    source: &DynamicImage,
    cell: Size,
    scale: f32,
    offset_x: f32,
    offset_y: f32,
) -> Result<RgbaImage> {
    let roi = calculate_cover_roi(
        Size {
            width: source.width(),
            height: source.height(),
        },
        cell,
        scale,
        offset_x,
        offset_y,
    )?;
    let cropped = source.crop_imm(
        roi.source.x,
        roi.source.y,
        roi.source.width,
        roi.source.height,
    );
    let resized = cropped.resize_exact(
        roi.destination.width,
        roi.destination.height,
        FilterType::CatmullRom,
    );
    let mut tile = RgbaImage::from_pixel(cell.width, cell.height, Rgba([0, 0, 0, 0]));
    imageops::overlay(
        &mut tile,
        &resized.to_rgba8(),
        roi.destination.x,
        roi.destination.y,
    );
    if tile.width() != cell.width || tile.height() != cell.height {
        return Err(anyhow::anyhow!("拼接方格尺寸不一致")).context("无法生成拼接方格");
    }
    Ok(tile)
}

pub(super) fn composite_tile(
    canvas: &mut RgbaImage,
    mut tile: RgbaImage,
    placement: DestinationPlacement,
    radius: u32,
) {
    if radius == 0 {
        imageops::overlay(canvas, &tile, placement.x, placement.y);
        return;
    }

    let radius = radius.min(tile.width() / 2).min(tile.height() / 2);
    let width = tile.width() as i64;
    let height = tile.height() as i64;
    let radius_i64 = radius as i64;
    let radius_sq = radius_i64 * radius_i64;

    // 圆角圆心取“内缩 radius 的角点”：左/上用 radius，右/下用 (size - 1 - radius)。
    // 只扫四个圆角区域，避免整 tile 像素双重循环。
    let clear_outside = |tile: &mut RgbaImage, x: u32, y: u32, cx: i64, cy: i64| {
        let dx = x as i64 - cx;
        let dy = y as i64 - cy;
        if dx * dx + dy * dy > radius_sq {
            tile.get_pixel_mut(x, y).0[3] = 0;
        }
    };

    let right_cx = width - radius_i64 - 1;
    let bottom_cy = height - radius_i64 - 1;

    for y in 0..radius {
        for x in 0..radius {
            clear_outside(&mut tile, x, y, radius_i64, radius_i64);
        }
    }
    for y in 0..radius {
        for x in (tile.width() - radius)..tile.width() {
            clear_outside(&mut tile, x, y, right_cx, radius_i64);
        }
    }
    for y in (tile.height() - radius)..tile.height() {
        for x in 0..radius {
            clear_outside(&mut tile, x, y, radius_i64, bottom_cy);
        }
    }
    for y in (tile.height() - radius)..tile.height() {
        for x in (tile.width() - radius)..tile.width() {
            clear_outside(&mut tile, x, y, right_cx, bottom_cy);
        }
    }

    imageops::overlay(canvas, &tile, placement.x, placement.y);
}

#[cfg(test)]
mod tests {
    use image::{DynamicImage, ImageBuffer, Rgba};

    use crate::commands::stitching::geometry::Size;

    use super::{composite_tile, render_cover_tile_from_image, DestinationPlacement};

    #[test]
    fn zero_radius_composite_matches_direct_overlay_pixel_for_pixel() {
        let background = Rgba([240, 241, 242, 255]);
        let mut expected = ImageBuffer::from_pixel(12, 12, background);
        let tile = ImageBuffer::from_fn(4, 4, |x, y| Rgba([x as u8 * 20, y as u8 * 20, 90, 255]));
        image::imageops::overlay(&mut expected, &tile, 3, 5);

        let mut actual = ImageBuffer::from_pixel(12, 12, background);
        composite_tile(&mut actual, tile, DestinationPlacement { x: 3, y: 5 }, 0);

        assert_eq!(actual.as_raw(), expected.as_raw());
    }

    #[test]
    fn rounded_corners_only_clear_corner_pixels() {
        let background = Rgba([10, 20, 30, 255]);
        let mut canvas = ImageBuffer::from_pixel(20, 20, background);
        let tile = ImageBuffer::from_pixel(10, 10, Rgba([200, 100, 50, 255]));
        composite_tile(&mut canvas, tile, DestinationPlacement { x: 5, y: 5 }, 3);

        // 圆角外侧 alpha 置 0 后 overlay 会保留背景色；中心与边中点仍为前景实色。
        assert_eq!(*canvas.get_pixel(5, 5), background);
        assert_eq!(*canvas.get_pixel(14, 5), background);
        assert_eq!(*canvas.get_pixel(5, 14), background);
        assert_eq!(*canvas.get_pixel(14, 14), background);
        assert_eq!(canvas.get_pixel(10, 10).0, [200, 100, 50, 255]);
        assert_eq!(canvas.get_pixel(10, 5).0, [200, 100, 50, 255]);
    }

    #[test]
    fn optimized_roi_cover_matches_reference_for_solid_horizontal_source() {
        let source =
            DynamicImage::ImageRgba8(ImageBuffer::from_pixel(400, 100, Rgba([20, 40, 60, 255])));
        let tile = render_cover_tile_from_image(
            &source,
            Size {
                width: 100,
                height: 100,
            },
            1.0,
            0.0,
            0.0,
        )
        .unwrap();

        assert_eq!(tile.dimensions(), (100, 100));
        assert!(tile.pixels().all(|pixel| pixel.0 == [20, 40, 60, 255]));
    }

    #[test]
    fn optimized_roi_cover_matches_reference_for_corner_offset() {
        let source =
            DynamicImage::ImageRgba8(ImageBuffer::from_pixel(100, 400, Rgba([80, 60, 40, 255])));
        let tile = render_cover_tile_from_image(
            &source,
            Size {
                width: 120,
                height: 80,
            },
            3.0,
            1.0,
            -1.0,
        )
        .unwrap();

        assert_eq!(tile.dimensions(), (120, 80));
        assert!(tile.pixels().all(|pixel| pixel.0 == [80, 60, 40, 255]));
    }

    #[test]
    fn rounded_composite_keeps_background_corners_and_tile_center() {
        let background = Rgba([255, 255, 255, 255]);
        let foreground = Rgba([40, 80, 120, 255]);
        let mut canvas = ImageBuffer::from_pixel(16, 16, background);
        let tile = ImageBuffer::from_pixel(10, 10, foreground);

        composite_tile(&mut canvas, tile, DestinationPlacement { x: 3, y: 3 }, 4);

        assert_eq!(*canvas.get_pixel(3, 3), background);
        assert_eq!(*canvas.get_pixel(8, 8), foreground);
    }
}
