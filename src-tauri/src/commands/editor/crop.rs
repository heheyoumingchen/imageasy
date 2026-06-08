use anyhow::{Context, Result};
use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use super::{
    apply_crop, apply_rotation, editor_working_cache_dir, is_supported_image, read_image_summary,
    write_jpeg_image, CommitCropRequest, CommitCropResult,
};

static WORKING_IMAGE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
pub fn commit_crop_to_working_image(request: CommitCropRequest) -> Result<CommitCropResult, String> {
    commit_crop_to_working_image_impl(request).map_err(|error| error.to_string())
}

fn commit_crop_to_working_image_impl(request: CommitCropRequest) -> Result<CommitCropResult> {
    let source_path = PathBuf::from(&request.source_path);
    let source_path = source_path
        .canonicalize()
        .with_context(|| format!("无法访问文件: {}", request.source_path))?;

    if !is_supported_image(&source_path) {
        anyhow::bail!("不支持的图片格式");
    }

    let source_image = image::open(&source_path)
        .with_context(|| format!("无法打开图片: {}", source_path.display()))?;

    let rotated = apply_rotation(source_image, request.rotation);
    let cropped = apply_crop(rotated, Some(&request.crop));

    let working_path = create_editor_working_path(&source_path)?;
    write_jpeg_image(&working_path, &cropped, 92)?;

    Ok(CommitCropResult {
        working_image: read_image_summary(&working_path)?,
    })
}

fn create_editor_working_path(source_path: &std::path::Path) -> Result<PathBuf> {
    let editor_work_dir = editor_working_cache_dir();
    fs::create_dir_all(&editor_work_dir)
        .with_context(|| format!("无法创建编辑工作目录: {}", editor_work_dir.display()))?;

    let stem = source_path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("working-image");
    let timestamp = chrono::Local::now().format("%Y%m%d%H%M%S%3f").to_string();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let pid = std::process::id();
    let counter = WORKING_IMAGE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let file_name = format!("{stem}__crop_{timestamp}_{nanos}_{pid}_{counter}.jpg");

    Ok(editor_work_dir.join(file_name))
}
