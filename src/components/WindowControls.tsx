import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useI18n } from "../i18n";

const win = getCurrentWindow();

export default function WindowControls() {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(true);

  useEffect(() => {
    const unlistenFocus = win.onFocusChanged(({ payload }) => {
      setFocused(payload);
    });
    return () => { unlistenFocus.then((fn) => fn()); };
  }, []);

  const gray = "#CDCDCD";
  const colors = focused
    ? { close: "#FF5F57", minimize: "#FEBC2E", maximize: "#28C840" }
    : { close: gray, minimize: gray, maximize: gray };

  return (
    <div
      className="flex items-center gap-[8px] shrink-0 pl-3 pr-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Close */}
      <button
        className="w-[13px] h-[13px] rounded-full flex items-center justify-center cursor-pointer border-[0.5px] border-black/10"
        style={{ backgroundColor: colors.close }}
        onClick={(e) => { e.stopPropagation(); win.close(); }}
        data-tip={t("window.close")}
      >
        {hovered && focused && (
          <svg className="w-[7px] h-[7px]" viewBox="0 0 7 7">
            <path d="M1 1l5 5M6 1L1 6" stroke="#4D0000" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {/* Minimize */}
      <button
        className="w-[13px] h-[13px] rounded-full flex items-center justify-center cursor-pointer border-[0.5px] border-black/10"
        style={{ backgroundColor: colors.minimize }}
        onClick={(e) => { e.stopPropagation(); win.minimize(); }}
        data-tip={t("window.minimize")}
      >
        {hovered && focused && (
          <svg className="w-[7px] h-[7px]" viewBox="0 0 7 7">
            <path d="M1 3.5h5" stroke="#985712" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {/* Maximize */}
      <button
        className="w-[13px] h-[13px] rounded-full flex items-center justify-center cursor-pointer border-[0.5px] border-black/10"
        style={{ backgroundColor: colors.maximize }}
        onClick={async (e) => {
          e.stopPropagation();
          (await win.isMaximized()) ? win.unmaximize() : win.maximize();
        }}
        data-tip={t("window.maximize")}
      >
        {hovered && focused && (
          <svg className="w-[7px] h-[7px]" viewBox="0 0 7 7">
            <path d="M1 1h2.5v2.5M6 6H3.5V3.5" stroke="#006500" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </button>
    </div>
  );
}
