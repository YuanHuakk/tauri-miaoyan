import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { TreeNode, NoteContent } from "./types";
import * as api from "./api";
import { type Locale, getTranslator, I18nContext } from "./i18n";
import Sidebar from "./components/Sidebar";
import NoteList from "./components/NoteList";
import Editor from "./components/Editor";
import Preview from "./components/Preview";
import PPTView from "./components/PPTView";
import WindowControls from "./components/WindowControls";
import SearchPanel from "./components/SearchPanel";
import TemplatePanel from "./components/TemplatePanel";
import ToastContainer, { showToast } from "./components/Toast";
import ConfirmDialog from "./components/ConfirmDialog";
import SettingsPanel from "./components/SettingsPanel";
import { type Settings, loadSettings, saveSettings } from "./utils/settings";

type ViewMode = "edit" | "preview" | "split" | "ppt";

// Map internal key format (e.g. "Control+Shift+m") to Tauri shortcut format (e.g. "CmdOrCtrl+Shift+M")
function toTauriShortcut(shortcut: string): string {
  if (!shortcut) return "";
  return shortcut.split("+").map((k) => {
    if (k === "Control") return "CmdOrCtrl";
    if (k.length === 1) return k.toUpperCase();
    return k;
  }).join("+");
}

async function registerActivateShortcut(newShortcut: string, oldShortcut: string) {
  try {
    const gs = await import("@tauri-apps/plugin-global-shortcut");
    if (oldShortcut) {
      const old = toTauriShortcut(oldShortcut);
      try { await gs.unregister(old); } catch { /* may not be registered */ }
    }
    if (newShortcut) {
      const key = toTauriShortcut(newShortcut);
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await gs.register(key, async () => {
        const win = getCurrentWindow();
        const minimized = await win.isMinimized();
        if (minimized) {
          await win.unminimize();
          await win.setFocus();
          return;
        }
        const visible = await win.isVisible();
        if (!visible) {
          await win.show();
          await win.setFocus();
        } else {
          await win.setFocus();
        }
      });
    }
  } catch (err) { console.warn("Failed to register global shortcut:", err); }
}

// Store layout state before entering presentation mode
let savedLayout: { sidebar: boolean; noteList: boolean } | null = null;

export default function App() {
  const [rootPath, setRootPath] = useState(() => localStorage.getItem("miaoyan_root") || "");
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoaded, setTreeLoaded] = useState(!localStorage.getItem("miaoyan_root"));
  const [selectedFolder, setSelectedFolder] = useState("");
  const [currentNote, setCurrentNote] = useState<NoteContent | null>(null);
  const [liveContent, setLiveContent] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadSettings().defaultViewMode || "edit");
  const [sidebarVisible, setSidebarVisible] = useState(() => localStorage.getItem("miaoyan_sidebar") !== "false");
  const [noteListVisible, setNoteListVisible] = useState(() => localStorage.getItem("miaoyan_notelist") !== "false");
  const [searchVisible, setSearchVisible] = useState(false);
  const [scrollSync, setScrollSync] = useState<{ source: "editor" | "preview"; ratio: number }>({ source: "editor", ratio: 0 });
  const lastEditorScrollRef = useRef(0);
  const [templateVisible, setTemplateVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; danger?: boolean; onConfirm: () => void } | null>(null);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(() => {
    const s = loadSettings();
    return s.appearance;
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const darkMode = themeMode === "system" ? systemDark : themeMode === "dark";
  const [locale, setLocale] = useState<Locale>(() => {
    const s = loadSettings();
    return s.language as Locale;
  });

  const t = useMemo(() => getTranslator(locale), [locale]);
  const i18nValue = useMemo(() => ({
    locale, t,
    setLocale: (l: Locale) => { setLocale(l); localStorage.setItem("miaoyan_locale", l); },
  }), [locale, t]);

  const handleSettingsChange = useCallback(async (next: Settings) => {
    setSettings(next);
    saveSettings(next);
    // Sync appearance
    if (next.appearance !== themeMode) setThemeMode(next.appearance);
    // Sync language
    if (next.language !== locale) {
      setLocale(next.language as Locale);
      localStorage.setItem("miaoyan_locale", next.language);
    }
    // Sync default view mode — only switch if currently in edit or split
    if (next.defaultViewMode !== settings.defaultViewMode) {
      setViewMode((prev) => (prev === "edit" || prev === "split") ? next.defaultViewMode : prev);
    }
    // Sync always on top via Tauri window API
    if (next.alwaysOnTop !== settings.alwaysOnTop) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().setAlwaysOnTop(next.alwaysOnTop);
      } catch (err) { console.warn("Failed to set always on top:", err); }
    }
    // Sync global shortcut
    if (next.activateShortcut !== settings.activateShortcut) {
      registerActivateShortcut(next.activateShortcut, settings.activateShortcut);
    }
  }, [themeMode, locale, settings.defaultViewMode, settings.alwaysOnTop, settings.activateShortcut]);

  useEffect(() => {
    if (rootPath) {
      initRoot(rootPath).catch(() => {
        // Saved path no longer exists, clear it to trigger auto-init
        localStorage.removeItem("miaoyan_root");
        setRootPath("");
      });
    }
  }, []);

  // Register saved global shortcut on mount
  useEffect(() => {
    if (settings.activateShortcut) {
      registerActivateShortcut(settings.activateShortcut, "");
    }
    // Restore always-on-top on mount
    if (settings.alwaysOnTop) {
      (async () => {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          await getCurrentWindow().setAlwaysOnTop(true);
        } catch (err) { console.warn("Failed to restore always on top:", err); }
      })();
    }
  }, []);

  // System theme listener
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Dark mode toggle + settings CSS variables
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("miaoyan_theme", themeMode);
    // Apply settings as CSS custom properties
    const s = document.documentElement.style;
    s.setProperty("--editor-font-size", `${settings.fontSize}px`);
    s.setProperty("--preview-font-size", `${settings.previewFontSize}px`);
    s.setProperty("--ppt-font-size", `${settings.presentationFontSize}px`);
    s.setProperty("--preview-max-width", settings.previewWidth === "Full Width" ? "100%" : settings.previewWidth);
    s.setProperty("--editor-font-family", `'${settings.editorFont}', -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif`);
    s.setProperty("--preview-font-family", `'${settings.previewFont}', -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif`);
    s.setProperty("--code-font-family", `"${settings.codeFont}", "SF Mono", "JetBrains Mono", monospace`);
    s.setProperty("--interface-font-family", `'${settings.interfaceFont}', -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif`);
  }, [darkMode, themeMode, settings]);

  // Persist sidebar & note list visibility
  useEffect(() => { localStorage.setItem("miaoyan_sidebar", String(sidebarVisible)); }, [sidebarVisible]);
  useEffect(() => { localStorage.setItem("miaoyan_notelist", String(noteListVisible)); }, [noteListVisible]);

  const initRoot = useCallback(async (path: string) => {
    try {
      const nodes = await api.listDirectoryTree(path);
      setRootPath(path);
      setSelectedFolder(path);
      setTree(nodes);
      setTreeLoaded(true);
      localStorage.setItem("miaoyan_root", path);
      // Start file system watcher
      api.watchDirectory(path).catch((err) => console.warn("Watcher init failed:", err));
    } catch (err) {
      console.error("Failed to load directory:", err);
    }
  }, []);

  const refreshTree = useCallback(async () => {
    if (!rootPath) return;
    try { setTree(await api.listDirectoryTree(rootPath)); }
    catch (err) { console.error("Failed to refresh:", err); }
  }, [rootPath]);

  const openNoteSeqRef = useRef(0);
  const openNote = useCallback(async (path: string) => {
    const seq = ++openNoteSeqRef.current;
    try {
      const note = await api.getNoteContent(path);
      // Only apply if this is still the latest request
      if (seq === openNoteSeqRef.current) {
        setCurrentNote(note);
        setLiveContent(note.content);
      }
    } catch (err) { console.error("Failed to open:", err); }
  }, []);

  const saveNote = useCallback(async (content: string) => {
    if (!currentNote) return;
    try {
      await api.saveNote(currentNote.path, content);
      refreshTree();
      showToast("已保存");
    } catch (err) { console.error("Failed to save:", err); }
  }, [currentNote, refreshTree]);

  const createNote = useCallback(async (dir: string, initialContent?: string) => {
    try {
      const note = await api.createNote(dir, "", initialContent);
      await refreshTree();
      setCurrentNote(note);
      setLiveContent(note.content);
    } catch (err) { console.error("Failed to create:", err); }
  }, [refreshTree]);

  const deleteNote = useCallback(async (path: string) => {
    setConfirmDialog({
      message: t("confirm.deleteNote"),
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteNote(path);
          if (currentNote?.path === path) setCurrentNote(null);
          await refreshTree();
        } catch (err) { console.error("Failed to delete:", err); }
      },
    });
  }, [currentNote, refreshTree, t]);

  const renameNote = useCallback(async (oldPath: string, newName: string) => {
    try {
      const newPath = await api.renameNote(oldPath, newName);
      await refreshTree();
      // If the renamed note is currently open, reload it
      if (currentNote?.path === oldPath) {
        setCurrentNote(await api.getNoteContent(newPath));
      }
    } catch (err) { console.error("Failed to rename:", err); }
  }, [currentNote, refreshTree]);

  const createFolder = useCallback(async (parent: string) => {
    try {
      const newPath = await api.createFolder(parent, "");
      await refreshTree();
      setSelectedFolder(newPath);
    } catch (err) { console.error("Failed to create folder:", err); }
  }, [refreshTree]);

  const deleteFolder = useCallback(async (path: string) => {
    setConfirmDialog({
      message: t("confirm.deleteFolder"),
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteNote(path);
          if (selectedFolder === path) setSelectedFolder(rootPath);
          if (currentNote?.path.startsWith(path)) setCurrentNote(null);
          await refreshTree();
        } catch (err) { console.error("Failed to delete folder:", err); }
      },
    });
  }, [selectedFolder, rootPath, currentNote, refreshTree, t]);

  const renameFolder = useCallback(async (oldPath: string, newName: string) => {
    try {
      const newPath = await api.renameNote(oldPath, newName); // rename_note works for dirs
      await refreshTree();
      if (selectedFolder === oldPath) setSelectedFolder(newPath);
    } catch (err) { console.error("Failed to rename folder:", err); }
  }, [selectedFolder, refreshTree]);

  const handleExport = useCallback(async () => {
    if (!currentNote) return;
    try {
      const { save: saveDialog } = await import("@tauri-apps/plugin-dialog");
      const dest = await saveDialog({
        title: t("dialog.exportTitle"),
        defaultPath: `${currentNote.title}.html`,
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (dest) {
        await api.exportHtml(currentNote.content, dest as string);
        showToast("导出成功");
      }
    } catch (err) { console.error("Failed to export:", err); }
  }, [currentNote, t]);

  const handleSelectRoot = useCallback(async () => {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({ directory: true, title: t("dialog.selectFolder") });
      if (selected) initRoot(selected as string);
    } catch {
      const path = window.prompt(t("dialog.inputPath"));
      if (path) initRoot(path);
    }
  }, [initRoot, t]);

  // Switch view mode with presentation layout management
  const switchViewMode = useCallback((newMode: ViewMode | ((prev: ViewMode) => ViewMode)) => {
    setViewMode((prev) => {
      const next = typeof newMode === "function" ? newMode(prev) : newMode;
      // Only preview mode needs layout hiding; PPT uses fixed overlay
      const isPreview = (m: ViewMode) => m === "preview";
      // Entering preview mode — save and hide layout
      if (!isPreview(prev) && isPreview(next)) {
        savedLayout = { sidebar: sidebarVisible, noteList: noteListVisible };
        setSidebarVisible(false);
        setNoteListVisible(false);
      }
      // Exiting preview mode — restore layout
      if (isPreview(prev) && !isPreview(next) && savedLayout) {
        setSidebarVisible(savedLayout.sidebar);
        setNoteListVisible(savedLayout.noteList);
        savedLayout = null;
      }
      return next;
    });
  }, [sidebarVisible, noteListVisible]);

  // File system change listener — auto-refresh tree on external changes
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen("fs-changed", () => { refreshTree(); });
    })();
    return () => { unlisten?.(); };
  }, [refreshTree]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      // Skip when shortcut recorder is active
      if ((window as any).__miaoyan_shortcut_recording) return;

      // Block the activate shortcut from reaching the webview
      const activateKey = settings.activateShortcut;
      if (activateKey) {
        const parts = activateKey.split("+");
        const key = parts[parts.length - 1];
        const needCtrl = parts.includes("Control");
        const needAlt = parts.includes("Alt");
        const needShift = parts.includes("Shift");
        if ((e.ctrlKey || e.metaKey) === needCtrl && e.altKey === needAlt && e.shiftKey === needShift && e.key.toLowerCase() === key.toLowerCase()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "p") { e.preventDefault(); setSearchVisible(true); }
      if (mod && e.key === "n") { e.preventDefault(); if (rootPath) setTemplateVisible(true); }
      if (mod && e.key === "\\") { e.preventDefault(); setSidebarVisible((v) => !v); }
      if (mod && e.key === "2") { e.preventDefault(); setNoteListVisible((v) => !v); }
      if (mod && e.key === "d") { e.preventDefault(); setThemeMode((v) => v === "light" ? "dark" : v === "dark" ? "system" : "light"); }
      if (mod && e.key === ",") { e.preventDefault(); setSettingsVisible(true); }
      if (mod && e.key === "4") {
        e.preventDefault();
        if (currentNote) {
          switchViewMode((v) => {
            if (v === "ppt") return "edit";
            if (!currentNote.content.includes("---")) {
              showToast("没有找到 --- 分隔符，无法使用 PPT 模式");
              return v;
            }
            return "ppt";
          });
        }
      }
      if (e.key === "F11" || (mod && e.shiftKey && e.key === "F")) {
        e.preventDefault();
        e.stopPropagation();
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("toggle_fullscreen");
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [rootPath, selectedFolder]);

  // No root path: auto-init default notes in Documents/MiaoYan
  useEffect(() => {
    if (rootPath) return;
    (async () => {
      try {
        const defaultPath = await api.initDefaultNotes();
        initRoot(defaultPath);
      } catch (err) { console.error("Failed to init default notes:", err); }
    })();
  }, [rootPath, initRoot]);

  // Handle file/folder drag-drop from OS
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      const { listen, TauriEvent } = await import("@tauri-apps/api/event");
      const unlisten = await listen<{ paths: string[]; position: { x: number; y: number } }>(TauriEvent.DRAG_DROP, async (event) => {
        if (cancelled) return;
        const paths = event.payload.paths;
        if (!paths || paths.length === 0) return;
        const firstPath = paths[0];
        const lower = firstPath.toLowerCase();
        try {
          const pathType = await api.checkPathType(firstPath);
          if (pathType === "dir") {
            initRoot(firstPath);
          } else if (pathType === "file") {
            if (lower.endsWith(".md")) {
              const parentDir = firstPath.replace(/[\\/][^\\/]+$/, "");
              if (parentDir !== rootPath) await initRoot(parentDir);
              openNote(firstPath);
            } else if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/.test(lower) && currentNote) {
              const relPath = await api.saveImageFromPath(currentNote.path, firstPath);
              const fileName = firstPath.replace(/^.*[\\/]/, "");
              const localMd = `![${fileName}](${relPath})\n`;
              window.dispatchEvent(new CustomEvent("miaoyan-insert-image", { detail: { markdown: localMd } }));
              const service = settings.uploadService;
              if (service && service !== "none") {
                try {
                  const noteDir = currentNote.path.replace(/[\\/][^\\/]+$/, "");
                  const sep = currentNote.path.includes("/") ? "/" : "\\";
                  const absImagePath = `${noteDir}${sep}${relPath.replace(/\//g, sep)}`;
                  const remoteUrl = await api.uploadImage(absImagePath, service);
                  const remoteMd = `![${fileName}](${remoteUrl})\n`;
                  window.dispatchEvent(new CustomEvent("miaoyan-replace-image", { detail: { oldMd: localMd, newMd: remoteMd } }));
                } catch (err) { console.warn("Cloud upload failed, keeping local path:", err); }
              }
            }
          }
        } catch (err) { console.error("Drag-drop handling failed:", err); }
      });
      if (cancelled) unlisten();
      else return unlisten;
    };
    let unlistenFn: (() => void) | undefined;
    setup().then((fn) => { if (fn) unlistenFn = fn; });
    return () => { cancelled = true; unlistenFn?.(); };
  }, [rootPath, initRoot, openNote, currentNote]);

  // Toolbar icons
  const ToolbarIcon = ({ mode, label, children }: { mode: ViewMode; label: string; children: React.ReactNode }) => (
    <button
      className={`w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-colors ${
        viewMode === mode ? "text-accent" : "text-toolbar-icon-inactive hover:text-toolbar-icon"
      }`}
      onClick={() => switchViewMode(mode)}
      data-tip={label}
    >
      {children}
    </button>
  );

  return (
    <I18nContext.Provider value={i18nValue}>
    <div className="h-full flex">
      {/* Sidebar */}
      {sidebarVisible && (
        <div className="w-[180px] shrink-0 border-r border-divider">
          <Sidebar
            tree={tree}
            selectedFolder={selectedFolder}
            rootPath={rootPath}
            onSelectFolder={setSelectedFolder}
            onCreateFolder={createFolder}
            onDeleteFolder={deleteFolder}
            onRenameFolder={renameFolder}
          />
        </div>
      )}

      {/* Note list */}
      {noteListVisible && (
      <div className="w-[280px] shrink-0 border-r border-divider">
        {treeLoaded ? (
        <NoteList
          tree={tree}
          selectedFolder={selectedFolder}
          rootPath={rootPath}
          currentNotePath={currentNote?.path ?? null}
          onOpenNote={openNote}
          onCreateNote={createNote}
          onDeleteNote={deleteNote}
          onRenameNote={renameNote}
          showWindowControls={!sidebarVisible}
        />
        ) : <div className="h-full bg-bg-notelist" />}
      </div>
      )}

      {/* Editor area */}
      <div className="flex-1 flex flex-col min-w-0 bg-bg">
        {/* Title bar — MiaoYan: title centered, toolbar buttons right-aligned */}
        <div className="titlebar-area h-[52px] flex items-center px-4 shrink-0 relative" data-tauri-drag-region>
          {/* Left: window controls (when sidebar hidden) + sidebar toggle */}
          <div className="flex items-center shrink-0" data-tauri-drag-region>
            {!sidebarVisible && !noteListVisible && <WindowControls />}
            <button
              className="w-7 h-7 flex items-center justify-center rounded text-toolbar-icon-inactive hover:text-toolbar-icon cursor-pointer transition-colors"
              onClick={() => setSidebarVisible(!sidebarVisible)}
              data-tip={t("toolbar.toggleSidebar")}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded text-toolbar-icon-inactive hover:text-toolbar-icon cursor-pointer transition-colors"
              onClick={() => setNoteListVisible(!noteListVisible)}
              data-tip={t("toolbar.toggleNoteList")}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </button>
          </div>
          {/* Center: note title */}
          <div className="absolute left-0 right-0 flex justify-center pointer-events-none" data-tauri-drag-region>
            {currentNote && (
              <span className="text-[14px] text-text-1 font-medium truncate tracking-[0.2px] max-w-[50%]" data-tauri-drag-region>
                {currentNote.title}
              </span>
            )}
          </div>
          {/* Right: view mode + actions */}
          <div className={`flex items-center gap-0.5 shrink-0 ml-auto transition-opacity duration-200 ${
            settings.buttonShow === "hover" ? "toolbar-hover-hide" : ""
          }`}>
            {currentNote && (
              <>
                <ToolbarIcon mode="edit" label={t("toolbar.edit")}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </ToolbarIcon>
                <ToolbarIcon mode="split" label={t("toolbar.split")}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M12 3v18" />
                  </svg>
                </ToolbarIcon>
                <ToolbarIcon mode="preview" label={t("toolbar.preview")}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </ToolbarIcon>
                <ToolbarIcon mode="ppt" label={t("toolbar.ppt")}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8" />
                    <path d="M12 17v4" />
                  </svg>
                </ToolbarIcon>
                <button
                  className="w-7 h-7 flex items-center justify-center rounded text-toolbar-icon-inactive hover:text-toolbar-icon cursor-pointer transition-colors ml-1"
                  data-tip={t("toolbar.export")}
                  onClick={handleExport}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              </>
            )}
            <button
              className="w-7 h-7 flex items-center justify-center rounded text-toolbar-icon-inactive hover:text-toolbar-icon cursor-pointer transition-colors ml-1"
              data-tip={t("settings.title")}
              onClick={() => setSettingsVisible(true)}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-divider" />

        {/* Content */}
        <div className="flex-1 min-h-0">
          {!currentNote ? (
            <div className="h-full flex items-center justify-center text-text-3 text-[13px]">
              {t("app.selectOrCreate")}
            </div>
          ) : viewMode === "ppt" ? (
            <PPTView content={liveContent} onExit={() => switchViewMode("edit")} />
          ) : (
            <div className="h-full flex min-h-0">
              {/* Editor: always mounted, hidden only in preview mode to preserve state */}
              <div className={`min-h-0 ${viewMode === "preview" ? "hidden" : "flex-1"} ${viewMode === "split" ? "border-r border-divider" : ""}`}>
                <Editor
                  content={currentNote.content} notePath={currentNote.path} darkMode={darkMode} uploadService={settings.uploadService} onSave={saveNote} onChange={setLiveContent}
                  onScrollRatio={viewMode === "split" ? (r) => { lastEditorScrollRef.current = r; setScrollSync({ source: "editor", ratio: r }); } : undefined}
                  scrollRatio={viewMode === "split" && scrollSync.source === "preview" ? scrollSync.ratio : undefined}
                />
              </div>
              {/* Preview: shown in preview and split modes */}
              {(viewMode === "preview" || viewMode === "split") && (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <Preview
                    content={liveContent}
                    lineBreak={settings.lineBreak}
                    onScrollRatio={viewMode === "split" ? (r) => setScrollSync({ source: "preview", ratio: r }) : undefined}
                    scrollRatio={viewMode === "preview" && settings.previewLocation === "editing" ? lastEditorScrollRef.current : viewMode === "split" && scrollSync.source === "editor" ? scrollSync.ratio : undefined}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global search panel */}
      <SearchPanel
        rootPath={rootPath}
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onOpenNote={openNote}
      />

      {/* Template panel */}
      <TemplatePanel
        visible={templateVisible}
        onSelect={(content) => createNote(selectedFolder || rootPath, content)}
        onClose={() => setTemplateVisible(false)}
      />

      <ToastContainer />

      <SettingsPanel
        visible={settingsVisible}
        settings={settings}
        rootPath={rootPath}
        onClose={() => setSettingsVisible(false)}
        onChange={handleSettingsChange}
        onChangeRoot={handleSelectRoot}
      />

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          danger={confirmDialog.danger}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
    </I18nContext.Provider>
  );
}
