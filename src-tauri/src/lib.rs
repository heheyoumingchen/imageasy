pub mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::editor::open_image_session,
            commands::editor::generate_image_preview,
            commands::editor::save_image_as_jpg,
            commands::conversion::inspect_conversion_file,
            commands::conversion::inspect_conversion_directory,
            commands::conversion::convert_image_file,
            commands::conversion::render_document_to_images,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
