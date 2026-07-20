use anyhow::{Context, Result};
use serde::Serialize;
use std::path::Path;
use std::process::Command;

use super::{editor, image_download, path_guard, stitching};
use crate::document_renderer::bridge_cache;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheUsageResult {
    pub download_thumbnail_bytes: u64,
    pub editor_working_bytes: u64,
    pub editor_thumbnail_bytes: u64,
    pub editor_preview_bytes: u64,
    pub stitching_thumbnail_bytes: u64,
    pub total_bytes: u64,
}

pub fn calculate_directory_size(path: &Path) -> Result<u64> {
    if !path.exists() {
        return Ok(0);
    }

    let mut total = 0;
    for entry in std::fs::read_dir(path).context("无法读取缓存目录")? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if metadata.is_dir() {
            total += calculate_directory_size(&entry.path())?;
        } else {
            total += metadata.len();
        }
    }
    Ok(total)
}

pub fn clear_directory_contents(path: &Path) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }

    for entry in std::fs::read_dir(path).context("无法读取缓存目录")? {
        let entry = entry?;
        let child = entry.path();
        if child.is_dir() {
            std::fs::remove_dir_all(&child).context("无法删除缓存目录")?;
        } else {
            std::fs::remove_file(&child).context("无法删除缓存文件")?;
        }
    }
    Ok(())
}

fn get_app_cache_usage_impl() -> Result<CacheUsageResult> {
    let download_thumbnail_bytes =
        calculate_directory_size(&image_download::download_thumbnail_cache_dir()?)?;
    let editor_working_bytes = calculate_directory_size(&editor::editor_working_cache_dir())?;
    let editor_thumbnail_bytes = calculate_directory_size(&editor::editor_thumbnail_cache_dir())?;
    let editor_preview_bytes = calculate_directory_size(&editor::editor_preview_cache_dir())?;
    let stitching_thumbnail_bytes =
        calculate_directory_size(&stitching::stitching_thumbnail_cache_dir())?;
    Ok(CacheUsageResult {
        download_thumbnail_bytes,
        editor_working_bytes,
        editor_thumbnail_bytes,
        editor_preview_bytes,
        stitching_thumbnail_bytes,
        total_bytes: download_thumbnail_bytes
            + editor_working_bytes
            + editor_thumbnail_bytes
            + editor_preview_bytes
            + stitching_thumbnail_bytes,
    })
}

fn clear_app_cache_impl() -> Result<CacheUsageResult> {
    clear_directory_contents(&image_download::download_thumbnail_cache_dir()?)?;
    clear_directory_contents(&editor::editor_working_cache_dir())?;
    clear_directory_contents(&editor::editor_thumbnail_cache_dir())?;
    clear_directory_contents(&editor::editor_preview_cache_dir())?;
    clear_directory_contents(&stitching::stitching_thumbnail_cache_dir())?;
    // 进程内 Office→PDF 桥接缓存一并丢弃，避免设置页“清理缓存”后仍命中陈旧桥接。
    bridge_cache::clear_bridge_cache();
    get_app_cache_usage_impl()
}

#[tauri::command]
pub fn get_app_cache_usage() -> Result<CacheUsageResult, String> {
    get_app_cache_usage_impl().map_err(crate::commands::error_message::to_user_error_string)
}

#[tauri::command]
pub fn clear_app_cache() -> Result<CacheUsageResult, String> {
    clear_app_cache_impl().map_err(crate::commands::error_message::to_user_error_string)
}

#[tauri::command]
pub fn open_directory_in_system(path: String) -> Result<(), String> {
    let directory = path_guard::require_existing_dir(Path::new(path.trim()))
        .map_err(crate::commands::error_message::to_user_error_string)?;

    #[cfg(target_os = "windows")]
    {
        let normalized = directory.to_string_lossy().replace('/', "\\");
        Command::new("explorer")
            .arg(normalized)
            .spawn()
            .map_err(crate::commands::error_message::to_user_error_string)?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&directory)
            .spawn()
            .map_err(crate::commands::error_message::to_user_error_string)?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&directory)
            .spawn()
            .map_err(crate::commands::error_message::to_user_error_string)?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("当前平台暂不支持打开目录".to_string())
}
