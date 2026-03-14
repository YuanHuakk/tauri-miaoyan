import { invoke } from "@tauri-apps/api/core";
import type { TreeNode, NoteContent, AiConfig } from "./types";

export async function listDirectoryTree(root: string): Promise<TreeNode[]> {
  return invoke("list_directory_tree", { root });
}

export async function getNoteContent(path: string): Promise<NoteContent> {
  return invoke("get_note_content", { path });
}

export async function saveNote(path: string, content: string): Promise<void> {
  return invoke("save_note", { path, content });
}

export async function createNote(dir: string, filename: string, initialContent?: string): Promise<NoteContent> {
  return invoke("create_note", { dir, filename, initialContent: initialContent ?? null });
}

export async function deleteNote(path: string): Promise<void> {
  return invoke("delete_note", { path });
}

export async function renameNote(oldPath: string, newName: string): Promise<string> {
  return invoke("rename_note", { oldPath, newName });
}

export async function createFolder(parent: string, name: string): Promise<string> {
  return invoke("create_folder", { parent, name });
}

export async function searchNotes(root: string, query: string): Promise<import("./types").SearchResult[]> {
  return invoke("search_notes", { root, query });
}

export async function saveImage(notePath: string, data: string, filename: string): Promise<string> {
  return invoke("save_image", { notePath, data, filename });
}

export async function exportHtml(content: string, dest: string): Promise<void> {
  return invoke("export_html", { content, dest });
}

export async function watchDirectory(root: string): Promise<void> {
  return invoke("watch_directory", { root });
}

export async function uploadImage(imagePath: string, service: string): Promise<string> {
  return invoke("upload_image", { imagePath, service });
}

export async function initDefaultNotes(): Promise<string> {
  return invoke("init_default_notes");
}

export async function checkPathType(path: string): Promise<string> {
  return invoke("check_path_type", { path });
}

export async function saveImageFromPath(notePath: string, sourcePath: string): Promise<string> {
  return invoke("save_image_from_path", { notePath, sourcePath });
}

// --- AI ---

export async function loadAiConfig(): Promise<AiConfig> {
  return invoke("load_ai_config");
}

export async function saveAiConfig(config: AiConfig): Promise<void> {
  return invoke("save_ai_config", { config });
}

export async function aiComplete(action: string, text: string): Promise<void> {
  return invoke("ai_complete", { action, text });
}
