use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Emitter;

// --- AI config persistence ---

const CONFIG_FILE: &str = "miaoyan_ai.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub api_key: String,
    pub api_url: String,
    pub model: String,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            api_url: "https://api.openai.com/v1/chat/completions".into(),
            model: "gpt-4o-mini".into(),
        }
    }
}

fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("miaoyan")
        .join(CONFIG_FILE)
}

#[tauri::command]
pub fn load_ai_config() -> AiConfig {
    let path = config_path();
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => AiConfig::default(),
    }
}

#[tauri::command]
pub fn save_ai_config(config: AiConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create config dir: {e}"))?;
    }
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write config: {e}"))?;
    Ok(())
}

// --- Streaming AI completion ---

#[derive(Debug, Clone, Serialize)]
pub struct AiStreamChunk {
    pub content: String,
    pub done: bool,
}

/// System prompts for different AI actions
fn system_prompt(action: &str) -> &'static str {
    match action {
        "continue" => "You are a writing assistant. Continue the user's text naturally, maintaining the same style, tone, and language. Output only the continuation, no explanations.",
        "rewrite" => "You are a writing assistant. Rewrite the user's text to improve clarity and readability while preserving the original meaning and language. Output only the rewritten text.",
        "polish" => "You are a writing assistant. Polish the user's text by fixing grammar, improving word choice, and enhancing flow. Keep the same language. Output only the polished text.",
        "summarize" => "You are a writing assistant. Summarize the user's text concisely, capturing the key points. Keep the same language as the input. Output only the summary.",
        _ => "You are a helpful writing assistant.",
    }
}

#[tauri::command]
pub async fn ai_complete(
    app: tauri::AppHandle,
    action: String,
    text: String,
) -> Result<(), String> {
    let config = load_ai_config();
    if config.api_key.is_empty() {
        return Err("AI API Key not configured".into());
    }

    let sys = system_prompt(&action);

    let body = serde_json::json!({
        "model": config.model,
        "messages": [
            { "role": "system", "content": sys },
            { "role": "user", "content": text }
        ],
        "stream": true
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&config.api_url)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("API error {status}: {body_text}"));
    }

    // Read SSE stream line by line
    use futures_util::StreamExt;
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete SSE lines
        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if data.trim() == "[DONE]" {
                    let _ = app.emit("ai-stream", AiStreamChunk {
                        content: String::new(),
                        done: true,
                    });
                    return Ok(());
                }

                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) = parsed["choices"][0]["delta"]["content"].as_str() {
                        let _ = app.emit("ai-stream", AiStreamChunk {
                            content: content.to_string(),
                            done: false,
                        });
                    }
                }
            }
        }
    }

    // Stream ended without [DONE]
    let _ = app.emit("ai-stream", AiStreamChunk {
        content: String::new(),
        done: true,
    });
    Ok(())
}
