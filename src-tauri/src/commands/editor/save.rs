use anyhow::{Context, Result};
use image::{codecs::jpeg::JpegEncoder, DynamicImage};
use std::{fs, io::BufWriter, path::PathBuf};

use super::{apply_adjustments, AdjustmentParams, SaveImageAsJpgRequest, SaveImageAsJpgResult};

#[tauri::command]
pub fn save_image_as_jpg(request: SaveImageAsJpgRequest) -> Result<SaveImageAsJpgResult, String> {
    save_image_as_jpg_impl(request).map_err(|error| error.to_string())
}

fn save_image_as_jpg_impl(request: SaveImageAsJpgRequest) -> Result<SaveImageAsJpgResult> {
    let source_image = image::open(&request.source_path)
        .with_context(|| format!("无法打开图片: {}", request.source_path))?;
    let processed = process_full_image(source_image, &request.adjustments);

    let target_path = PathBuf::from(&request.target_path);
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("无法创建输出目录: {}", parent.display()))?;
    }

    let quality = request
        .quality
        .unwrap_or_else(|| request.adjustments.quality.clamp(1, 100) as u8);
    let file = fs::File::create(&target_path)
        .with_context(|| format!("无法创建输出文件: {}", target_path.display()))?;
    let mut writer = BufWriter::new(file);
    let mut encoder = JpegEncoder::new_with_quality(&mut writer, quality);
    encoder.encode_image(&processed)?;
    drop(writer);

    let metadata = fs::metadata(&target_path)
        .with_context(|| format!("无法读取输出文件信息: {}", target_path.display()))?;

    Ok(SaveImageAsJpgResult {
        saved_path: target_path.to_string_lossy().into_owned(),
        size_bytes: metadata.len(),
    })
}

fn process_full_image(source: DynamicImage, adjustments: &AdjustmentParams) -> DynamicImage {
    apply_adjustments(source, adjustments)
}
