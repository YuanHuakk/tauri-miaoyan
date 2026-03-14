mod ai;
mod notes;
mod watcher;
mod fullscreen;

use ai::{ai_complete, load_ai_config, save_ai_config};
use notes::{
    check_path_type, create_folder, create_note, delete_note, export_html, get_note_content,
    init_default_notes, list_directory_tree, rename_note, save_image, save_image_from_path,
    save_note, search_notes, upload_image,
};
use watcher::watch_directory;
use fullscreen::toggle_fullscreen;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(watcher::init_watcher_state())
        .manage(fullscreen::init_fullscreen_state())
        .invoke_handler(tauri::generate_handler![
            list_directory_tree,
            get_note_content,
            save_note,
            create_note,
            delete_note,
            rename_note,
            create_folder,
            search_notes,
            save_image,
            upload_image,
            export_html,
            watch_directory,
            toggle_fullscreen,
            init_default_notes,
            check_path_type,
            save_image_from_path,
            load_ai_config,
            save_ai_config,
            ai_complete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
