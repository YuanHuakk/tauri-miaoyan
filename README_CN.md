<h4 align="right"><strong><a href="https://github.com/YuanHuakk/tauri-miaoyan/blob/main/README.md">English</a></strong> | 简体中文</h4>

<p align="center">
<table align="center" border="0" cellpadding="0" cellspacing="0"><tr>
  <td><a href="https://miaoyan.app/" target="_blank"><img src="https://gw.alipayobjects.com/zos/k/t0/43.png" width="100" /></a></td>
  <td>&nbsp;&nbsp;<strong>✖</strong>&nbsp;&nbsp;</td>
  <td><img src="src-tauri/icons/icon.png" width="100" alt="妙言跨平台版图标" /></td>
</tr></table>

  <h1 align="center">妙言</h1>
  <div align="center">
    <img alt="Windows" src="https://img.shields.io/badge/Windows-10%2B-blue?style=flat-square&logo=windows">
    <img alt="macOS" src="https://img.shields.io/badge/macOS-10.15%2B-orange?style=flat-square&logo=apple">
    <img alt="Linux" src="https://img.shields.io/badge/Linux-supported-yellow?style=flat-square&logo=linux">
    <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-blue?style=flat-square&logo=tauri">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
  </div>
  <div align="center">轻灵的跨平台 Markdown 笔记本，基于 Tauri 2 构建</div>
</p>

## 关于

妙言（跨平台版）基于原版 [妙言](https://github.com/tw93/MiaoYan) 使用 [Tauri 2](https://v2.tauri.app/) 构建的跨平台版本，保留了极简设计理念，同时将体验带到 Windows、macOS 和 Linux。

## 特点

- **跨平台** — 一套代码，原生运行于 Windows、macOS、Linux
- **轻量** — Tauri 2 + Rust 后端，安装包远小于 Electron 应用
- **分栏编辑** — 编辑与预览并排显示，实时渲染，滚动同步
- **丰富语法** — GFM、LaTeX (KaTeX)、Mermaid 图表、代码高亮、Emoji
- **PPT 模式** — 用 `---` 分隔符将 Markdown 变为幻灯片演示
- **深色模式** — 浅色 / 深色 / 跟随系统，平滑切换
- **多语言** — 简体中文、繁体中文、English、日本語
- **AI 辅助** — 内置 AI 写作工具：续写、改写、润色、摘要（兼容 OpenAI API）
- **全文搜索** — 跨文件夹快速检索笔记
- **模板** — 空白笔记、会议记录、待办清单、日记、博客文章
- **图片支持** — 拖拽插入、剪贴板粘贴、可选云端上传
- **文件监听** — 外部修改笔记时自动刷新
- **高度自定义** — 字体、字号、预览宽度、快捷键、窗口置顶等
- **本地优先** — 数据全部存储在本地，无需账号，不收集任何数据

## 技术栈

| 层级   | 技术                                                |
| ------ | --------------------------------------------------- |
| 框架   | [Tauri 2](https://v2.tauri.app/)                    |
| 后端   | Rust（文件操作、搜索、图片处理、AI 代理、文件监听） |
| 前端   | React 19 + TypeScript                               |
| 编辑器 | [CodeMirror 6](https://codemirror.net/)             |
| 预览   | react-markdown + rehype/remark 插件                 |
| 样式   | [Tailwind CSS 4](https://tailwindcss.com/)          |
| 构建   | Vite 7                                              |

## 安装

### 下载安装

从 [GitHub Releases](https://github.com/YuanHuakk/tauri-miaoyan/releases/latest) 下载最新安装包：

| 平台    | 文件                    |
| ------- | ----------------------- |
| Windows | `.msi` 或 `.exe` (NSIS) |
| macOS   | `.dmg`                  |
| Linux   | `.deb` / `.AppImage`    |

### 从源码构建

前置条件：

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)（stable）
- Tauri 2 系统依赖 — 参见 [Tauri 环境准备](https://v2.tauri.app/start/prerequisites/)

```bash
# 克隆仓库
git clone https://github.com/YuanHuakk/tauri-miaoyan.git
cd tauri-miaoyan

# 安装依赖
pnpm install

# 开发模式
pnpm tauri dev

# 构建
pnpm tauri build
```

## 快捷键

| 快捷键       | 功能                           |
| ------------ | ------------------------------ |
| `Ctrl/⌘ + P` | 搜索笔记                       |
| `Ctrl/⌘ + N` | 新建笔记（模板选择）           |
| `Ctrl/⌘ + S` | 保存                           |
| `Ctrl/⌘ + \` | 切换侧边栏                     |
| `Ctrl/⌘ + 2` | 切换笔记列表                   |
| `Ctrl/⌘ + 4` | 切换 PPT 模式                  |
| `Ctrl/⌘ + D` | 切换外观（浅色 → 深色 → 系统） |
| `Ctrl/⌘ + ,` | 打开设置                       |
| `F11`        | 全屏切换                       |

## 项目结构

```
tauri-MiaoYan/
├── src/                    # 前端（React + TypeScript）
│   ├── components/         # UI 组件
│   │   ├── Editor.tsx      # CodeMirror 编辑器
│   │   ├── Preview.tsx     # Markdown 预览
│   │   ├── PPTView.tsx     # 演示模式
│   │   ├── Sidebar.tsx     # 文件夹树
│   │   ├── NoteList.tsx    # 笔记列表
│   │   ├── SearchPanel.tsx # 全文搜索
│   │   ├── SettingsPanel.tsx
│   │   └── ...
│   ├── api.ts              # Tauri 命令绑定
│   ├── i18n.ts             # 国际化
│   ├── types.ts            # TypeScript 类型
│   └── App.tsx             # 主应用
├── src-tauri/              # 后端（Rust）
│   ├── src/
│   │   ├── notes.rs        # 文件操作、搜索、导出
│   │   ├── watcher.rs      # 文件系统监听
│   │   ├── ai.rs           # AI 补全代理
│   │   ├── fullscreen.rs   # 全屏切换
│   │   └── lib.rs          # Tauri 命令注册
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

## 致谢

- [tw93/MiaoYan](https://github.com/tw93/MiaoYan) — 原版 macOS Markdown 笔记本，本项目的灵感来源
- [Tauri](https://tauri.app/) — 跨平台应用框架
- [CodeMirror](https://codemirror.net/) — 代码编辑器组件
- [react-markdown](https://github.com/remarkjs/react-markdown) — Markdown 渲染

## 协议

MIT License
