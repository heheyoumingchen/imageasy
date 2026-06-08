use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConversionTaskSettings {
    pub naming_pattern: String,
    pub output_format: String,
    pub color_mode: String,
    pub quality: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionTaskSettings {
    pub naming_pattern: String,
    pub output_format: String,
    pub color_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SplittingTaskSettings {
    pub naming_pattern: String,
    pub output_format: String,
    pub quality: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StitchingTaskSettings {
    pub naming_pattern: String,
    pub output_format: String,
    pub quality: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PersistedSettings {
    pub theme: String,
    pub language: String,
    pub max_concurrency: u8,
    pub output_directory_strategy: String,
    pub remember_last_params: bool,
    #[serde(default = "default_conversion_task")]
    pub conversion: ConversionTaskSettings,
    #[serde(default = "default_extraction_task")]
    pub extraction: ExtractionTaskSettings,
    #[serde(default = "default_splitting_task")]
    pub splitting: SplittingTaskSettings,
    #[serde(default = "default_stitching_task")]
    pub stitching: StitchingTaskSettings,
}

fn default_conversion_task() -> ConversionTaskSettings {
    ConversionTaskSettings {
        naming_pattern: "source-name-index".into(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
        quality: 100,
    }
}

fn default_extraction_task() -> ExtractionTaskSettings {
    ExtractionTaskSettings {
        naming_pattern: "source-name-index".into(),
        output_format: "jpg".into(),
        color_mode: "rgb".into(),
    }
}

fn default_splitting_task() -> SplittingTaskSettings {
    SplittingTaskSettings {
        naming_pattern: "source-name-index".into(),
        output_format: "png".into(),
        quality: 100,
    }
}

fn default_stitching_task() -> StitchingTaskSettings {
    StitchingTaskSettings {
        naming_pattern: "source-name-index".into(),
        output_format: "jpg".into(),
        quality: 100,
    }
}

fn default_settings() -> PersistedSettings {
    PersistedSettings {
        theme: "light".into(),
        language: "zh-CN".into(),
        max_concurrency: 2,
        output_directory_strategy: "same-as-source".into(),
        remember_last_params: false,
        conversion: default_conversion_task(),
        extraction: default_extraction_task(),
        splitting: default_splitting_task(),
        stitching: default_stitching_task(),
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
