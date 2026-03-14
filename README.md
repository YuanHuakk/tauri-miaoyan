<h4 align="right">English | <strong><a href="https://github.com/YuanHuakk/tauri-miaoyan/blob/main/README_CN.md">简体中文</a></strong></h4>

<table align="center" border="0" cellpadding="0" cellspacing="0"><tr>
  <td><a href="https://miaoyan.app/" target="_blank"><img src="https://gw.alipayobjects.com/zos/k/t0/43.png" width="100" /></a></td>
  <td>&nbsp;&nbsp;<strong>✖</strong>&nbsp;&nbsp;</td>
  <td><img src="src-tauri/icons/icon.png" width="100" alt="MiaoYan Cross-Platform Icon" /></td>
</tr></table>
  <h1 align="center">MiaoYan</h1>
  <div align="center">
    <img alt="Windows" src="https://img.shields.io/badge/Windows-10%2B-blue?style=flat-square&logo=windows">
    <img alt="macOS" src="https://img.shields.io/badge/macOS-10.15%2B-orange?style=flat-square&logo=apple">
    <img alt="Linux" src="https://img.shields.io/badge/Linux-supported-yellow?style=flat-square&logo=linux">
    <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-blue?style=flat-square&logo=tauri">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
  </div>
  <div align="center">Lightweight cross-platform Markdown note-taking app, powered by Tauri 2</div>
</p>

## About

MiaoYan (Cross-Platform Edition) is built on top of the original [MiaoYan](https://github.com/tw93/MiaoYan) using [Tauri 2](https://v2.tauri.app/), preserving its minimalist design philosophy while bringing the experience to Windows, macOS, and Linux.

## Features

- **Cross-Platform** — Native app for Windows, macOS, and Linux with a single codebase
- **Lightweight** — Tauri 2 + Rust backend, much smaller bundle size than Electron apps
- **Split Editor & Preview** — Side-by-side editing with real-time Markdown preview and scroll sync
- **Rich Markdown** — GFM, LaTeX (KaTeX), Mermaid diagrams, code highlighting, emoji
- **PPT Mode** — Present your Markdown as slides using `---` separators
- **Dark Mode** — Light / Dark / System appearance with smooth transitions
- **i18n** — Simplified Chinese, Traditional Chinese, English, Japanese
- **AI Assist** — Built-in AI writing tools: continue, rewrite, polish, summarize (OpenAI-compatible API)
- **Full-text Search** — Quickly find notes across all folders
- **Templates** — Blank, meeting notes, todo list, journal, blog post
- **Image Support** — Drag & drop images, paste from clipboard, optional cloud upload
- **File Watcher** — Auto-refresh when notes are modified externally
- **Customizable** — Fonts, font sizes, preview width, keyboard shortcuts, always-on-top, and more
- **Local-first** — All data stored locally, no account required, no data collection

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri 2](https://v2.tauri.app/) |
| Backend | Rust (file I/O, search, image handling, AI proxy, file watcher) |
| Frontend | React 19 + TypeScript |
| Editor | [CodeMirror 6](https://codemirror.net/) |
| Preview | react-markdown + rehype/remark plugins |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| Build | Vite 7 |

## Installation

### Download

Download the latest installer from [GitHub Releases](https://github.com/YuanHuakk/tauri-miaoyan/releases/latest):

| Platform | File |
|----------|------|
| Windows | `.msi` or `.exe` (NSIS) |
| macOS | `.dmg` |
| Linux | `.deb` / `.AppImage` |

### Build from Source

Prerequisites:
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Tauri 2 system dependencies — see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

```bash
# Clone
git clone https://github.com/YuanHuakk/tauri-miaoyan.git
cd tauri-miaoyan

# Install dependencies
pnpm install

# Development
pnpm tauri dev

# Build
pnpm tauri build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/⌘ + P` | Search notes |
| `Ctrl/⌘ + N` | New note (template picker) |
| `Ctrl/⌘ + S` | Save |
| `Ctrl/⌘ + \` | Toggle sidebar |
| `Ctrl/⌘ + 2` | Toggle note list |
| `Ctrl/⌘ + 4` | Toggle PPT mode |
| `Ctrl/⌘ + D` | Cycle appearance (Light → Dark → System) |
| `Ctrl/⌘ + ,` | Settings |
| `F11` | Toggle fullscreen |

## Project Structure

```
tauri-MiaoYan/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components
│   │   ├── Editor.tsx      # CodeMirror editor
│   │   ├── Preview.tsx     # Markdown preview
│   │   ├── PPTView.tsx     # Presentation mode
│   │   ├── Sidebar.tsx     # Folder tree
│   │   ├── NoteList.tsx    # Note list
│   │   ├── SearchPanel.tsx # Full-text search
│   │   ├── SettingsPanel.tsx
│   │   └── ...
│   ├── api.ts              # Tauri command bindings
│   ├── i18n.ts             # Internationalization
│   ├── types.ts            # TypeScript types
│   └── App.tsx             # Main app
├── src-tauri/              # Backend (Rust)
│   ├── src/
│   │   ├── notes.rs        # File operations, search, export
│   │   ├── watcher.rs      # File system watcher
│   │   ├── ai.rs           # AI completion proxy
│   │   ├── fullscreen.rs   # Fullscreen toggle
│   │   └── lib.rs          # Tauri command registration
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

## Acknowledgments

- [tw93/MiaoYan](https://github.com/tw93/MiaoYan) — The original macOS Markdown notebook that inspired this project
- [Tauri](https://tauri.app/) — Cross-platform app framework
- [CodeMirror](https://codemirror.net/) — Code editor component
- [react-markdown](https://github.com/remarkjs/react-markdown) — Markdown rendering

## License

MIT License
