use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use base64::Engine;
use pulldown_cmark::{Parser, Options, html};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
    pub children: Option<Vec<TreeNode>>,
    #[serde(rename = "modifiedAt")]
    pub modified_at: Option<u64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteContent {
    pub path: String,
    pub content: String,
    pub title: String,
    #[serde(rename = "modifiedAt")]
    pub modified_at: Option<u64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<u64>,
}

const ALLOWED_EXTENSIONS: &[&str] = &["md", "markdown", "txt"];
const SKIP_DIRS: &[&str] = &[
    ".git",
    ".cache",
    "i",
    "files",
    "images",
    "node_modules",
    ".Trash",
    "Trash",
];

fn system_time_to_millis(time: SystemTime) -> Option<u64> {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_millis() as u64)
}

fn get_file_times(path: &Path) -> (Option<u64>, Option<u64>) {
    if let Ok(meta) = fs::metadata(path) {
        let modified = meta.modified().ok().and_then(system_time_to_millis);
        let created = meta.created().ok().and_then(system_time_to_millis);
        (modified, created)
    } else {
        (None, None)
    }
}

fn is_allowed_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| ALLOWED_EXTENSIONS.contains(&e))
        .unwrap_or(false)
}

fn build_tree(dir: &Path) -> Vec<TreeNode> {
    let mut dirs: Vec<TreeNode> = Vec::new();
    let mut files: Vec<TreeNode> = Vec::new();

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            if SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            let children = build_tree(&path);
            let (modified_at, created_at) = get_file_times(&path);
            dirs.push(TreeNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
                children: Some(children),
                modified_at,
                created_at,
            });
        } else if is_allowed_file(&path) {
            let (modified_at, created_at) = get_file_times(&path);
            files.push(TreeNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
                modified_at,
                created_at,
            });
        }
    }

    // Sort: dirs alphabetically, files by modified time desc
    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    dirs.extend(files);
    dirs
}

fn title_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

// --- Tauri Commands ---

#[tauri::command]
pub fn list_directory_tree(root: String) -> Result<Vec<TreeNode>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a directory: {}", root));
    }
    Ok(build_tree(&root_path))
}

#[tauri::command]
pub fn get_note_content(path: String) -> Result<NoteContent, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.is_file() {
        return Err(format!("File not found: {}", path));
    }
    let content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read {}: {}", path, e))?;
    let (modified_at, created_at) = get_file_times(&file_path);
    Ok(NoteContent {
        path,
        content,
        title: title_from_path(&file_path),
        modified_at,
        created_at,
    })
}

#[tauri::command]
pub fn save_note(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| format!("Failed to save {}: {}", path, e))
}

#[tauri::command]
pub fn create_note(dir: String, filename: String, initial_content: Option<String>) -> Result<NoteContent, String> {
    let dir_path = PathBuf::from(&dir);
    if !dir_path.is_dir() {
        return Err(format!("Directory not found: {}", dir));
    }

    let name = if filename.is_empty() {
        "Untitled.md".to_string()
    } else if !filename.contains('.') {
        format!("{}.md", filename)
    } else {
        filename
    };

    let mut file_path = dir_path.join(&name);

    // Deduplicate filename
    let mut counter = 1u32;
    while file_path.exists() {
        let stem = PathBuf::from(&name)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let ext = PathBuf::from(&name)
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        file_path = dir_path.join(format!("{} {}.{}", stem, counter, ext));
        counter += 1;
    }

    let content = initial_content.unwrap_or_default();
    fs::write(&file_path, &content).map_err(|e| format!("Failed to create note: {}", e))?;

    let (modified_at, created_at) = get_file_times(&file_path);
    Ok(NoteContent {
        path: file_path.to_string_lossy().to_string(),
        content,
        title: title_from_path(&file_path),
        modified_at,
        created_at,
    })
}

#[tauri::command]
pub fn delete_note(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }
    if file_path.is_dir() {
        fs::remove_dir_all(&file_path).map_err(|e| format!("Failed to delete dir {}: {}", path, e))
    } else {
        fs::remove_file(&file_path).map_err(|e| format!("Failed to delete {}: {}", path, e))
    }
}

#[tauri::command]
pub fn create_folder(parent: String, name: String) -> Result<String, String> {
    let parent_path = PathBuf::from(&parent);
    if !parent_path.is_dir() {
        return Err(format!("Parent not found: {}", parent));
    }
    let folder_name = if name.is_empty() { "新建文件夹".to_string() } else { name };
    let mut folder_path = parent_path.join(&folder_name);

    let mut counter = 1u32;
    while folder_path.exists() {
        folder_path = parent_path.join(format!("{} {}", folder_name, counter));
        counter += 1;
    }

    fs::create_dir(&folder_path).map_err(|e| format!("Failed to create folder: {}", e))?;
    Ok(folder_path.to_string_lossy().to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub title: String,
    #[serde(rename = "matchLine")]
    pub match_line: String,
    #[serde(rename = "lineNumber")]
    pub line_number: usize,
}

fn search_in_dir(dir: &Path, query: &str, results: &mut Vec<SearchResult>, limit: usize) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if results.len() >= limit { return; }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') { continue; }
        if path.is_dir() {
            if SKIP_DIRS.contains(&name.as_str()) { continue; }
            search_in_dir(&path, query, results, limit);
        } else if is_allowed_file(&path) {
            if let Ok(content) = fs::read_to_string(&path) {
                let query_lower = query.to_lowercase();
                // Title match
                let title = title_from_path(&path);
                if title.to_lowercase().contains(&query_lower) {
                    let first_line = content.lines().next().unwrap_or("").to_string();
                    results.push(SearchResult {
                        path: path.to_string_lossy().to_string(),
                        title,
                        match_line: first_line,
                        line_number: 1,
                    });
                    if results.len() >= limit { return; }
                    continue;
                }
                // Content match
                for (i, line) in content.lines().enumerate() {
                    if line.to_lowercase().contains(&query_lower) {
                        results.push(SearchResult {
                            path: path.to_string_lossy().to_string(),
                            title: title_from_path(&path),
                            match_line: line.chars().take(120).collect(),
                            line_number: i + 1,
                        });
                        if results.len() >= limit { return; }
                        break; // One match per file
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub fn search_notes(root: String, query: String) -> Result<Vec<SearchResult>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a directory: {}", root));
    }
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let mut results = Vec::new();
    search_in_dir(&root_path, query.trim(), &mut results, 50);
    Ok(results)
}

#[tauri::command]
pub fn rename_note(old_path: String, new_name: String) -> Result<String, String> {
    let old = PathBuf::from(&old_path);
    if !old.exists() {
        return Err(format!("File not found: {}", old_path));
    }
    let parent = old.parent().ok_or("Cannot get parent directory")?;
    let new_path = parent.join(&new_name);
    if new_path.exists() {
        return Err(format!("Target already exists: {}", new_path.display()));
    }
    fs::rename(&old, &new_path).map_err(|e| format!("Failed to rename: {}", e))?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_image(note_path: String, data: String, filename: String) -> Result<String, String> {
    let note = PathBuf::from(&note_path);
    let parent = note.parent().ok_or("Cannot get parent directory")?;
    let images_dir = parent.join("images");
    if !images_dir.exists() {
        fs::create_dir_all(&images_dir).map_err(|e| format!("Failed to create images dir: {}", e))?;
    }

    // Deduplicate filename
    let mut target = images_dir.join(&filename);
    let mut counter = 1u32;
    let stem = PathBuf::from(&filename).file_stem().unwrap_or_default().to_string_lossy().to_string();
    let ext = PathBuf::from(&filename).extension().unwrap_or_default().to_string_lossy().to_string();
    while target.exists() {
        target = images_dir.join(format!("{}_{}.{}", stem, counter, ext));
        counter += 1;
    }

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("Invalid base64: {}", e))?;
    fs::write(&target, &bytes).map_err(|e| format!("Failed to write image: {}", e))?;

    // Return relative path for markdown
    let rel = format!("images/{}", target.file_name().unwrap().to_string_lossy());
    Ok(rel)
}

#[tauri::command]
pub fn export_html(content: String, dest: String) -> Result<(), String> {
    // Convert markdown to HTML using pulldown-cmark
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    opts.insert(Options::ENABLE_TASKLISTS);
    let parser = Parser::new_ext(&content, opts);
    let mut body_html = String::new();
    html::push_html(&mut body_html, parser);

    let full_html = format!(
        r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>导出笔记</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.8; color: #1d1d1f; }}
h1 {{ font-size: 1.75rem; font-weight: 700; }}
h2 {{ font-size: 1.375rem; font-weight: 600; }}
h3 {{ font-size: 1.125rem; font-weight: 600; }}
code {{ background: rgba(0,0,0,0.04); padding: 0.125rem 0.375rem; border-radius: 3px; font-size: 0.875em; }}
pre {{ background: #f7f7f8; border: 1px solid #e5e5e5; border-radius: 6px; padding: 14px 16px; overflow-x: auto; }}
pre code {{ background: none; padding: 0; }}
blockquote {{ border-left: 3px solid #007aff; padding-left: 14px; color: #6e6e73; }}
a {{ color: #007aff; text-decoration: none; }}
img {{ max-width: 100%; border-radius: 6px; }}
table {{ border-collapse: collapse; width: 100%; }}
th, td {{ border: 1px solid #e5e5e5; padding: 6px 12px; text-align: left; }}
th {{ background: #f7f7f8; font-weight: 600; }}
</style>
</head>
<body>
{body}
</body>
</html>"#,
        body = body_html
    );
    fs::write(&dest, full_html).map_err(|e| format!("Failed to export: {}", e))
}


/// Upload image to cloud service. Returns the remote URL on success.
/// Supports PicGo/PicList (HTTP API) and uPic/Picsee (CLI on macOS).
/// On success, deletes the local temporary image file.
#[tauri::command]
pub async fn upload_image(image_path: String, service: String) -> Result<String, String> {
    let result = match service.as_str() {
        "PicGo" | "PicList" => upload_via_picgo(&image_path).await,
        "uPic" => upload_via_shell("uPic", &image_path),
        "Picsee" => upload_via_shell("Picsee", &image_path),
        _ => Err(format!("Unknown upload service: {}", service)),
    };
    // Delete local file on successful upload (matches original MiaoYan behavior)
    if result.is_ok() {
        let _ = fs::remove_file(&image_path);
    }
    result
}

async fn upload_via_picgo(image_path: &str) -> Result<String, String> {
    let body = serde_json::json!({ "list": [image_path] });
    let resp = ureq::post("http://127.0.0.1:36677/upload")
        .send_json(&body)
        .map_err(|e| format!("PicGo request failed: {}", e))?;

    let json: serde_json::Value = resp
        .into_json()
        .map_err(|e| format!("PicGo response parse failed: {}", e))?;

    if json["success"].as_bool() == Some(true) {
        if let Some(url) = json["result"].as_array().and_then(|a| a.first()).and_then(|v| v.as_str()) {
            return Ok(url.to_string());
        }
    }
    Err(format!("PicGo upload failed: {}", json))
}

fn upload_via_shell(app_name: &str, image_path: &str) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        // Call the app's CLI directly: /Applications/{app}.app/Contents/MacOS/{app} -o url -u {path}
        let executable = format!("/Applications/{}.app/Contents/MacOS/{}", app_name, app_name);
        let output = std::process::Command::new(&executable)
            .args(["-o", "url", "-u", image_path])
            .env("PATH", "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin")
            .output()
            .map_err(|e| format!("Failed to run {}: {}", app_name, e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
                return Ok(trimmed.to_string());
            }
        }
        Err(format!("{} upload returned no URL. stdout: {}, stderr: {}",
            app_name, stdout, String::from_utf8_lossy(&output.stderr)))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = image_path;
        Err(format!("{} is only supported on macOS", app_name))
    }
}

#[tauri::command]
pub fn init_default_notes() -> Result<String, String> {
    let doc_dir = dirs::document_dir()
        .ok_or_else(|| "Cannot locate system Documents directory".to_string())?;
    let miaoyan_dir = doc_dir.join("MiaoYan");
    if !miaoyan_dir.exists() {
        fs::create_dir_all(&miaoyan_dir)
            .map_err(|e| format!("Failed to create MiaoYan dir: {}", e))?;
    }

    let files: &[(&str, &str)] = &[
        ("欢迎使用.md", include_str!("../../public/Initial/欢迎使用.md")),
        ("介绍妙言.md", include_str!("../../public/Initial/介绍妙言.md")),
        ("妙言 Markdown 语法指南.md", include_str!("../../public/Initial/妙言 Markdown 语法指南.md")),
        ("妙言 PPT.md", include_str!("../../public/Initial/妙言 PPT.md")),
        ("头脑风暴.md", include_str!("../../public/Initial/头脑风暴.md")),
        ("Brainstorming.md", include_str!("../../public/Initial/Brainstorming.md")),
        ("Introduction to MiaoYan.md", include_str!("../../public/Initial/Introduction to MiaoYan.md")),
        ("MiaoYan Markdown Syntax Guide.md", include_str!("../../public/Initial/MiaoYan Markdown Syntax Guide.md")),
        ("MiaoYan PPT.md", include_str!("../../public/Initial/MiaoYan PPT.md")),
        ("Welcome.md", include_str!("../../public/Initial/Welcome.md")),
    ];

    for (name, content) in files {
        let dest = miaoyan_dir.join(name);
        if !dest.exists() {
            fs::write(&dest, content)
                .map_err(|e| format!("Failed to write {}: {}", name, e))?;
        }
    }

    Ok(miaoyan_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn check_path_type(path: String) -> String {
    let p = std::path::Path::new(&path);
    if p.is_dir() {
        "dir".to_string()
    } else if p.is_file() {
        "file".to_string()
    } else {
        "none".to_string()
    }
}

#[tauri::command]
pub fn save_image_from_path(note_path: String, source_path: String) -> Result<String, String> {
    let note = PathBuf::from(&note_path);
    let parent = note.parent().ok_or("Cannot get parent directory")?;
    let images_dir = parent.join("images");
    if !images_dir.exists() {
        fs::create_dir_all(&images_dir).map_err(|e| format!("Failed to create images dir: {}", e))?;
    }

    let src = PathBuf::from(&source_path);
    let original_name = src.file_name().ok_or("No filename")?.to_string_lossy().to_string();
    let stem = src.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let ext = src.extension().unwrap_or_default().to_string_lossy().to_string();

    let mut target = images_dir.join(&original_name);
    let mut counter = 1u32;
    while target.exists() {
        target = images_dir.join(format!("{}_{}.{}", stem, counter, ext));
        counter += 1;
    }

    fs::copy(&src, &target).map_err(|e| format!("Failed to copy image: {}", e))?;
    let rel = format!("images/{}", target.file_name().unwrap().to_string_lossy());
    Ok(rel)
}
