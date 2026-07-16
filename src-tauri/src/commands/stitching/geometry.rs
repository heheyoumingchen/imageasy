use anyhow::{Context, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct Size {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct SourceRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct DestinationRect {
    pub x: i64,
    pub y: i64,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct CoverRoi {
    pub source: SourceRect,
    pub destination: DestinationRect,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum JpegDctScale {
    Eighth,
    Quarter,
    Half,
    Full,
}

impl JpegDctScale {
    pub(super) fn divisor(self) -> u32 {
        match self {
            Self::Eighth => 8,
            Self::Quarter => 4,
            Self::Half => 2,
            Self::Full => 1,
        }
    }
}

pub(super) fn choose_jpeg_dct_scale(source: Size, roi: CoverRoi) -> JpegDctScale {
    let meets_destination = |divisor: u32| {
        let decoded_width = source.width.div_ceil(divisor);
        let decoded_height = source.height.div_ceil(divisor);
        let roi_width =
            (roi.source.width as u64 * decoded_width as u64).div_ceil(source.width as u64);
        let roi_height =
            (roi.source.height as u64 * decoded_height as u64).div_ceil(source.height as u64);
        roi_width >= roi.destination.width as u64 && roi_height >= roi.destination.height as u64
    };

    if meets_destination(8) {
        JpegDctScale::Eighth
    } else if meets_destination(4) {
        JpegDctScale::Quarter
    } else if meets_destination(2) {
        JpegDctScale::Half
    } else {
        JpegDctScale::Full
    }
}

pub(super) fn calculate_cover_roi(
    source: Size,
    cell: Size,
    scale: f32,
    offset_x: f32,
    offset_y: f32,
) -> Result<CoverRoi> {
    if source.width == 0 || source.height == 0 || cell.width == 0 || cell.height == 0 {
        anyhow::bail!("图片和方格尺寸必须大于 0");
    }
    if !scale.is_finite() || !offset_x.is_finite() || !offset_y.is_finite() {
        anyhow::bail!("图片缩放和位移必须是有限数值");
    }

    let scale = scale.clamp(1.0, 6.0) as f64;
    let offset_x = offset_x.clamp(-1.0, 1.0) as f64;
    let offset_y = offset_y.clamp(-1.0, 1.0) as f64;
    let cover_scale = (cell.width as f64 / source.width as f64)
        .max(cell.height as f64 / source.height as f64)
        * scale;

    let scaled_dimension = |dimension: u32| -> Result<u32> {
        let scaled = (dimension as f64 * cover_scale).round().max(1.0);
        if scaled > u32::MAX as f64 {
            anyhow::bail!("缩放后的图片尺寸过大");
        }
        Ok(scaled as u32)
    };
    let resized = Size {
        width: scaled_dimension(source.width)?,
        height: scaled_dimension(source.height)?,
    };

    let paste_offset = |target: u32, resized: u32, offset: f64| {
        let center = (target as f64 - resized as f64) / 2.0;
        let requested = center + offset * target as f64;
        let minimum = target as i64 - resized as i64;
        (requested.round() as i64).clamp(minimum.min(0), 0)
    };
    let paste_x = paste_offset(cell.width, resized.width, offset_x);
    let paste_y = paste_offset(cell.height, resized.height, offset_y);
    let scale_x = resized.width as f64 / source.width as f64;
    let scale_y = resized.height as f64 / source.height as f64;

    let axis_roi = |source_size: u32,
                    target_size: u32,
                    resized_size: u32,
                    paste: i64,
                    actual_scale: f64|
     -> Result<(u32, u32, i64, u32)> {
        let visible_start = (-paste).max(0) as f64;
        let visible_end = (target_size as i64 - paste).min(resized_size as i64) as f64;
        let support = 3.0 * (1.0 / actual_scale).max(1.0);
        let source_start = (visible_start / actual_scale - support).floor().max(0.0);
        let source_end = (visible_end / actual_scale + support)
            .ceil()
            .min(source_size as f64);
        let source_start = source_start as u32;
        let source_end = source_end as u32;
        let source_length = source_end
            .checked_sub(source_start)
            .context("可见源区域无效")?;
        if source_length == 0 {
            anyhow::bail!("可见源区域为空");
        }

        let resized_start = (source_start as f64 * actual_scale).floor() as i64;
        let resized_end = (source_end as f64 * actual_scale).ceil() as i64;
        let destination_length =
            u32::try_from(resized_end - resized_start).context("目标区域尺寸无效")?;
        Ok((
            source_start,
            source_length,
            paste + resized_start,
            destination_length,
        ))
    };

    let (source_x, source_width, destination_x, destination_width) =
        axis_roi(source.width, cell.width, resized.width, paste_x, scale_x)?;
    let (source_y, source_height, destination_y, destination_height) =
        axis_roi(source.height, cell.height, resized.height, paste_y, scale_y)?;

    Ok(CoverRoi {
        source: SourceRect {
            x: source_x,
            y: source_y,
            width: source_width,
            height: source_height,
        },
        destination: DestinationRect {
            x: destination_x,
            y: destination_y,
            width: destination_width,
            height: destination_height,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::{calculate_cover_roi, choose_jpeg_dct_scale, JpegDctScale, Size};

    #[test]
    fn cover_roi_horizontal_source_scale_one_is_centered_and_bounded() {
        let roi = calculate_cover_roi(
            Size {
                width: 400,
                height: 100,
            },
            Size {
                width: 100,
                height: 100,
            },
            1.0,
            0.0,
            0.0,
        )
        .unwrap();

        assert_eq!(roi.source.x, 147);
        assert_eq!(roi.source.y, 0);
        assert_eq!(roi.source.width, 106);
        assert_eq!(roi.source.height, 100);
        assert!(roi.destination.x <= 0);
        assert_eq!(roi.destination.y, 0);
        assert!(roi.destination.width >= 100);
        assert_eq!(roi.destination.height, 100);
    }

    #[test]
    fn cover_roi_vertical_source_scale_one_is_centered_and_bounded() {
        let roi = calculate_cover_roi(
            Size {
                width: 100,
                height: 400,
            },
            Size {
                width: 100,
                height: 100,
            },
            1.0,
            0.0,
            0.0,
        )
        .unwrap();

        assert_eq!(roi.source.x, 0);
        assert_eq!(roi.source.y, 147);
        assert_eq!(roi.source.width, 100);
        assert_eq!(roi.source.height, 106);
        assert_eq!(roi.destination.x, 0);
        assert!(roi.destination.y <= 0);
    }

    #[test]
    fn cover_roi_scale_six_stays_inside_extreme_aspect_source() {
        let source = Size {
            width: 12_000,
            height: 800,
        };
        let roi = calculate_cover_roi(
            source,
            Size {
                width: 300,
                height: 300,
            },
            6.0,
            1.0,
            -1.0,
        )
        .unwrap();

        assert!(roi.source.width > 0);
        assert!(roi.source.height > 0);
        assert!(roi.source.x + roi.source.width <= source.width);
        assert!(roi.source.y + roi.source.height <= source.height);
        assert!(roi.destination.width >= 300);
        assert!(roi.destination.height >= 300);
    }

    #[test]
    fn jpeg_dct_scale_uses_smallest_resolution_that_meets_destination() {
        let source = Size {
            width: 8000,
            height: 6000,
        };
        let small_roi = calculate_cover_roi(
            source,
            Size {
                width: 200,
                height: 150,
            },
            1.0,
            0.0,
            0.0,
        )
        .unwrap();
        assert_eq!(
            choose_jpeg_dct_scale(source, small_roi),
            JpegDctScale::Eighth
        );

        let large_roi = calculate_cover_roi(
            source,
            Size {
                width: 5000,
                height: 3750,
            },
            1.0,
            0.0,
            0.0,
        )
        .unwrap();
        assert_eq!(choose_jpeg_dct_scale(source, large_roi), JpegDctScale::Full);
    }

    #[test]
    fn cover_roi_rejects_zero_dimensions() {
        assert!(calculate_cover_roi(
            Size {
                width: 0,
                height: 100
            },
            Size {
                width: 100,
                height: 100
            },
            1.0,
            0.0,
            0.0,
        )
        .is_err());
        assert!(calculate_cover_roi(
            Size {
                width: 100,
                height: 100
            },
            Size {
                width: 0,
                height: 100
            },
            1.0,
            0.0,
            0.0,
        )
        .is_err());
    }
}
