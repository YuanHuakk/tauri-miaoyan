import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  danger?: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const nx = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 8 : x;
    const ny = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 8 : y;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-100 min-w-[160px] rounded-[10px] border border-divider bg-bg/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] animate-context-menu overflow-hidden"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          className={`w-full text-left px-3 py-[6px] text-[13px] leading-[18px] cursor-pointer transition-colors flex items-center gap-2 ${
            item.danger
              ? "text-red-500 hover:bg-red-500/10"
              : "text-text-1 hover:bg-accent/10 hover:text-accent"
          }`}
          onClick={() => { item.onClick(); onClose(); }}
        >
          {item.icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}
