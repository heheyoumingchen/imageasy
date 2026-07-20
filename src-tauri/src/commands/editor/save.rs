use anyhow::{Context, Result};
use image::{codecs::jpeg::JpegEncoder, DynamicImage};
use std::{fs, io::BufWriter};

use crate::commands::path_guard::{ensure_output_file_path, require_existing_file};

use super::{apply_adjustments, AdjustmentParams, SaveImageAsJpgRequest, SaveImageAsJpgResult};

#[tauri::command]
pub fn save_image_as_jpg(request: SaveImageAsJpgRequest) -> Result<SaveImageAsJpgResult, String> {
    save_image_as_jpg_impl(request).map_err(crate::commands::error_message::to_user_error_string)
}

fn save_image_as_jpg_impl(request: SaveImageAsJpgRequest) -> Result<SaveImageAsJpgResult> {
    let source_path = require_existing_file(std::path::Path::new(&request.source_path))?;
    let source_image = image::open(&source_path)
        .with_context(|| format!("无法打开图片: {}", source_path.display()))?;
    let processed = process_full_image(source_image, &request.adjustments);

    let target_path = ensure_output_file_path(std::path::Path::new(&request.target_path))?;

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
