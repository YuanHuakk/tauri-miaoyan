import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";

interface ConfirmDialogProps {
  message: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ message, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onConfirm, onCancel]);

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center" onClick={onCancel}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-bg rounded-xl shadow-2xl border border-divider px-6 py-5 max-w-[320px] w-full mx-4 animate-dialog-in"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[14px] text-text-1 leading-[1.6] text-center">{message}</p>
        <div className="flex gap-3 mt-5">
          <button
            className="flex-1 h-[34px] rounded-lg text-[13px] font-medium border border-divider text-text-1 hover:bg-bg-hover cursor-pointer transition-colors"
            onClick={onCancel}
          >
            {t("dialog.cancel")}
          </button>
          <button
            className={`flex-1 h-[34px] rounded-lg text-[13px] font-medium cursor-pointer transition-colors ${
              danger
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-accent text-white hover:opacity-90"
            }`}
            onClick={onConfirm}
          >
            {t("dialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
