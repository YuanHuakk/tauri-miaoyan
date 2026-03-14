import { useState, useCallback, useRef } from "react";
import type { TreeNode } from "../types";
import { useI18n } from "../i18n";
import ContextMenu, { type MenuItem } from "./ContextMenu";
import WindowControls from "./WindowControls";

interface NoteListProps {
  tree: TreeNode[];
  selectedFolder: string;
  rootPath: string;
  currentNotePath: string | null;
  onOpenNote: (path: string) => void;
  onCreateNote: (dir: string) => void;
  onDeleteNote: (path: string) => void;
  onRenameNote: (oldPath: string, newName: string) => void;
  showWindowControls?: boolean;
}

/* MiaoYan NotesTableView:
   - Row height: 52px
   - Selection: rounded rect 8px radius, 11px horizontal margin, 2px vertical margin
   - Separator: 1px, x=20 to width-40, hidden for selected row and adjacent rows
   - Name font: nameFont with character spacing
   - Date font: dateFont, secondaryTextColor
*/

function formatTime(ms?: number): string {
  if (!ms) return "";
  const date = new Date(ms);
  const now = new Date();
  const isToday = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (isToday) return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function getNotesForFolder(tree: TreeNode[], selectedFolder: string, rootPath: string): TreeNode[] {
  if (selectedFolder === rootPath) return flattenNotes(tree);
  const folder = findNode(tree, selectedFolder);
  return folder?.children?.filter((n) => !n.isDir) ?? [];
}

function flattenNotes(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    if (node.isDir && node.children) result.push(...flattenNotes(node.children));
    else if (!node.isDir) result.push(node);
  }
  return result;
}

function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.isDir && node.children) { const f = findNode(node.children, path); if (f) return f; }
  }
}

function titleFromName(name: string): string {
  return name.replace(/\.(md|markdown|txt)$/i, "");
}

// Pin storage helpers
function getPinnedNotes(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem("miaoyan_pinned") || "[]"));
  } catch { return new Set(); }
}
function savePinnedNotes(pinned: Set<string>) {
  localStorage.setItem("miaoyan_pinned", JSON.stringify([...pinned]));
}

export default function NoteList({
  tree, selectedFolder, rootPath, currentNotePath,
  onOpenNote, onCreateNote, onDeleteNote, onRenameNote,
  showWindowControls,
}: NoteListProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; note: TreeNode } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [pinnedNotes, setPinnedNotes] = useState<Set<string>>(getPinnedNotes);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const togglePin = useCallback((path: string) => {
    setPinnedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      savePinnedNotes(next);
      return next;
    });
  }, []);

  const notes = getNotesForFolder(tree, selectedFolder, rootPath);
  const filtered = searchQuery
    ? notes.filter((n) => titleFromName(n.name).toLowerCase().includes(searchQuery.toLowerCase()))
    : notes;
  const sorted = [...filtered].sort((a, b) => {
    // Pinned notes always on top
    const aPinned = pinnedNotes.has(a.path) ? 1 : 0;
    const bPinned = pinnedNotes.has(b.path) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    // Sort by filename
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });

  const handleContextMenu = useCallback((e: React.MouseEvent, note: TreeNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, note });
  }, []);

  const handleRenameSubmit = useCallback((oldPath: string, newValue: string) => {
    const trimmed = newValue.trim();
    if (trimmed && trimmed !== renamingPath) {
      const oldExt = oldPath.split(".").pop() ?? "md";
      const newName = trimmed.includes(".") ? trimmed : `${trimmed}.${oldExt}`;
      onRenameNote(oldPath, newName);
    }
    setRenamingPath(null);
  }, [onRenameNote, renamingPath]);

  const contextMenuItems: MenuItem[] = contextMenu
    ? [
        {
          label: pinnedNotes.has(contextMenu.note.path) ? t("notelist.unpin") : t("notelist.pin"),
          onClick: () => togglePin(contextMenu.note.path),
        },
        { label: t("notelist.rename"), onClick: () => { setRenamingPath(contextMenu.note.path); setTimeout(() => renameInputRef.current?.focus(), 50); } },
        { label: t("notelist.delete"), danger: true, onClick: () => onDeleteNote(contextMenu.note.path) },
      ]
    : [];

  return (
    <div className="h-full flex flex-col bg-bg-notelist select-none relative">
      {/* Header — window controls when sidebar is hidden */}
      <div className="shrink-0 px-3 pt-[52px] pb-2" data-tauri-drag-region>
        {showWindowControls && (
          <div className="absolute top-0 left-0 h-[52px] flex items-center">
            <WindowControls />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            className="search-input flex-1"
            placeholder={t("notelist.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="w-[30px] h-[30px] flex items-center justify-center rounded-full border border-divider bg-bg text-toolbar-icon-inactive hover:text-toolbar-icon cursor-pointer transition-colors shrink-0"
            onClick={() => onCreateNote(selectedFolder || rootPath)}
            data-tip={t("sidebar.newNote")}
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-3 text-[13px] gap-2">
            <span>{searchQuery ? t("notelist.noMatch") : t("notelist.empty")}</span>
            {!searchQuery && (
              <button className="text-accent cursor-pointer text-[13px]" onClick={() => onCreateNote(selectedFolder || rootPath)}>
                {t("notelist.createOne")}
              </button>
            )}
          </div>
        ) : (
          sorted.map((note) => {
            const isActive = currentNotePath === note.path;
            const isRenaming = renamingPath === note.path;

            return (
              <div
                key={note.path}
                className="relative cursor-pointer"
                style={{ height: 52 }}
                onClick={() => !isRenaming && onOpenNote(note.path)}
                onContextMenu={(e) => handleContextMenu(e, note)}
              >
                {/* Selection / content area — MiaoYan: 11px margin, 2px top/bottom, 8px radius */}
                <div
                  className={`absolute top-[2px] bottom-[2px] left-[11px] right-[11px] rounded-lg flex items-center px-[10px] transition-colors ${
                    isActive ? "bg-bg-selected" : "hover:bg-bg-hover"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2 w-full min-w-0">
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        className="flex-1 text-[14px] font-medium text-text-1 bg-transparent border-b border-accent outline-none py-0 px-0 leading-[20px]"
                        defaultValue={titleFromName(note.name)}
                        onBlur={(e) => handleRenameSubmit(note.path, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameSubmit(note.path, e.currentTarget.value);
                          if (e.key === "Escape") setRenamingPath(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-[14px] font-medium text-text-1 truncate leading-[20px] tracking-[0.3px] flex items-center gap-1">
                        {pinnedNotes.has(note.path) && (
                          <svg className="w-3 h-3 text-accent shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                          </svg>
                        )}
                        {titleFromName(note.name)}
                      </span>
                    )}
                    <span className="text-[11px] text-text-2 shrink-0 tracking-[0.2px]">
                      {formatTime(note.modifiedAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}