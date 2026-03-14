import { useEffect, useRef } from "react";
import { getTemplates } from "../templates";
import { useI18n } from "../i18n";

interface TemplatePanelProps {
  visible: boolean;
  onSelect: (content: string) => void;
  onClose: () => void;
}

export default function TemplatePanel({ visible, onSelect, onClose }: TemplatePanelProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const templates = getTemplates();

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    // Delay to avoid immediate close from the click that opened it
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        ref={panelRef}
        className="bg-bg rounded-lg shadow-lg border border-divider w-[320px] overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-divider">
          <span className="text-[14px] font-medium text-text-1">{t("template.choose")}</span>
        </div>
        <div className="py-1">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              className="w-full text-left px-4 py-2.5 text-[13px] text-text-1 hover:bg-bg-hover cursor-pointer transition-colors flex items-center gap-3"
              onClick={() => { onSelect(tpl.content); onClose(); }}
            >
              <span className="w-6 h-6 flex items-center justify-center rounded bg-bg-selected text-text-2 text-[12px] shrink-0">
                {tpl.id === "blank" && "📄"}
                {tpl.id === "meeting" && "📋"}
                {tpl.id === "todo" && "✅"}
                {tpl.id === "journal" && "📔"}
                {tpl.id === "blog" && "✏️"}
              </span>
              <span>{t(tpl.nameKey)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
