import { useState, useEffect, useRef, useCallback } from "react";
import type { SearchResult } from "../types";
import { useI18n } from "../i18n";
import * as api from "../api";

interface SearchPanelProps {
  rootPath: string;
  visible: boolean;
  onClose: () => void;
  onOpenNote: (path: string) => void;
}

export default function SearchPanel({ rootPath, visible, onClose, onOpenNote }: SearchPanelProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    try {
      const res = await api.searchNotes(rootPath, q);
      setResults(res);
      setSelectedIndex(0);
    } catch (err) { console.error("Search failed:", err); }
  }, [rootPath]);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(value), 200);
  }, [doSearch]);

  const handleSelect = useCallback((path: string) => {
    onOpenNote(path);
    onClose();
  }, [onOpenNote, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results.length > 0) {
      handleSelect(results[selectedIndex].path);
    }
  }, [onClose, results, selectedIndex, handleSelect]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15%]" onClick={onClose}>
      <div
        className="w-[560px] bg-bg rounded-xl shadow-2xl border border-divider overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-divider">
          <svg className="w-4 h-4 text-text-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            className="flex-1 text-[15px] text-text-1 bg-transparent outline-none placeholder:text-text-3"
            placeholder={t("search.placeholder")}
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="text-[11px] text-text-3 bg-bg-sidebar px-1.5 py-0.5 rounded border border-divider">ESC</kbd>
        </div>
        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-[320px] overflow-y-auto py-1">
            {results.map((r, i) => (
              <div
                key={r.path + r.lineNumber}
                className={`px-4 py-2 cursor-pointer transition-colors ${
                  i === selectedIndex ? "bg-accent/10" : "hover:bg-bg-hover"
                }`}
                onClick={() => handleSelect(r.path)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="text-[13px] font-medium text-text-1 truncate">{r.title}</div>
                <div className="text-[12px] text-text-3 truncate mt-0.5">{r.matchLine}</div>
              </div>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="py-8 text-center text-[13px] text-text-3">{t("search.noResult")}</div>
        )}
      </div>
    </div>
  );
}
