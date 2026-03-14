import { useEffect, useRef } from "react";

export interface ContextMenuAction {
  id: string;
  label: string;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
  action: () => void;
}

interface EditorContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export default function EditorContextMenu({ x, y, actions, onClose }: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) menuRef.current.style.left = `${vw - rect.width - 4}px`;
    if (rect.bottom > vh) menuRef.current.style.top = `${vh - rect.height - 4}px`;
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-9999 min-w-[180px] rounded-lg shadow-lg border border-divider bg-bg-sidebar backdrop-blur-sm overflow-hidden"
      style={{ left: x, top: y }}
    >
      {actions.map((item, i) => (
        <div key={item.id}>
          {item.separator && i > 0 && <div className="h-px mx-2 my-1 bg-divider" />}
          <button
            className={`w-full px-3 py-1.5 text-left text-[13px] flex items-center justify-between cursor-pointer transition-colors ${
              item.disabled
                ? "text-text-3 cursor-default"
                : "text-text-1 hover:bg-accent/10"
            }`}
            onClick={() => { if (!item.disabled) { item.action(); onClose(); } }}
            disabled={item.disabled}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-[11px] text-text-3 ml-4">{item.shortcut}</span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
