use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// Global watcher handle — kept alive so the watcher thread doesn't drop.
pub struct WatcherState {
    _debouncer: Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>,
}

#[tauri::command]
pub fn watch_directory(app: AppHandle, root: String) -> Result<(), String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a directory: {}", root));
    }

    let app_handle = app.clone();
    let mut debouncer = new_debouncer(Duration::from_millis(500), move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
        match res {
            Ok(events) => {
                let changed = events
                    .iter()
                    .any(|e| e.kind == DebouncedEventKind::Any);
                if changed {
                    let _ = app_handle.emit("fs-changed", ());
                }
            }
            Err(e) => eprintln!("Watcher error: {:?}", e),
        }
    })
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    debouncer
        .watcher()
        .watch(&root_path, notify::RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch {}: {}", root, e))?;

    // Store in app state so it stays alive
    let state = app.state::<Mutex<WatcherState>>();
    let mut guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    guard._debouncer = Some(debouncer);

    Ok(())
}

/// Register the watcher state in the Tauri app builder.
pub fn init_watcher_state() -> Mutex<WatcherState> {
    Mutex::new(WatcherState { _debouncer: None })
}
