import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "../i18n";
import * as api from "../api";
import type { AiConfig } from "../types";
import type { Settings, Category } from "../utils/settings";

interface SettingsPanelProps {
  visible: boolean;
  settings: Settings;
  rootPath: string;
  onClose: () => void;
  onChange: (settings: Settings) => void;
  onChangeRoot: () => void;
}

const FONT_OPTIONS = [
  "TsangerJinKai02-W04",
  "PingFang SC",
  "Microsoft YaHei",
  "Helvetica Neue",
  "Arial",
  "system-ui",
];

const CODE_FONT_OPTIONS = [
  "Menlo",
  "SF Mono",
  "JetBrains Mono",
  "Fira Code",
  "Consolas",
  "monospace",
];

const WIDTH_OPTIONS = ["600px", "800px", "1000px", "1200px", "1400px", "Full Width"];

const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28];

const IS_MACOS = navigator.platform.toUpperCase().includes("MAC");
const UPLOAD_SERVICES = IS_MACOS
  ? ["uPic", "PicGo", "Picsee", "PicList"]
  : ["PicGo", "PicList"];

export default function SettingsPanel({ visible, settings, rootPath, onClose, onChange, onChangeRoot }: SettingsPanelProps) {
  const { t } = useI18n();
  const [category, setCategory] = useState<Category>("interface");
  const [aiConfig, setAiConfig] = useState<AiConfig>({ api_key: "", api_url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" });

  useEffect(() => {
    api.loadAiConfig().then(setAiConfig).catch(console.error);
  }, []);

  const aiDirtyRef = useRef(false);
  const aiSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushAiConfig = useCallback((config: AiConfig) => {
    if (aiSaveTimerRef.current) clearTimeout(aiSaveTimerRef.current);
    aiDirtyRef.current = false;
    api.saveAiConfig(config).catch(console.error);
  }, []);

  const updateAiConfig = (patch: Partial<AiConfig>) => {
    const next = { ...aiConfig, ...patch };
    setAiConfig(next);
    aiDirtyRef.current = true;
    if (aiSaveTimerRef.current) clearTimeout(aiSaveTimerRef.current);
    aiSaveTimerRef.current = setTimeout(() => flushAiConfig(next), 800);
  };

  // Save on unmount or when panel closes
  useEffect(() => {
    return () => {
      if (aiSaveTimerRef.current) clearTimeout(aiSaveTimerRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (aiDirtyRef.current) {
      flushAiConfig(aiConfig);
    }
    onClose();
  }, [aiConfig, flushAiConfig, onClose]);

  if (!visible) return null;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value };
    onChange(next);
  };

  const categories: { key: Category; label: string; icon: React.ReactNode }[] = [
    {
      key: "interface",
      label: t("settings.interface"),
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" />
        </svg>
      ),
    },
    {
      key: "experience",
      label: t("settings.experience"),
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
    },
    {
      key: "typography",
      label: t("settings.typography"),
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      ),
    },
    {
      key: "ai" as Category,
      label: t("settings.ai"),
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 2a4 4 0 014 4v1h1a3 3 0 013 3v1a3 3 0 01-3 3h-1v4a4 4 0 01-8 0v-4H7a3 3 0 01-3-3v-1a3 3 0 013-3h1V6a4 4 0 014-4z" /><circle cx="10" cy="10" r="1" /><circle cx="14" cy="10" r="1" />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="settings-dialog relative rounded-xl shadow-2xl flex overflow-hidden animate-dialog-in"
        style={{ width: 620, height: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="settings-sidebar w-[160px] shrink-0 p-3 pt-5 flex flex-col gap-1">
          <div className="text-[11px] text-text-3 uppercase tracking-wider px-2 mb-2">{t("settings.title")}</div>
          {categories.map((c) => (
            <button
              key={c.key}
              className={`flex items-center gap-2 px-3 py-[6px] rounded-lg text-[13px] cursor-pointer transition-colors ${
                category === c.key
                  ? "settings-cat-active font-medium"
                  : "text-text-2 hover:bg-white/5"
              }`}
              onClick={() => setCategory(c.key)}
            >
              {c.icon}
              {c.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="settings-content flex-1 px-6 pb-6 pt-12 overflow-y-auto">
          {/* Close button */}
          <button
            className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-text-2 hover:text-text-1 hover:bg-white/20 cursor-pointer transition-colors"
            onClick={handleClose}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          {category === "interface" && (
            <div className="flex flex-col gap-5">
              <SettingRow label={t("settings.noteLocation")}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[12px] text-text-2 truncate max-w-[200px]" data-tip={rootPath}>{rootPath.replace(/\\/g, "/")}</span>
                  <button
                    className="shrink-0 px-2 py-[4px] text-[11px] rounded-md bg-accent text-white cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={onChangeRoot}
                  >
                    {t("settings.changeFolder")}
                  </button>
                </div>
              </SettingRow>
              <SettingRow label={t("settings.editorMode")}>
                <SegmentedControl
                  options={[
                    { value: "edit", label: t("settings.pureEdit") },
                    { value: "split", label: t("settings.splitMode") },
                  ]}
                  value={settings.defaultViewMode}
                  onChange={(v) => update("defaultViewMode", v as Settings["defaultViewMode"])}
                />
              </SettingRow>
              <SettingRow label={t("settings.appearance")}>
                <SegmentedControl
                  options={[
                    { value: "system", label: t("settings.system") },
                    { value: "light", label: t("settings.light") },
                    { value: "dark", label: t("settings.dark") },
                  ]}
                  value={settings.appearance}
                  onChange={(v) => update("appearance", v as Settings["appearance"])}
                />
              </SettingRow>
              <SettingRow label={t("settings.language")}>
                <SelectControl
                  options={["简体中文", "English", "日本語", "繁體中文"]}
                  value={{ zh: "简体中文", en: "English", ja: "日本語", "zh-Hant": "繁體中文" }[settings.language]}
                  onChange={(v) => {
                    const map: Record<string, Settings["language"]> = { "简体中文": "zh", "English": "en", "日本語": "ja", "繁體中文": "zh-Hant" };
                    update("language", map[v] ?? "zh");
                  }}
                />
              </SettingRow>
              <SettingRow label={t("settings.buttonShow")}>
                <SegmentedControl
                  options={[
                    { value: "always", label: t("settings.always") },
                    { value: "hover", label: t("settings.onHover") },
                  ]}
                  value={settings.buttonShow}
                  onChange={(v) => update("buttonShow", v as Settings["buttonShow"])}
                />
              </SettingRow>
              <SettingRow label={t("settings.alwaysOnTop")}>
                <SegmentedControl
                  options={[
                    { value: "yes", label: t("settings.yes") },
                    { value: "no", label: t("settings.no") },
                  ]}
                  value={settings.alwaysOnTop ? "yes" : "no"}
                  onChange={(v) => update("alwaysOnTop", v === "yes")}
                />
              </SettingRow>
              <SettingRow label={t("settings.activateShortcut")}>
                <ShortcutRecorder
                  value={settings.activateShortcut}
                  onChange={(v) => update("activateShortcut", v)}
                />
              </SettingRow>
            </div>
          )}

          {category === "experience" && (
            <div className="flex flex-col gap-5">
              <SettingRow label={t("settings.lineBreak")}>
                <SegmentedControl
                  options={[
                    { value: "miaoyan", label: t("settings.miaoyan") },
                    { value: "github", label: t("settings.github") },
                  ]}
                  value={settings.lineBreak}
                  onChange={(v) => update("lineBreak", v as Settings["lineBreak"])}
                />
              </SettingRow>
              <SettingRow label={t("settings.previewLocation")}>
                <SegmentedControl
                  options={[
                    { value: "begin", label: t("settings.begin") },
                    { value: "editing", label: t("settings.editing") },
                  ]}
                  value={settings.previewLocation}
                  onChange={(v) => update("previewLocation", v as Settings["previewLocation"])}
                />
              </SettingRow>
              <SettingRow label={t("settings.previewWidth")}>
                <SelectControl options={WIDTH_OPTIONS} value={settings.previewWidth} onChange={(v) => update("previewWidth", v)} />
              </SettingRow>
              <SettingRow label={t("settings.uploadService")}>
                <SelectControl
                  options={[t("settings.uploadNone"), ...UPLOAD_SERVICES]}
                  value={settings.uploadService === "none" ? t("settings.uploadNone") : settings.uploadService}
                  onChange={(v) => {
                    const val = v === t("settings.uploadNone") ? "none" : v as Settings["uploadService"];
                    update("uploadService", val);
                  }}
                />
              </SettingRow>
            </div>
          )}

          {category === "typography" && (
            <div className="flex flex-col gap-5">
              <SettingRow label={t("settings.editorFont")}>
                <div className="flex items-center gap-2">
                  <SelectControl options={FONT_OPTIONS} value={settings.editorFont} onChange={(v) => update("editorFont", v)} />
                  <SelectControl options={FONT_SIZE_OPTIONS.map(String)} value={String(settings.fontSize)} onChange={(v) => update("fontSize", Number(v))} />
                </div>
              </SettingRow>
              <SettingRow label={t("settings.previewFont")}>
                <div className="flex items-center gap-2">
                  <SelectControl options={FONT_OPTIONS} value={settings.previewFont} onChange={(v) => update("previewFont", v)} />
                  <SelectControl options={FONT_SIZE_OPTIONS.map(String)} value={String(settings.previewFontSize)} onChange={(v) => update("previewFontSize", Number(v))} />
                </div>
              </SettingRow>
              <SettingRow label={t("settings.codeFont")}>
                <SelectControl options={CODE_FONT_OPTIONS} value={settings.codeFont} onChange={(v) => update("codeFont", v)} />
              </SettingRow>
              <SettingRow label={t("settings.interfaceFont")}>
                <SelectControl options={FONT_OPTIONS} value={settings.interfaceFont} onChange={(v) => update("interfaceFont", v)} />
              </SettingRow>
              <SettingRow label={t("settings.pptFontSize")}>
                <SelectControl options={FONT_SIZE_OPTIONS.filter(s => s >= 16).map(String)} value={String(settings.presentationFontSize)} onChange={(v) => update("presentationFontSize", Number(v))} />
              </SettingRow>
            </div>
          )}

          {category === "ai" && (
            <div className="flex flex-col gap-5">
              <SettingRow label={t("settings.aiApiKey")}>
                <input
                  type="password"
                  className="w-[260px] px-2 py-1 text-[13px] rounded-md bg-white/5 border border-divider text-text-1 outline-none focus:border-accent"
                  value={aiConfig.api_key}
                  onChange={(e) => updateAiConfig({ api_key: e.target.value })}
                  placeholder="sk-..."
                />
              </SettingRow>
              <SettingRow label={t("settings.aiApiUrl")}>
                <input
                  type="text"
                  className="w-[260px] px-2 py-1 text-[13px] rounded-md bg-white/5 border border-divider text-text-1 outline-none focus:border-accent"
                  value={aiConfig.api_url}
                  onChange={(e) => updateAiConfig({ api_url: e.target.value })}
                />
              </SettingRow>
              <SettingRow label={t("settings.aiModel")}>
                <input
                  type="text"
                  className="w-[260px] px-2 py-1 text-[13px] rounded-md bg-white/5 border border-divider text-text-1 outline-none focus:border-accent"
                  value={aiConfig.model}
                  onChange={(e) => updateAiConfig({ model: e.target.value })}
                />
              </SettingRow>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13px] text-text-1 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function SegmentedControl({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="settings-segmented flex rounded-lg overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`px-3 py-[5px] text-[12px] cursor-pointer transition-colors ${
            value === opt.value
              ? "bg-accent text-white"
              : "settings-seg-inactive"
          }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SelectControl({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="settings-select rounded-lg px-3 py-[5px] text-[12px] text-text-1 cursor-pointer flex items-center gap-1 min-w-[140px] justify-between"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{value}</span>
        <svg className="w-3 h-3 shrink-0 text-text-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="settings-dropdown absolute right-0 top-full mt-1 min-w-[160px] rounded-lg z-50 max-h-[200px] overflow-y-auto animate-context-menu">
          {options.map((opt, i) => (
            <button
              key={opt}
              className={`w-full text-left px-3 py-[5px] text-[12px] cursor-pointer transition-colors settings-dropdown-item ${
                opt === value ? "settings-dropdown-active" : ""
              } ${i === 0 ? "rounded-t-lg" : ""} ${i === options.length - 1 ? "rounded-b-lg" : ""}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const MOD_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);
const KEY_DISPLAY: Record<string, string> = {
  Control: "Ctrl", Meta: "⌘", Alt: "Alt", Shift: "Shift",
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
  Backspace: "⌫", Delete: "Del", Escape: "Esc", Enter: "↵",
  " ": "Space", Tab: "Tab",
};

function formatShortcut(shortcut: string): string {
  if (!shortcut) return "";
  return shortcut.split("+").map((k) => KEY_DISPLAY[k] ?? k.toUpperCase()).join(" + ");
}

function ShortcutRecorder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const [recording, setRecording] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") { setRecording(false); return; }
    if (MOD_KEYS.has(e.key)) return;
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("Control");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    parts.push(e.key);
    onChange(parts.join("+"));
    setRecording(false);
  }, [onChange]);

  useEffect(() => {
    if (!recording) return;
    (window as any).__miaoyan_shortcut_recording = true;
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      (window as any).__miaoyan_shortcut_recording = false;
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [recording, handleKeyDown]);

  // Close on outside click
  useEffect(() => {
    if (!recording) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setRecording(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [recording]);

  return (
    <div className="flex items-center gap-1.5">
      <button
        ref={ref}
        className={`settings-select rounded-lg px-3 py-[5px] text-[12px] cursor-pointer min-w-[140px] text-left transition-colors ${
          recording ? "ring-1 ring-accent text-accent" : "text-text-1"
        }`}
        onClick={() => setRecording(true)}
      >
        {recording
          ? t("settings.shortcutRecording")
          : value
            ? formatShortcut(value)
            : <span className="text-text-3">{t("settings.shortcutPlaceholder")}</span>
        }
      </button>
      {value && !recording && (
        <button
          className="text-[11px] text-text-3 hover:text-text-1 cursor-pointer transition-colors"
          onClick={() => onChange("")}
        >
          {t("settings.shortcutClear")}
        </button>
      )}
    </div>
  );
}
