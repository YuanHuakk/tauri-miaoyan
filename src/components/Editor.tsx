import { useEffect, useRef, useCallback, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { searchKeymap, search } from "@codemirror/search";
import { syntaxTree } from "@codemirror/language";
import { listen } from "@tauri-apps/api/event";
import { useI18n } from "../i18n";
import * as api from "../api";
import type { AiAction } from "../types";
import {
  getMiaoYanExtensions,
  reconfigureTheme,
} from "../theme/editorTheme";
import EditorContextMenu, { type ContextMenuAction } from "./EditorContextMenu";
import AiFloatingMenu from "./AiFloatingMenu";
import { markdownAutoFormat } from "../extensions/markdownAutoFormat";

interface EditorProps {
  content: string;
  notePath: string;
  darkMode: boolean;
  uploadService?: string;
  onSave: (content: string) => void;
  onChange?: (content: string) => void;
  onScrollRatio?: (ratio: number) => void;
  scrollRatio?: number;
}

const SAVE_DEBOUNCE_MS = 1500;

// Wrap selection with prefix/suffix, or insert at cursor
function wrapSelection(view: EditorView, prefix: string, suffix: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const replacement = `${prefix}${selected || "文本"}${suffix}`;
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: { anchor: from + prefix.length, head: from + replacement.length - suffix.length },
  });
  view.focus();
}

// Toolbar items removed — MiaoYan uses a clean editor without formatting toolbar

/** Ctrl/Cmd+Click to open URLs in the editor — mirrors MiaoYan's LinkHighlighter. */
const linkClickHandler = EditorView.domEventHandlers({
  click(event, view) {
    if (!(event.ctrlKey || event.metaKey)) return false;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const tree = syntaxTree(view.state);
    let node = tree.resolveInner(pos, 1);
    // Walk up to find URL node in markdown AST
    while (node) {
      if (node.name === "URL") {
        const url = view.state.sliceDoc(node.from, node.to);
        if (url) {
          window.open(url, "_blank");
          event.preventDefault();
          return true;
        }
      }
      if (!node.parent) break;
      node = node.parent;
    }

    // Fallback: regex match on the line
    const line = view.state.doc.lineAt(pos);
    const urlRegex = /https?:\/\/[^\s)>\]]+/g;
    let match;
    while ((match = urlRegex.exec(line.text)) !== null) {
      const from = line.from + match.index;
      const to = from + match[0].length;
      if (pos >= from && pos <= to) {
        window.open(match[0], "_blank");
        event.preventDefault();
        return true;
      }
    }
    return false;
  },
});

export default function Editor({ content, notePath, darkMode, uploadService, onSave, onChange, onScrollRatio, scrollRatio }: EditorProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onScrollRatioRef = useRef(onScrollRatio);
  onScrollRatioRef.current = onScrollRatio;
  const notePathRef = useRef(notePath);
  const uploadServiceRef = useRef(uploadService);
  uploadServiceRef.current = uploadService;
  // Track the content that was last loaded into the editor to avoid unnecessary resets
  const loadedContentRef = useRef(content);
  const isExternalSwitch = useRef(false);
  // Prevent scroll sync loop: skip emitting ratio when programmatically scrolled
  const isSyncingScroll = useRef(false);
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuOpenRef = useRef(false);
  // AI streaming state
  const [aiLoading, setAiLoading] = useState(false);
  const aiInsertPosRef = useRef<number>(0);
  // AI floating menu state
  const [aiMenu, setAiMenu] = useState<{ x: number; y: number } | null>(null);
  // AI diff preview state (for rewrite/polish)
  const [aiDiff, setAiDiff] = useState<{ original: string; result: string; from: number; to: number } | null>(null);
  const aiModeRef = useRef<AiAction>("continue");
  const aiBufferRef = useRef("");
  const aiRangeRef = useRef<{ from: number; to: number }>({ from: 0, to: 0 });

  // Detect note path change — means user switched to a different note
  if (notePath !== notePathRef.current) {
    isExternalSwitch.current = true;
    notePathRef.current = notePath;
  }

  // Handle image file -> base64 -> save -> insert markdown (+ optional cloud upload)
  const handleImageFile = useCallback(async (file: File, view: EditorView) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const ext = file.name.split(".").pop() || "png";
        const filename = `paste_${Date.now()}.${ext}`;
        const relPath = await api.saveImage(notePathRef.current, base64, filename);
        const pos = view.state.selection.main.from;
        const localMd = `![${file.name}](${relPath})`;
        view.dispatch({ changes: { from: pos, to: pos, insert: localMd } });

        // If upload service is configured, upload in background and replace local path
        const service = uploadServiceRef.current;
        if (service && service !== "none") {
          try {
            // Resolve absolute path for the saved image
            const notePath = notePathRef.current;
            const noteDir = notePath.substring(0, notePath.lastIndexOf("/") >= 0 ? notePath.lastIndexOf("/") : notePath.lastIndexOf("\\"));
            const sep = notePath.includes("/") ? "/" : "\\";
            const absImagePath = `${noteDir}${sep}${relPath.replace(/\//g, sep)}`;
            const remoteUrl = await api.uploadImage(absImagePath, service);
            // Find and replace the local markdown image with remote URL
            const doc = view.state.doc.toString();
            const localIdx = doc.indexOf(localMd);
            if (localIdx >= 0) {
              const remoteMd = `![${file.name}](${remoteUrl})`;
              view.dispatch({ changes: { from: localIdx, to: localIdx + localMd.length, insert: remoteMd } });
            }
          } catch (err) { console.warn("Cloud upload failed, keeping local path:", err); }
        }
      } catch (err) { console.error("Failed to save image:", err); }
    };
    reader.readAsDataURL(file);
  }, []);

  const debouncedSave = useCallback((doc: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSaveRef.current(doc);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Create EditorView once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        history(),
        markdownAutoFormat,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          { key: "Mod-b", run: (v) => { wrapSelection(v, "**", "**"); return true; } },
          { key: "Mod-i", run: (v) => { wrapSelection(v, "*", "*"); return true; } },
          { key: "Mod-s", run: (v) => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            onSaveRef.current(v.state.doc.toString());
            return true;
          }, preventDefault: true },
        ]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        search(),
        ...(getMiaoYanExtensions(darkMode)),
        placeholder(t("editor.placeholder")),
        EditorView.lineWrapping,
        linkClickHandler,
        EditorView.domEventHandlers({
          paste(event, view) {
            const items = event.clipboardData?.items;
            if (!items) return false;
            for (const item of items) {
              if (item.type.startsWith("image/")) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) handleImageFile(file, view);
                return true;
              }
            }
            return false;
          },
          contextmenu(event) {
            event.preventDefault();
            setAiMenu(null);
            contextMenuOpenRef.current = true;
            setContextMenu({ x: event.clientX, y: event.clientY });
            return true;
          },
          mouseup(event, view) {
            if (event.button === 2) return false;
            setTimeout(() => {
              // Skip if context menu was just opened
              if (contextMenuOpenRef.current) return;
              const { from, to } = view.state.selection.main;
              if (from !== to) {
                const coords = view.coordsAtPos(from);
                if (coords) {
                  setAiMenu({ x: coords.left, y: coords.top - 42 });
                }
              }
            }, 50);
            return false;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const doc = update.state.doc.toString();
            debouncedSave(doc);
            onChangeRef.current?.(doc);
          }
          // Show/hide AI floating menu on selection change
          if (update.selectionSet || update.docChanged) {
            const { from, to } = update.state.selection.main;
            if (from === to || update.docChanged) {
              setAiMenu(null);
            }
            // Actual show is triggered by mouseup handler below
          }
        }),
        // Scroll sync: emit scroll ratio from .cm-scroller
        EditorView.domEventHandlers({
          scroll(_event, view) {
            if (isSyncingScroll.current) return false;
            if (!onScrollRatioRef.current) return false;
            const scroller = view.scrollDOM;
            const maxScroll = scroller.scrollHeight - scroller.clientHeight;
            if (maxScroll > 0) {
              onScrollRatioRef.current(scroller.scrollTop / maxScroll);
            }
            return false;
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    loadedContentRef.current = content;

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        const doc = viewRef.current?.state.doc.toString();
        if (doc !== undefined && doc !== loadedContentRef.current) {
          onSaveRef.current(doc);
        }
      }
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount/unmount — document switching is handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for image drop events from Tauri drag-drop handler
  useEffect(() => {
    const insertHandler = (e: Event) => {
      const view = viewRef.current;
      if (!view) return;
      const { markdown } = (e as CustomEvent).detail;
      // Insert at end of document to avoid invisible insertion at pos 0
      const end = view.state.doc.length;
      const needNewline = end > 0 && view.state.doc.sliceString(end - 1, end) !== "\n";
      const text = (needNewline ? "\n" : "") + markdown;
      view.dispatch({
        changes: { from: end, to: end, insert: text },
        selection: { anchor: end + text.length },
        effects: EditorView.scrollIntoView(end + text.length),
      });
      view.focus();
    };
    const replaceHandler = (e: Event) => {
      const view = viewRef.current;
      if (!view) return;
      const { oldMd, newMd } = (e as CustomEvent).detail;
      const doc = view.state.doc.toString();
      const idx = doc.indexOf(oldMd);
      if (idx >= 0) {
        view.dispatch({ changes: { from: idx, to: idx + oldMd.length, insert: newMd } });
      }
    };
    window.addEventListener("miaoyan-insert-image", insertHandler);
    window.addEventListener("miaoyan-replace-image", replaceHandler);
    return () => {
      window.removeEventListener("miaoyan-insert-image", insertHandler);
      window.removeEventListener("miaoyan-replace-image", replaceHandler);
    };
  }, []);

  // Listen for AI stream events
  useEffect(() => {
    const unlisten = listen<{ content: string; done: boolean }>("ai-stream", (event) => {
      const { content, done } = event.payload;
      const view = viewRef.current;
      if (!view) return;
      const mode = aiModeRef.current;
      const isReplace = mode === "rewrite" || mode === "polish";

      if (done) {
        setAiLoading(false);
        if (isReplace) {
          // Store original + AI result for diff panel (no editor mutation)
          const { from, to } = aiRangeRef.current;
          const originalText = view.state.sliceDoc(from, to);
          setAiDiff({ original: originalText, result: aiBufferRef.current, from, to });
        }
        return;
      }
      if (content) {
        if (isReplace) {
          // Buffer the result for diff preview
          aiBufferRef.current += content;
        } else {
          // Append directly for continue/summarize
          const pos = aiInsertPosRef.current;
          view.dispatch({ changes: { from: pos, to: pos, insert: content } });
          aiInsertPosRef.current = pos + content.length;
        }
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const triggerAi = useCallback(async (action: AiAction) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selectedText = view.state.sliceDoc(from, to);
    // For "continue", use full doc if no selection; others require selection
    const text = action === "continue"
      ? (selectedText || view.state.doc.toString())
      : selectedText;
    if (!text) return;

    setAiLoading(true);
    aiModeRef.current = action;
    aiBufferRef.current = "";

    if (action === "continue" || action === "summarize") {
      // Append after selection end (or doc end for continue without selection)
      const insertAt = action === "continue" && !selectedText
        ? view.state.doc.length
        : to;
      const prefix = action === "summarize" ? "\n\n---\n\n" : "";
      if (prefix) {
        view.dispatch({ changes: { from: insertAt, to: insertAt, insert: prefix } });
        aiInsertPosRef.current = insertAt + prefix.length;
      } else {
        aiInsertPosRef.current = insertAt;
      }
    } else {
      // rewrite / polish: keep original, buffer AI result for diff preview
      aiRangeRef.current = { from, to };
    }

    try {
      await api.aiComplete(action, text);
    } catch (err) {
      setAiLoading(false);
      console.error("AI complete failed:", err);
    }
  }, []);

  // Swap document content when note changes — reuse existing EditorView
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // Skip if content hasn't actually changed (e.g. save callback updating state)
    if (content === loadedContentRef.current && !isExternalSwitch.current) return;
    isExternalSwitch.current = false;

    // Flush pending save for the previous note before swapping
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // Replace entire document content
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      selection: { anchor: 0 },
      // Reset scroll position
      effects: EditorView.scrollIntoView(0),
    });
    loadedContentRef.current = content;
  }, [content, notePath]);

  // Receive scroll ratio from preview — sync editor scroll position
  useEffect(() => {
    if (scrollRatio === undefined) return;
    const view = viewRef.current;
    if (!view) return;
    const scroller = view.scrollDOM;
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    if (maxScroll > 0) {
      isSyncingScroll.current = true;
      scroller.scrollTop = scrollRatio * maxScroll;
      // Reset flag after browser processes the scroll event
      requestAnimationFrame(() => { isSyncingScroll.current = false; });
    }
  }, [scrollRatio]);

  // Reconfigure syntax highlighting when theme changes
  useEffect(() => {
    const view = viewRef.current;
    if (view) reconfigureTheme(view, darkMode);
  }, [darkMode]);

  // Build context menu actions — mirrors original MiaoYan's editor menu
  const buildContextMenuActions = useCallback((): ContextMenuAction[] => {
    const view = viewRef.current;
    const hasSelection = view ? view.state.selection.main.from !== view.state.selection.main.to : false;
    const mod = navigator.platform.includes("Mac") ? "⌘" : "Ctrl+";
    return [
      { id: "cut", label: t("editor.cut"), shortcut: `${mod}X`, disabled: !hasSelection, action: () => { if (view) { document.execCommand("cut"); view.focus(); } } },
      { id: "copy", label: t("editor.copy"), shortcut: `${mod}C`, disabled: !hasSelection, action: () => { if (view) { document.execCommand("copy"); view.focus(); } } },
      { id: "paste", label: t("editor.paste"), shortcut: `${mod}V`, action: () => { if (view) { navigator.clipboard.readText().then(text => { view.dispatch(view.state.replaceSelection(text)); view.focus(); }).catch(() => { document.execCommand("paste"); }); } } },
      { id: "selectAll", label: t("editor.selectAll"), shortcut: `${mod}A`, separator: true, action: () => { if (view) { view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } }); view.focus(); } } },
      { id: "bold", label: t("editor.bold"), shortcut: `${mod}B`, separator: true, action: () => { if (view) wrapSelection(view, "**", "**"); } },
      { id: "italic", label: t("editor.italic"), shortcut: `${mod}I`, action: () => { if (view) wrapSelection(view, "*", "*"); } },
      { id: "strikethrough", label: t("editor.strikethrough"), action: () => { if (view) wrapSelection(view, "~~", "~~"); } },
      { id: "underline", label: t("editor.underline"), action: () => { if (view) wrapSelection(view, "<u>", "</u>"); } },
      { id: "link", label: t("editor.link"), separator: true, action: () => { if (view) { const { from, to } = view.state.selection.main; const sel = view.state.sliceDoc(from, to) || "链接文本"; const md = `[${sel}](url)`; view.dispatch({ changes: { from, to, insert: md }, selection: { anchor: from + sel.length + 3, head: from + sel.length + 6 } }); view.focus(); } } },
      { id: "todo", label: t("editor.todo"), action: () => { if (view) { const { from } = view.state.selection.main; const line = view.state.doc.lineAt(from); view.dispatch({ changes: { from: line.from, to: line.from, insert: "- [ ] " } }); view.focus(); } } },
      { id: "inlineCode", label: t("editor.inlineCode"), separator: true, action: () => { if (view) wrapSelection(view, "`", "`"); } },
      { id: "codeBlock", label: t("editor.codeBlock"), action: () => { if (view) { const { from, to } = view.state.selection.main; const sel = view.state.sliceDoc(from, to); const md = sel ? `\`\`\`\n${sel}\n\`\`\`\n` : "```\n\n```\n"; view.dispatch({ changes: { from, to, insert: md }, selection: { anchor: from + 4 } }); view.focus(); } } },
      { id: "quote", label: t("editor.quote"), action: () => { if (view) { const { from } = view.state.selection.main; const line = view.state.doc.lineAt(from); view.dispatch({ changes: { from: line.from, to: line.from, insert: "> " } }); view.focus(); } } },
      { id: "insertImage", label: t("editor.insertImage"), separator: true, action: () => { if (view) { const { from, to } = view.state.selection.main; const md = "![](url)"; view.dispatch({ changes: { from, to, insert: md }, selection: { anchor: from + 4, head: from + 7 } }); view.focus(); } } },
      { id: "ai-continue", label: t("ai.continue"), separator: true, disabled: aiLoading, action: () => triggerAi("continue") },
      { id: "ai-rewrite", label: t("ai.rewrite"), disabled: !hasSelection || aiLoading, action: () => triggerAi("rewrite") },
      { id: "ai-polish", label: t("ai.polish"), disabled: !hasSelection || aiLoading, action: () => triggerAi("polish") },
      { id: "ai-summarize", label: t("ai.summarize"), disabled: !hasSelection || aiLoading, action: () => triggerAi("summarize") },
    ];
  }, [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* MiaoYan: clean editor, no formatting toolbar */}
      <div ref={containerRef} className="flex-1 overflow-hidden" />
      {aiLoading && (
        <div className="absolute bottom-3 right-3 px-3 py-1.5 text-[12px] text-text-2 bg-bg-sidebar/90 border border-divider rounded-lg backdrop-blur-sm animate-pulse">
          {t("ai.generating")}
        </div>
      )}
      {aiMenu && !aiLoading && (
        <AiFloatingMenu
          x={aiMenu.x}
          y={aiMenu.y}
          loading={aiLoading}
          onAction={(action) => { setAiMenu(null); triggerAi(action); }}
          onClose={() => setAiMenu(null)}
        />
      )}
      {contextMenu && (
        <EditorContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={buildContextMenuActions()}
          onClose={() => { contextMenuOpenRef.current = false; setContextMenu(null); }}
        />
      )}
      {aiDiff && (
        <div className="shrink-0 border-t border-divider bg-bg-sidebar/95 backdrop-blur-sm flex flex-col" style={{ maxHeight: "35%", minHeight: 120 }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-divider shrink-0">
            <span className="text-[11px] text-text-3">✦ AI Diff</span>
            <div className="flex gap-1.5">
              <button
                className="px-2.5 py-1 text-[12px] rounded-md bg-accent text-white cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => {
                  const view = viewRef.current;
                  if (view && aiDiff) {
                    view.dispatch({
                      changes: { from: aiDiff.from, to: aiDiff.to, insert: aiDiff.result },
                    });
                    view.focus();
                  }
                  setAiDiff(null);
                }}
              >
                {t("ai.accept")}
              </button>
              <button
                className="px-2.5 py-1 text-[12px] rounded-md border border-divider text-text-2 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setAiDiff(null)}
              >
                {t("ai.reject")}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-0 flex-1 min-h-0 overflow-y-auto">
            <div className="p-3 border-r border-divider">
              <div className="text-[11px] text-text-3 mb-1.5">{t("ai.original")}</div>
              <pre className="text-[13px] leading-relaxed whitespace-pre-wrap break-words text-text-1" style={{ backgroundColor: "rgba(248, 81, 73, 0.08)", padding: "8px", borderRadius: "6px" }}>
                {aiDiff.original}
              </pre>
            </div>
            <div className="p-3">
              <div className="text-[11px] text-text-3 mb-1.5">{t("ai.result")}</div>
              <pre className="text-[13px] leading-relaxed whitespace-pre-wrap break-words text-text-1" style={{ backgroundColor: "rgba(63, 185, 80, 0.08)", padding: "8px", borderRadius: "6px" }}>
                {aiDiff.result}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
