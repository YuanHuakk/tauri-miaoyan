export type Category = "interface" | "experience" | "typography" | "ai";

export interface Settings {
  // Interface
  appearance: "system" | "light" | "dark";
  language: "zh" | "en" | "ja" | "zh-Hant";
  defaultViewMode: "edit" | "split";
  buttonShow: "always" | "hover";
  alwaysOnTop: boolean;
  activateShortcut: string;
  // Experience
  previewWidth: string;
  lineBreak: "miaoyan" | "github";
  previewLocation: "begin" | "editing";
  uploadService: "none" | "uPic" | "PicGo" | "Picsee" | "PicList";
  // Typography
  editorFont: string;
  fontSize: number;
  previewFont: string;
  previewFontSize: number;
  interfaceFont: string;
  codeFont: string;
  presentationFontSize: number;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: "system",
  language: "zh",
  defaultViewMode: "edit",
  buttonShow: "always",
  alwaysOnTop: false,
  activateShortcut: "",
  previewWidth: "1000px",
  lineBreak: "miaoyan",
  previewLocation: "begin",
  uploadService: "none",
  editorFont: "TsangerJinKai02-W04",
  fontSize: 16,
  previewFont: "TsangerJinKai02-W04",
  previewFontSize: 16,
  interfaceFont: "TsangerJinKai02-W04",
  codeFont: "Menlo",
  presentationFontSize: 24,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem("miaoyan_settings");
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  localStorage.setItem("miaoyan_settings", JSON.stringify(s));
}
