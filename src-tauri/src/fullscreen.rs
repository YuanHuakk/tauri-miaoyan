use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

struct SavedPlacement {
    style: i32,
    rect: (i32, i32, i32, i32),
}

pub struct FullscreenState(Mutex<Option<SavedPlacement>>);

pub fn init_fullscreen_state() -> FullscreenState {
    FullscreenState(Mutex::new(None))
}

#[tauri::command]
pub fn toggle_fullscreen(app: AppHandle, state: State<'_, FullscreenState>) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::*;
        use windows_sys::Win32::Foundation::RECT;
        use windows_sys::Win32::Graphics::Gdi::*;

        let window = app.get_webview_window("main").ok_or("No main window")?;
        let raw_hwnd = window.hwnd().map_err(|e| e.to_string())?.0;
        let hwnd = raw_hwnd as *mut std::ffi::c_void;

        let mut saved = state.0.lock().map_err(|e| e.to_string())?;

        unsafe {
            // Lock window redraws during style change to prevent flash
            SendMessageW(hwnd, WM_SETREDRAW, 0, 0);
        }

        let result = if saved.is_some() {
            let s = saved.take().unwrap();
            unsafe {
                SetWindowLongW(hwnd, GWL_STYLE, s.style);
                SetWindowPos(
                    hwnd, std::ptr::null_mut(),
                    s.rect.0, s.rect.1,
                    s.rect.2 - s.rect.0, s.rect.3 - s.rect.1,
                    SWP_FRAMECHANGED | SWP_NOZORDER,
                );
            }
            Ok(false)
        } else {
            let style = unsafe { GetWindowLongW(hwnd, GWL_STYLE) };
            let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
            unsafe { GetWindowRect(hwnd, &mut rect); }

            *saved = Some(SavedPlacement {
                style,
                rect: (rect.left, rect.top, rect.right, rect.bottom),
            });

            let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
            let mut mi = MONITORINFO {
                cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                rcMonitor: RECT { left: 0, top: 0, right: 0, bottom: 0 },
                rcWork: RECT { left: 0, top: 0, right: 0, bottom: 0 },
                dwFlags: 0,
            };
            unsafe { GetMonitorInfoW(monitor, &mut mi); }

            let new_style = style & !(WS_CAPTION as i32) & !(WS_THICKFRAME as i32);
            unsafe {
                SetWindowLongW(hwnd, GWL_STYLE, new_style);
                SetWindowPos(
                    hwnd, std::ptr::null_mut(),
                    mi.rcMonitor.left, mi.rcMonitor.top,
                    mi.rcMonitor.right - mi.rcMonitor.left,
                    mi.rcMonitor.bottom - mi.rcMonitor.top,
                    SWP_FRAMECHANGED | SWP_NOZORDER,
                );
            }
            Ok(true)
        };

        unsafe {
            // Re-enable redraws and force a full repaint
            SendMessageW(hwnd, WM_SETREDRAW, 1, 0);
            InvalidateRect(hwnd, std::ptr::null(), 1);
            UpdateWindow(hwnd);
        }

        result
    }

    #[cfg(not(target_os = "windows"))]
    {
        let window = app.get_webview_window("main").ok_or("No main window")?;
        let is_fs = window.is_fullscreen().map_err(|e| e.to_string())?;
        window.set_fullscreen(!is_fs).map_err(|e| e.to_string())?;
        Ok(!is_fs)
    }
}
