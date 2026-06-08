use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PersistedSettings {
    pub theme: String,
    pub language: String,
    pub max_concurrency: u8,
    pub output_directory_strategy: String,
    pub remember_last_params: bool,
}

fn default_settings() -> PersistedSettings {
    PersistedSettings {
        theme: "light".into(),
        language: "zh-CN".into(),
        max_concurrency: 2,
        output_directory_strategy: "same-as-source".into(),
        remember_last_params: false,
    }
}

fn settings_path() -> Result<PathBuf> {
    if let Some(data_dir) = crate::portable::portable_data_dir() {
        Ok(data_dir.join("settings.json"))
    } else {
        let mut path = std::env::current_dir().context("无法定位应用目录")?;
        path.push("settings.json");
        Ok(path)
    }
}

#[tauri::command]
pub fn load_settings() -> Result<PersistedSettings, String> {
    load_settings_from_path(&settings_path().map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_settings(settings: PersistedSettings) -> Result<PersistedSettings, String> {
    save_settings_to_path(&settings_path().map_err(|error| error.to_string())?, settings)
        .map_err(|error| error.to_string())
}

pub fn load_settings_from_path(path: &Path) -> Result<PersistedSettings> {
    if !path.exists() {
        return Ok(default_settings());
    }

    let raw = fs::read_to_string(path)
        .with_context(|| format!("无法读取设置文件: {}", path.display()))?;
    let settings = serde_json::from_str(&raw)
        .with_context(|| format!("无法解析设置文件: {}", path.display()))?;

    Ok(settings)
}

pub fn save_settings_to_path(path: &Path, settings: PersistedSettings) -> Result<PersistedSettings> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("无法创建设置目录: {}", parent.display()))?;
    }

    let raw = serde_json::to_string_pretty(&settings)?;
    fs::write(path, raw)
        .with_context(|| format!("无法写入设置文件: {}", path.display()))?;

    Ok(settings)
}
