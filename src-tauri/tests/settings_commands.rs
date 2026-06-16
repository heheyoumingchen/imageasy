use std::fs;

use tempfile::tempdir;

use imageasy_lib::commands::settings::{
    load_settings_from_path, save_settings_to_path, ExportTaskSettings,
    PersistedSettings,
};

#[test]
fn load_settings_from_path_returns_defaults_when_file_is_missing() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("settings.json");

    let settings = load_settings_from_path(&path).unwrap();

    assert_eq!(settings.max_concurrency, 2);
    assert_eq!(settings.output_directory_strategy, "same-as-source");
    assert!(!settings.remember_last_params);
}

#[test]
fn save_settings_to_path_persists_and_loads_settings_json() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("nested").join("settings.json");
    let settings = PersistedSettings {
        theme: "dark".into(),
        language: "zh-CN".into(),
        max_concurrency: 5,
        output_directory_strategy: "custom".into(),
        default_output_directory: "F:/exports".into(),
        remember_last_params: true,
        export_settings: ExportTaskSettings {
            naming_pattern: "source-name-index".into(),
            output_format: "jpg".into(),
            color_mode: "rgb".into(),
            quality: 100,
        },
    };

    save_settings_to_path(&path, settings.clone()).unwrap();
    let loaded = load_settings_from_path(&path).unwrap();

    assert_eq!(loaded.max_concurrency, 5);
    assert_eq!(loaded.output_directory_strategy, "custom");
    assert_eq!(loaded.default_output_directory, "F:/exports");
    assert!(loaded.remember_last_params);
    assert!(fs::read_to_string(path).unwrap().contains("maxConcurrency"));
}

