import { useEffect, useRef, useState, useMemo, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkEmoji from "remark-emoji";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import Lightense from "lightense-images";
import tocbot from "tocbot";
import "katex/dist/katex.min.css";
import "tocbot/dist/tocbot.css";

interface PreviewProps {
  content: string;
  lineBreak?: "miaoyan" | "github";
  scrollRatio?: number;
  onScrollRatio?: (ratio: number) => void;
}

const MIN_TOC_HEADINGS = 2;
const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";

/** Mermaid code block rendered as React component — avoids direct DOM mutation. */
function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        if (cancelled) return;
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark() ? "dark" : "default",
          securityLevel: "loose",
        });
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const result = await mermaid.render(id, code);
        if (!cancelled) setSvg(result.svg);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (error || svg === null) {
    return error ? (
      <pre><code className="language-mermaid">{code}</code></pre>
    ) : null;
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Custom code renderer — intercepts mermaid blocks, passes others through. */
function CodeBlock(props: ComponentPropsWithoutRef<"code">) {
  const { children, className, ...rest } = props;
  const match = /language-mermaid/.test(className || "");
  if (match) {
    const code = String(children).replace(/\n$/, "");
    return <MermaidBlock code={code} />;
  }
  return <code className={className} {...rest}>{children}</code>;
}

const remarkPluginsBase = [remarkGfm, remarkMath, remarkEmoji];
const rehypePlugins = [rehypeRaw, rehypeSlug, rehypeHighlight, rehypeKatex];

export default function Preview({ content, lineBreak = "miaoyan", scrollRatio, onScrollRatio }: PreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasToc, setHasToc] = useState(false);
  const [tocVisible, setTocVisible] = useState(false);
  const tocInitedRef = useRef(false);
  const isSyncingScroll = useRef(false);
  const onScrollRatioRef = useRef(onScrollRatio);
  onScrollRatioRef.current = onScrollRatio;
  const components = useMemo(() => ({ code: CodeBlock }), []);

  // MiaoYan mode: hard breaks (single \n → <br>), GitHub mode: standard GFM
  const remarkPlugins = useMemo(
    () => lineBreak === "miaoyan" ? [...remarkPluginsBase, remarkBreaks] : remarkPluginsBase,
    [lineBreak],
  );

  // Sync scroll position from editor ratio
  useEffect(() => {
    if (scrollRatio === undefined) return;
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll > 0) {
      isSyncingScroll.current = true;
      el.scrollTop = scrollRatio * maxScroll;
      requestAnimationFrame(() => { isSyncingScroll.current = false; });
    }
  }, [scrollRatio]);

  // Emit scroll ratio when user scrolls preview
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      if (isSyncingScroll.current) return;
      if (!onScrollRatioRef.current) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll > 0) {
        onScrollRatioRef.current(el.scrollTop / maxScroll);
      }
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  // Post-render effects: Lightense image zoom + tocbot
  useEffect(() => {
    const signal = { cancelled: false };

    const rafId = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el || signal.cancelled) return;

      // Image zoom — Lightense
      const imgs = el.querySelectorAll(".markdown-preview img");
      if (imgs.length > 0) {
        Lightense(imgs as NodeListOf<Element>, {
          background: isDark() ? "rgba(35,40,45,0.9)" : "rgba(255,255,255,0.9)",
          padding: 24,
        });
      }

      // TOC — tocbot
      if (tocInitedRef.current) {
        try { tocbot.destroy(); } catch { /* noop */ }
        tocInitedRef.current = false;
      }

      const headings = el.querySelectorAll("h1, h2, h3");
      if (headings.length >= MIN_TOC_HEADINGS) {
        setHasToc(true);
        requestAnimationFrame(() => {
          if (signal.cancelled) return;
          tocbot.init({
            tocSelector: ".toc-body",
            contentSelector: ".markdown-preview",
            headingSelector: "h1, h2, h3",
            hasInnerContainers: true,
            collapseDepth: 3,
            scrollSmooth: true,
            scrollSmoothDuration: 200,
            headingsOffset: 80,
            scrollContainer: "#preview-scroll",
          });
          tocInitedRef.current = true;
        });
      } else {
        setHasToc(false);
      }
    });

    return () => {
      signal.cancelled = true;
      cancelAnimationFrame(rafId);
      if (tocInitedRef.current) {
        try { tocbot.destroy(); } catch { /* noop */ }
        tocInitedRef.current = false;
      }
    };
  }, [content]);

  return (
    <div className="h-full relative">
      <div className="h-full overflow-y-auto" ref={scrollRef} id="preview-scroll">
        <div className="markdown-preview">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={components}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>

      {hasToc && (
        <>
          <div
            className="toc-trigger"
            onMouseEnter={() => setTocVisible(true)}
          />
          <nav
            className={`toc-nav ${tocVisible ? "active" : ""}`}
            onMouseEnter={() => setTocVisible(true)}
            onMouseLeave={() => setTocVisible(false)}
          >
            <div className="toc-body" />
          </nav>
        </>
      )}
    </div>
  );
}
