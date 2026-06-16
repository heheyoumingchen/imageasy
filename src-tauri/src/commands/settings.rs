use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};

// 四个功能（转换 / 提取 / 分割 / 拼接）现已共享同一份导出设置。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExportTaskSettings {
    pub naming_pattern: String,
    pub output_format: String,
    pub color_mode: String,
    pub quality: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PersistedSettings {
    pub theme: String,
    pub language: String,
    pub max_concurrency: u8,
    pub output_directory_strategy: String,
    #[serde(default)]
    pub default_output_directory: String,
    pub remember_last_params: bool,
    #[serde(default = "default_export_task")]
    pub export_settings: ExportTaskSettings,
}

fn default_export_task() -> ExportTaskSettings {
    ExportTaskSettings {
        naming_pattern: "source-name-index".into(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: 100,
    }
}

fn default_settings() -> PersistedSettings {
    PersistedSettings {
        theme: "light".into(),
        language: "zh-CN".into(),
        max_concurrency: 2,
        output_directory_strategy: "same-as-source".into(),
        default_output_directory: String::new(),
        remember_last_params: false,
        export_settings: default_export_task(),
    }
}

// 旧版本设置文件以 conversion/extraction/splitting/stitching 四块分别持久化。
// 迁移时优先沿用 conversion 作为统一导出设置，避免老配置丢失。
fn migrate_legacy_settings(value: &mut serde_json::Value) {
    let Some(object) = value.as_object_mut() else {
        return;
    };
    if object.contains_key("exportSettings") {
        return;
    }
    if let Some(legacy) = object.get("conversion").cloned() {
        object.insert("exportSettings".into(), legacy);
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
    let mut value: serde_json::Value = serde_json::from_str(&raw)
        .with_context(|| format!("无法解析设置文件: {}", path.display()))?;
    migrate_legacy_settings(&mut value);
    let settings = serde_json::from_value(value)
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
