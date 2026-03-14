import { useEffect, useRef, useCallback } from "react";

interface PPTViewProps {
  content: string;
  onExit: () => void;
}

const isDark = () =>
  document.documentElement.getAttribute("data-theme") === "dark";

/**
 * PPT mode — iframe-based Reveal.js, same approach as MiaoYan's WebView.
 * Uses CSS fixed overlay (ppt-fullscreen), no window resize needed.
 * Ctrl+4 to enter, Escape to exit.
 */
export default function PPTView({ content, onExit }: PPTViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "ppt-exit") onExit();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("message", handleMessage);
    };
  }, [onExit]);

  const handleLoad = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "ppt-init", content, dark: isDark() },
      "*",
    );
    iframeRef.current?.focus();
  }, [content]);

  return (
    <div className="ppt-fullscreen">
      <iframe
        ref={iframeRef}
        src="/ppt.html"
        onLoad={handleLoad}
        style={{ width: "100%", height: "100%", border: "none" }}
        title="PPT"
      />
    </div>
  );
}
