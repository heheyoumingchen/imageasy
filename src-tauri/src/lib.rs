pub mod commands;
pub mod portable;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::editor::open_image_session,
            commands::editor::filters::generate_image_preview,
            commands::editor::save::save_image_as_jpg,
            commands::editor::crop::commit_crop_to_working_image,
            commands::conversion::inspect_conversion_file,
            commands::conversion::inspect_conversion_directory,
            commands::conversion::convert_image_file,
            commands::conversion::render_document_to_images,
            commands::extraction::inspect_extraction_document,
            commands::extraction::inspect_extraction_directory,
            commands::extraction::extract_document_images,
            commands::splitting::inspect_splitting_file,
            commands::splitting::inspect_splitting_directory,
            commands::splitting::split_image_file,
            commands::stitching::inspect_stitching_file,
            commands::stitching::inspect_stitching_directory,
            commands::stitching::stitch_image_files,
            commands::image_download::inspect_download_source,
            commands::image_download::save_download_images,
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::system::get_app_cache_usage,
            commands::system::clear_app_cache,
            commands::system::open_directory_in_system,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
