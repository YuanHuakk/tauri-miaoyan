import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  css: { devSourcemap: false },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          codemirror: [
            "@codemirror/autocomplete",
            "@codemirror/commands",
            "@codemirror/lang-markdown",
            "@codemirror/language",
            "@codemirror/language-data",
            "@codemirror/search",
            "@codemirror/state",
            "@codemirror/view",
            "@lezer/highlight",
          ],
          markdown: [
            "react-markdown",
            "rehype-highlight",
            "rehype-katex",
            "rehype-raw",
            "rehype-slug",
            "remark-breaks",
            "remark-emoji",
            "remark-gfm",
            "remark-math",
          ],
          katex: ["katex"],
          mermaid: ["mermaid"],
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
