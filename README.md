<div align="center">

# imageasy

**轻量级桌面图片批量处理工具 —— 让批量图片处理，更简单。**

[![CI](https://github.com/heheyoumingchen/imageasy/actions/workflows/ci.yml/badge.svg)](https://github.com/heheyoumingchen/imageasy/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/heheyoumingchen/imageasy)](https://github.com/heheyoumingchen/imageasy/releases)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)](./README.md#-下载安装)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%20v2-24C8DB)](https://v2.tauri.app/)

简体中文 | [English](./README.en.md)

<!-- 📸 截图占位：把应用截图放到 docs/screenshots/ 后取消注释并替换文件名
<img src="docs/screenshots/main.png" width="820" alt="imageasy 主界面">
-->

[下载安装](#-下载安装) · [功能一览](#-功能一览) · [从源码构建](#-从源码构建) · [技术栈](#-技术栈) · [常见问题](#-常见问题)

</div>

---

## ✨ 简介

**imageasy**（image + easy）是一款基于 Tauri v2 构建的本地桌面应用，围绕日常高频的图片处理场景提供一站式批量能力：格式转换、文档提图、分割拼接、网页取图，全部在本地完成，不上传任何文件。

- 🚀 **原生性能**：Rust 后端 + 多线程并行处理，批量任务快而不卡
- 🔒 **本地优先**：所有处理均在本地完成，不收集、不上传用户图片
- 🪶 **轻量安装**：Tauri 打包，安装包体积小、内存占用低
- 🌏 **双语界面**：中文 / English 一键切换

## 📦 功能一览

| 模块 | 说明 |
| --- | --- |
| 🖌️ **图片编辑** | 轻度编辑功能，日常调整即开即用，无需打开大型修图软件 |
| 🔄 **格式批量转换** | 输出 **JPG / PNG / WebP**，支持 **RGB / CMYK / 灰度 CMYK** 色彩模式，兼顾屏幕显示与印刷场景 |
| 📤 **图片提取** | 从 **PDF、PPT、Word** 等文档中批量提取内嵌图片，告别逐页另存 |
| ✂️ **图片分割** | 支持**图片与 PDF** 源文件，提供**水平 / 垂直 / 网格**三种分割模式 |
| 🧩 **图片拼接** | 多种布局模板，自定义行列数，多图一键合并 |
| 🌐 **图片下载** | 批量下载**网站**与**微信公众号**文章中的图片 |
| ⚙️ **设置** | 中文 / English 界面语言、默认输出目录策略、缓存占用查看与一键清理 |

## 📥 下载安装

前往 [**Releases**](https://github.com/heheyoumingchen/imageasy/releases) 页面下载对应平台的最新版本：

| 平台 | 安装包 | 说明 |
| --- | --- | --- |
| Windows 10+ (x64) | `imageasy_x.y.z_x64-setup.exe` | 安装版（NSIS 安装向导） |
| Windows 10+ (x64) | `imageasy_x.y.z_portable.zip` | 绿色便携版，解压即用 |
| macOS (Apple Silicon) | `imageasy_x.y.z_aarch64.dmg` | 标准磁盘映像安装 |
| macOS (Apple Silicon) | `imageasy_x.y.z_macos_arm64_portable.zip` | 便携版，解压即用 |

> 首次安装未签名的包时，Windows 可能提示 SmartScreen、macOS 可能提示"无法验证开发者"，选择"仍要运行 / 仍要打开"即可。

## 🛠 从源码构建

### 环境要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | ≥ 22 | 前端构建 |
| [pnpm](https://pnpm.io/) | 10.33.0 | 包管理器（`corepack enable` 可自动启用） |
| [Rust](https://rustup.rs/) | stable | 后端与桌面壳 |
| Tauri v2 系统依赖 | — | Windows 需 WebView2（系统自带）；macOS 需 Xcode Command Line Tools |

### 构建步骤

```bash
# 1. 克隆仓库
git clone https://github.com/heheyoumingchen/imageasy.git
cd imageasy

# 2. 安装依赖
pnpm install

# 3. 拉取 PDFium 渲染库（PDF 分割 / 提取功能需要）
pnpm stage:pdfium

# 4. 开发调试
pnpm tauri:dev

# 5. 构建发布版本
pnpm tauri:build        # Windows：NSIS 安装包
pnpm tauri:portable     # Windows：绿色便携版
pnpm exec tauri build --bundles app dmg   # macOS：app + dmg
```

### 测试

```bash
pnpm typecheck                                   # TypeScript 类型检查
pnpm test                                        # 前端单元测试（Vitest）
pnpm test:e2e                                    # 前端 E2E 冒烟测试
cargo test --manifest-path src-tauri/Cargo.toml  # Rust 单元测试
```

推送与 PR 会自动触发 [CI](.github/workflows/ci.yml)（类型检查、单元测试、E2E 冒烟、生产构建、Rust 检查）。

## 🏗 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Zustand 5 · lucide-react |
| 桌面壳 | Tauri v2 · tauri-plugin-dialog |
| 后端（Rust） | `image` 图像编解码 · `pdfium-render` PDF 渲染 · `lopdf` PDF 内嵌图提取 · `rayon` 并行 · `tokio` 异步 · `ureq` 下载 · `zip` Office 媒体提取 · `windows` COM（Word/WPS，仅 Windows） |
| 打包 | NSIS 安装包 / 便携版（Windows）· app / dmg（macOS）· PDFium 运行库随包分发 |

## ❓ 常见问题

<details>
<summary><b>PDF 相关功能提示 PDF_RENDERER_NOT_AVAILABLE？</b></summary>

PDF 分割与提取依赖 PDFium 动态库。开发环境下执行 `pnpm stage:pdfium` 自动拉取，或从 [pdfium-binaries](https://github.com/bblanchon/pdfium-binaries/releases) 手动下载对应架构的动态库，放到 `src-tauri/target/<debug|release>/pdfium/` 目录。正式安装包已内置，无需处理。
</details>

<details>
<summary><b>CMYK 输出有什么注意事项？</b></summary>

批量转换支持将图片输出为 CMYK / 灰度 CMYK 模式的 JPG，适合印刷交付场景；日常屏幕显示建议使用 RGB 模式的 JPG / PNG / WebP。
</details>

<details>
<summary><b>从 Word / PPT 提取图片有什么平台限制？</b></summary>

Word / WPS 文档提取依赖 Windows COM 组件，目前仅支持 **Windows** 平台；PDF 提取在 Windows 与 macOS 上均可用。
</details>

<details>
<summary><b>网页 / 公众号图片下载功能有什么使用边界？</b></summary>

请仅下载你有权获取和使用的图片内容，遵守目标网站的服务条款与相关法律法规；下载功能不可用于绕过付费或版权限制。
</details>

## 🤝 参与贡献

欢迎提交 [Issue](https://github.com/heheyoumingchen/imageasy/issues) 反馈问题或 [Pull Request](https://github.com/heheyoumingchen/imageasy/pulls) 贡献代码：

1. Fork 本仓库并创建功能分支（`git checkout -b feat/your-feature`）
2. 提交前确保 `pnpm typecheck && pnpm test` 与 `cargo test` 通过
3. 提交 Pull Request 并描述改动内容

## 📄 开源许可

本项目基于 [AGPL-3.0](./LICENSE) 协议开源，另见 [NOTICE](./NOTICE)。

> 根据 NOTICE 声明：本项目代码禁止用于训练任何机器学习或 AI 模型。

---

<div align="center">

如果 imageasy 对你有帮助，欢迎点一个 ⭐ 支持一下！

</div>
