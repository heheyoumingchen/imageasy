<div align="center">

# imageasy

**A lightweight desktop app for batch image processing — image processing, made easy.**

[![CI](https://github.com/heheyoumingchen/imageasy/actions/workflows/ci.yml/badge.svg)](https://github.com/heheyoumingchen/imageasy/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/heheyoumingchen/imageasy)](https://github.com/heheyoumingchen/imageasy/releases)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)](./README.en.md#-download)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%20v2-24C8DB)](https://v2.tauri.app/)

[简体中文](./README.md) | English

[Download](#-download) · [Features](#-features) · [Build from Source](#-build-from-source) · [Tech Stack](#-tech-stack) · [FAQ](#-faq)

</div>

---

## ✨ Introduction

**imageasy** (image + easy) is a local desktop app built with Tauri v2, offering one-stop batch processing for everyday image workflows: format conversion, image extraction from documents, splitting & stitching, and web image downloading. Everything runs locally — no files are ever uploaded.

- 🚀 **Native performance** — Rust backend with multithreaded parallel processing
- 🔒 **Local-first** — all processing happens on your machine; no data collection
- 🪶 **Lightweight** — Tauri packaging keeps the installer small and memory usage low
- 🌏 **Bilingual UI** — switch between 中文 / English in one click

## 📦 Features

| Module | Description |
| --- | --- |
| 🖌️ **Image Editing** | Lightweight editing for everyday adjustments — no heavy photo editor needed |
| 🔄 **Batch Format Conversion** | Export as **JPG / PNG / WebP** with **RGB / CMYK / Grayscale CMYK** color modes, for both screen and print |
| 📤 **Image Extraction** | Batch-extract embedded images from **PDF, PPT, and Word** documents |
| ✂️ **Image Splitting** | Works with **images and PDFs**; horizontal / vertical / grid split modes |
| 🧩 **Image Stitching** | Multiple layout templates with customizable rows & columns |
| 🌐 **Image Download** | Batch-download images from **websites** and **WeChat Official Account** articles |
| ⚙️ **Settings** | 中文 / English UI language, default output directory strategy, cache usage view & one-click cleanup |

## 📥 Download

Grab the latest build from the [**Releases**](https://github.com/heheyoumingchen/imageasy/releases) page:

| Platform | Package | Notes |
| --- | --- | --- |
| Windows 10+ (x64) | `imageasy_x.y.z_x64-setup.exe` | Installer (NSIS) |
| Windows 10+ (x64) | `imageasy_x.y.z_portable.zip` | Portable, unzip and run |
| macOS (Apple Silicon) | `imageasy_x.y.z_aarch64.dmg` | Standard disk image |
| macOS (Apple Silicon) | `imageasy_x.y.z_macos_arm64_portable.zip` | Portable, unzip and run |

> If SmartScreen (Windows) or Gatekeeper (macOS) warns about an unsigned app, choose "Run anyway" / "Open anyway".

## 🛠 Build from Source

### Prerequisites

| Dependency | Version | Notes |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | ≥ 22 | Frontend build |
| [pnpm](https://pnpm.io/) | 10.33.0 | Package manager (`corepack enable` works out of the box) |
| [Rust](https://rustup.rs/) | stable | Backend & desktop shell |
| Tauri v2 system deps | — | Windows: WebView2 (built into the OS); macOS: Xcode Command Line Tools |

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/heheyoumingchen/imageasy.git
cd imageasy

# 2. Install dependencies
pnpm install

# 3. Fetch the PDFium runtime (required for PDF split / extract)
pnpm stage:pdfium

# 4. Develop
pnpm tauri:dev

# 5. Build for release
pnpm tauri:build        # Windows: NSIS installer
pnpm tauri:portable     # Windows: portable build
pnpm exec tauri build --bundles app dmg   # macOS: app + dmg
```

### Testing

```bash
pnpm typecheck                                   # TypeScript type check
pnpm test                                        # Frontend unit tests (Vitest)
pnpm test:e2e                                    # Frontend E2E smoke tests
cargo test --manifest-path src-tauri/Cargo.toml  # Rust unit tests
```

Pushes and PRs automatically run [CI](.github/workflows/ci.yml) (typecheck, unit tests, E2E smoke, production build, Rust checks).

## 🏗 Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Zustand 5 · lucide-react |
| Desktop shell | Tauri v2 · tauri-plugin-dialog |
| Backend (Rust) | `image` codecs · `pdfium-render` PDF rendering · `lopdf` PDF embedded-image extraction · `rayon` parallelism · `tokio` async · `ureq` downloads · `zip` Office media extraction · `windows` COM (Word/WPS, Windows only) |
| Packaging | NSIS installer / portable (Windows) · app / dmg (macOS) · PDFium runtime bundled |

## ❓ FAQ

<details>
<summary><b>PDF features report PDF_RENDERER_NOT_AVAILABLE?</b></summary>

PDF splitting and extraction rely on the PDFium dynamic library. In development, run `pnpm stage:pdfium` to fetch it automatically, or download the matching build from [pdfium-binaries](https://github.com/bblanchon/pdfium-binaries/releases) and place it in `src-tauri/target/<debug|release>/pdfium/`. Official installers ship with it bundled.
</details>

<details>
<summary><b>Anything to know about CMYK output?</b></summary>

Batch conversion can export CMYK / Grayscale CMYK JPGs for print workflows. For on-screen use, prefer RGB-mode JPG / PNG / WebP.
</details>

<details>
<summary><b>Platform limits for Word / PPT extraction?</b></summary>

Word / WPS extraction uses Windows COM and is currently **Windows-only**. PDF extraction works on both Windows and macOS.
</details>

<details>
<summary><b>What are the boundaries of the web / WeChat article downloader?</b></summary>

Only download images you are authorized to obtain and use, and respect the target site's terms of service and applicable laws. Do not use it to bypass paywalls or copyright restrictions.
</details>

## 🤝 Contributing

Issues and Pull Requests are welcome:

1. Fork the repo and create a feature branch (`git checkout -b feat/your-feature`)
2. Make sure `pnpm typecheck && pnpm test` and `cargo test` pass before committing
3. Open a Pull Request describing your changes

## 📄 License

This project is licensed under [AGPL-3.0](./LICENSE). See also [NOTICE](./NOTICE).

> Per the NOTICE: the code of this project must not be used to train any machine learning or AI models.

---

<div align="center">

If imageasy helps you, consider giving it a ⭐!

</div>
