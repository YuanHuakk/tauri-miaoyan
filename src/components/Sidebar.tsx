import { useState, useCallback, useRef } from "react";
import type { TreeNode } from "../types";
import { useI18n } from "../i18n";
import ContextMenu, { type MenuItem } from "./ContextMenu";
import WindowControls from "./WindowControls";

interface SidebarProps {
  tree: TreeNode[];
  selectedFolder: string;
  rootPath: string;
  onSelectFolder: (path: string) => void;
  onCreateFolder: (parent: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameFolder: (oldPath: string, newName: string) => void;
}

/* MiaoYan sidebar row heights from SidebarProjectView.swift:
   - "All" item: 48px
   - Normal folder: 34px
   Selection: rounded rect with 8px radius, 12px horizontal margin, 3px vertical margin
*/

function FolderItem({
  node, depth, selectedFolder, onSelectFolder, onContextMenu,
  renamingPath, renameInputRef, onRenameSubmit, onRenameCancel,
}: {
  node: TreeNode; depth: number; selectedFolder: string;
  onSelectFolder: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  renamingPath: string | null;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onRenameSubmit: (oldPath: string, newValue: string) => void;
  onRenameCancel: () => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isSelected = selectedFolder === node.path;
  const subFolders = node.children?.filter((c: TreeNode) => c.isDir) ?? [];
  const hasChildren = subFolders.length > 0;
  const isRenaming = renamingPath === node.path;

  return (
    <div>
      {/* MiaoYan: 34px row height for normal folders, selection with 12px margin */}
      <div
        className="relative mx-[12px] select-none"
        style={{ height: 34 }}
      >
        <div
          className={`absolute inset-0 rounded-lg cursor-pointer flex items-center gap-[6px] transition-colors ${
            isSelected ? "bg-bg-selected" : "hover:bg-bg-hover"
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px`, paddingRight: 8 }}
          onClick={() => !isRenaming && onSelectFolder(node.path)}
          onContextMenu={(e) => onContextMenu(e, node)}
        >
          {hasChildren ? (
            <span
              className="w-3 h-3 flex items-center justify-center text-[10px] text-text-3 shrink-0 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            >
              {expanded ? "▾" : "▸"}
            </span>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          {/* MiaoYan: project icon, 20x20, template image */}
          <svg className="w-[16px] h-[16px] shrink-0 text-toolbar-icon opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              className="flex-1 text-[13px] text-text-1 bg-transparent border-b border-accent outline-none py-0 px-0 min-w-0"
              defaultValue={node.name}
              onBlur={(e) => onRenameSubmit(node.path, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit(node.path, e.currentTarget.value);
                if (e.key === "Escape") onRenameCancel();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={`truncate text-[13px] tracking-[0.5px] ${isSelected ? "text-text-1 font-medium" : "text-text-1"}`}>
              {node.name}
            </span>
          )}
        </div>
      </div>
      {expanded && hasChildren && subFolders.map((child) => (
        <FolderItem
          key={child.path} node={child} depth={depth + 1}
          selectedFolder={selectedFolder} onSelectFolder={onSelectFolder}
          onContextMenu={onContextMenu} renamingPath={renamingPath}
          renameInputRef={renameInputRef} onRenameSubmit={onRenameSubmit}
          onRenameCancel={onRenameCancel}
        />
      ))}
    </div>
  );
}

export default function Sidebar({
  tree, selectedFolder, rootPath,
  onSelectFolder, onCreateFolder, onDeleteFolder, onRenameFolder,
}: SidebarProps) {
  const { t } = useI18n();
  const folders = tree.filter((n) => n.isDir);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleRenameSubmit = useCallback((oldPath: string, newValue: string) => {
    const trimmed = newValue.trim();
    if (trimmed && trimmed !== oldPath.split(/[/\\]/).pop()) {
      onRenameFolder(oldPath, trimmed);
    }
    setRenamingPath(null);
  }, [onRenameFolder]);

  const contextMenuItems: MenuItem[] = contextMenu
    ? [
        { label: t("sidebar.newSubfolder"), onClick: () => onCreateFolder(contextMenu.node.path) },
        { label: t("sidebar.rename"), onClick: () => { setRenamingPath(contextMenu.node.path); setTimeout(() => renameInputRef.current?.focus(), 50); } },
        { label: t("sidebar.deleteFolder"), danger: true, onClick: () => onDeleteFolder(contextMenu.node.path) },
      ]
    : [];

  return (
    <div className="h-full flex flex-col bg-bg-sidebar select-none">
      {/* Title bar: traffic lights + new note button */}
      <div className="h-[52px] flex items-center justify-between px-2 shrink-0" data-tauri-drag-region>
        <WindowControls />
        <button
          className="w-7 h-7 flex items-center justify-center rounded-md text-toolbar-icon hover:bg-bg-hover cursor-pointer transition-colors"
          onClick={() => onCreateFolder(selectedFolder || rootPath)}
          data-tip={t("sidebar.newSubfolder")}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto pb-2">
        {/* MiaoYan "All Notes" — 48px height, accent color, semibold, larger font */}
        <div className="mx-[12px]" style={{ height: 48 }}>
          <div
            className={`h-full rounded-lg cursor-pointer flex items-center gap-[4px] px-2 transition-colors ${
              selectedFolder === rootPath ? "bg-bg-selected" : "hover:bg-bg-hover"
            }`}
            onClick={() => onSelectFolder(rootPath)}
          >
            <span className="w-3 shrink-0" />
            {/* MiaoYan: home icon, 24x24, accent colored */}
            <svg className="w-[18px] h-[18px] shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className={`truncate text-[15px] font-semibold tracking-[0.5px] text-accent`}>
              {t("sidebar.allNotes")}
            </span>
          </div>
        </div>

        {folders.map((node) => (
          <FolderItem
            key={node.path} node={node} depth={0}
            selectedFolder={selectedFolder} onSelectFolder={onSelectFolder}
            onContextMenu={handleContextMenu} renamingPath={renamingPath}
            renameInputRef={renameInputRef} onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenamingPath(null)}
          />
        ))}
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}