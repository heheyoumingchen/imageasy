use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{codecs::jpeg::JpegEncoder, imageops, imageops::FilterType, DynamicImage, GenericImageView, Rgba};
use std::{collections::HashMap, io::Cursor, sync::Mutex};

use super::{
    apply_adjustments, apply_saturation, mix_channel, shift_channel,
    GenerateImagePreviewRequest, GenerateImagePreviewResult, PREVIEW_CACHE,
};

#[tauri::command]
pub fn generate_image_preview(request: GenerateImagePreviewRequest) -> Result<GenerateImagePreviewResult, String> {
    generate_image_preview_impl(request).map_err(|error| error.to_string())
}

fn generate_image_preview_impl(request: GenerateImagePreviewRequest) -> Result<GenerateImagePreviewResult> {
    let preview_width = request.max_width.unwrap_or(560);
    let preview_height = request.max_height.unwrap_or(420);
    let prepared = get_or_prepare_preview_image(&request.path, preview_width, preview_height)?;
    let processed = apply_adjustments(prepared.clone(), &request.adjustments);

    let (width, height) = processed.dimensions();
    let mut buffer = Cursor::new(Vec::new());
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, 60);
    encoder.encode_image(&processed)?;
    let encoded = STANDARD.encode(buffer.into_inner());

    Ok(GenerateImagePreviewResult {
        data_url: format!("data:image/jpeg;base64,{encoded}"),
        width,
        height,
    })
}

fn get_or_prepare_preview_image(path: &str, width: u32, height: u32) -> Result<DynamicImage> {
    let cache_key = format!("{path}::{width}x{height}");
    let cache = PREVIEW_CACHE.get_or_init(|| Mutex::new(HashMap::new()));

    if let Some(image) = cache
        .lock()
        .map_err(|_| anyhow::anyhow!("预览缓存不可用"))?
        .get(&cache_key)
        .cloned()
    {
        return Ok(image);
    }

    let source_image = image::open(path).with_context(|| format!("无法打开图片: {path}"))?;
    let prepared = source_image.resize(width, height, FilterType::Nearest);

    cache
        .lock()
        .map_err(|_| anyhow::anyhow!("预览缓存不可用"))?
        .insert(cache_key, prepared.clone());

    Ok(prepared)
}

pub(crate) fn apply_filter(image: DynamicImage, filter_type: &str, intensity: f32) -> DynamicImage {
    let amount = intensity.clamp(0.0, 1.0);

    match filter_type {
        "none" => image,
        "grayscale" => apply_grayscale_filter(image, amount),
        "warm" => apply_channel_mix_filter(image, amount, 28.0, 10.0, -24.0),
        "cool" => apply_channel_mix_filter(image, amount, -18.0, 6.0, 28.0),
        "vintage" => apply_vintage_filter(image, amount),
        "sepia" => apply_sepia_filter(image, amount),
        "vivid" => apply_vivid_filter(image, amount),
        "fade" => apply_fade_filter(image, amount),
        "cinematic" => apply_cinematic_filter(image, amount),
        "noir" => apply_noir_filter(image, amount),
        "polaroid" => apply_polaroid_filter(image, amount),
        "dreamy" => apply_dreamy_filter(image, amount),
        "summer" => apply_summer_filter(image, amount),
        "forest" => apply_forest_filter(image, amount),
        _ => image,
    }
}

pub(crate) fn apply_sharpen(image: DynamicImage, amount: f32) -> DynamicImage {
    if amount.abs() < f32::EPSILON {
        return image;
    }

    let sigma = (1.0 + amount.abs() * 1.5).max(0.1);
    let threshold = (amount.abs() * 12.0).round() as i32;
    DynamicImage::ImageRgba8(imageops::unsharpen(&image.to_rgba8(), sigma, threshold))
}

pub(crate) fn apply_clarity(image: DynamicImage, amount: f32) -> DynamicImage {
    if amount.abs() < f32::EPSILON {
        return image;
    }

    let blurred = image.blur(1.6).to_rgba8();
    let mut rgba = image.to_rgba8();
    let mix_amount = amount.clamp(-1.0, 1.0) * 0.6;

    for (pixel, blurred_pixel) in rgba.pixels_mut().zip(blurred.pixels()) {
        let [r, g, b, a] = pixel.0;
        let [br, bg, bb, _] = blurred_pixel.0;

        let nr = ((r as f32) + (r as f32 - br as f32) * mix_amount).round().clamp(0.0, 255.0) as u8;
        let ng = ((g as f32) + (g as f32 - bg as f32) * mix_amount).round().clamp(0.0, 255.0) as u8;
        let nb = ((b as f32) + (b as f32 - bb as f32) * mix_amount).round().clamp(0.0, 255.0) as u8;
        *pixel = Rgba([nr, ng, nb, a]);
    }

    DynamicImage::ImageRgba8(rgba)
}

fn apply_grayscale_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let mut rgba = image.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let [r, g, b, a] = pixel.0;
        let gray = (0.299 * r as f32 + 0.587 * g as f32 + 0.114 * b as f32).round();
        let nr = mix_channel(r as f32, gray, amount);
        let ng = mix_channel(g as f32, gray, amount);
        let nb = mix_channel(b as f32, gray, amount);
        *pixel = Rgba([nr, ng, nb, a]);
    }
    DynamicImage::ImageRgba8(rgba)
}

fn apply_channel_mix_filter(image: DynamicImage, amount: f32, red_shift: f32, green_shift: f32, blue_shift: f32) -> DynamicImage {
    let mut rgba = image.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let [r, g, b, a] = pixel.0;
        let nr = shift_channel(r, red_shift, amount);
        let ng = shift_channel(g, green_shift, amount);
        let nb = shift_channel(b, blue_shift, amount);
        *pixel = Rgba([nr, ng, nb, a]);
    }
    DynamicImage::ImageRgba8(rgba)
}

fn apply_vintage_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_grayscale_filter(image, amount * 0.35);
    let image = apply_channel_mix_filter(image, amount, 24.0, 8.0, -18.0);
    apply_saturation(image, -amount * 0.2)
}

fn apply_sepia_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let mut rgba = image.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let [r, g, b, a] = pixel.0;
        let sr = (r as f32 * 0.393 + g as f32 * 0.769 + b as f32 * 0.189).clamp(0.0, 255.0);
        let sg = (r as f32 * 0.349 + g as f32 * 0.686 + b as f32 * 0.168).clamp(0.0, 255.0);
        let sb = (r as f32 * 0.272 + g as f32 * 0.534 + b as f32 * 0.131).clamp(0.0, 255.0);
        *pixel = Rgba([
            mix_channel(r as f32, sr, amount),
            mix_channel(g as f32, sg, amount),
            mix_channel(b as f32, sb, amount),
            a,
        ]);
    }
    DynamicImage::ImageRgba8(rgba)
}

fn apply_vivid_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_saturation(image, amount * 0.45);
    image.adjust_contrast(amount * 18.0)
}

fn apply_fade_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = image.brighten((amount * 14.0).round() as i32);
    let image = image.adjust_contrast(-(amount * 18.0));
    apply_saturation(image, -amount * 0.25)
}

fn apply_cinematic_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_channel_mix_filter(image, amount, 10.0, 4.0, -20.0);
    let image = image.adjust_contrast(amount * 14.0);
    apply_saturation(image, -amount * 0.08)
}

fn apply_noir_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_grayscale_filter(image, amount);
    image.adjust_contrast(amount * 30.0)
}

fn apply_polaroid_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_channel_mix_filter(image, amount, 12.0, 6.0, -8.0);
    let image = image.brighten((amount * 8.0).round() as i32);
    apply_saturation(image, -amount * 0.15)
}

fn apply_dreamy_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = image.brighten((amount * 12.0).round() as i32);
    let image = image.adjust_contrast(-(amount * 10.0));
    apply_channel_mix_filter(image, amount, 8.0, 4.0, 14.0)
}

fn apply_summer_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_channel_mix_filter(image, amount, 18.0, 12.0, -10.0);
    apply_saturation(image, amount * 0.2)
}

fn apply_forest_filter(image: DynamicImage, amount: f32) -> DynamicImage {
    let image = apply_channel_mix_filter(image, amount, -12.0, 16.0, 6.0);
    apply_saturation(image, -amount * 0.1)
}
