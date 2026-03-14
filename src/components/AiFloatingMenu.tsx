import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import type { AiAction } from "../types";

interface AiFloatingMenuProps {
  x: number;
  y: number;
  loading: boolean;
  onAction: (action: AiAction) => void;
  onClose: () => void;
}

// Each action gets a distinct multi-element SVG icon
function ActionIcon({ action }: { action: AiAction }) {
  const cls = "w-3.5 h-3.5 shrink-0";
  switch (action) {
    case "continue":
      // Arrow-right-to-line: continue writing
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
        </svg>
      );
    case "rewrite":
      // Pencil-line: rewrite
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
    case "polish":
      // Sparkles: polish/enhance
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.936A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.962 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.582a.5.5 0 010 .962L15.5 14.063a2 2 0 00-1.437 1.437l-1.582 6.135a.5.5 0 01-.962 0z" />
          <path d="M20 3v4" /><path d="M22 5h-4" />
        </svg>
      );
    case "summarize":
      // List-collapse: summarize
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" /><path d="M3 12h12" /><path d="M3 18h8" />
        </svg>
      );
  }
}

const AI_ACTIONS: AiAction[] = ["continue", "rewrite", "polish", "summarize"];

export default function AiFloatingMenu({ x, y, loading, onAction, onClose }: AiFloatingMenuProps) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    if (rect.right > vw) menuRef.current.style.left = `${vw - rect.width - 8}px`;
    if (rect.left < 0) menuRef.current.style.left = "8px";
    if (rect.top < 0) menuRef.current.style.top = "8px";
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-9999 flex items-center gap-0.5 px-1 py-0.5 rounded-lg shadow-lg border border-divider bg-bg-sidebar/95 backdrop-blur-sm animate-dialog-in"
      style={{ left: x, top: y }}
    >
      {/* AI badge */}
      <span className="px-1.5 py-0.5 text-[10px] font-medium text-accent select-none">AI</span>
      <div className="w-px h-4 bg-divider" />
      {AI_ACTIONS.map((action) => (
        <button
          key={action}
          className="flex items-center gap-1 px-2 py-1 text-[12px] text-text-2 rounded-md cursor-pointer transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-40 disabled:cursor-default"
          title={t(`ai.${action}`)}
          disabled={loading}
          onClick={() => onAction(action)}
        >
          <ActionIcon action={action} />
          <span>{t(`ai.${action}`).replace("AI ", "")}</span>
        </button>
      ))}
    </div>
  );
}
