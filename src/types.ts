export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
  modifiedAt?: number;
  createdAt?: number;
}

export interface NoteContent {
  path: string;
  content: string;
  title: string;
  modifiedAt?: number;
  createdAt?: number;
}

export interface SearchResult {
  path: string;
  title: string;
  matchLine: string;
  lineNumber: number;
}

export interface AiConfig {
  api_key: string;
  api_url: string;
  model: string;
}

export type AiAction = "continue" | "rewrite" | "polish" | "summarize";
