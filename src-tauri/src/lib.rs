mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::editor::open_image_session,
            commands::editor::generate_image_preview,
            commands::editor::save_image_as_jpg,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
