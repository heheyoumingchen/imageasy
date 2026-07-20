/**
 * 安装包 / 便携包冒烟检查（不启动 GUI）。
 *
 * 在 `pnpm tauri:build` 或 `pnpm tauri:portable` 后运行：
 *   node scripts/smoke-bundle.mjs
 *
 * 校验：
 * - release 主程序存在
 * - document-renderer-helper sidecar 存在（externalBin 命名）
 * - pdfium 资源存在
 * - 可选：portable 目录 / NSIS 安装包存在时做存在性检查
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const TAURI_DIR = join(PROJECT_ROOT, 'src-tauri');
const RELEASE_DIR = join(TAURI_DIR, 'target', 'release');
const BUNDLE_DIR = join(RELEASE_DIR, 'bundle');

const failures = [];
const notes = [];

const requireFile = (path, label) => {
  if (!existsSync(path) || !statSync(path).isFile()) {
    failures.push(`missing ${label}: ${path}`);
    return false;
  }
  notes.push(`ok ${label}: ${path}`);
  return true;
};

const requireDir = (path, label) => {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    failures.push(`missing ${label}: ${path}`);
    return false;
  }
  notes.push(`ok ${label}: ${path}`);
  return true;
};

const main = () => {
  const exePath = join(RELEASE_DIR, 'imageasy.exe');
  if (!existsSync(exePath)) {
    console.error('[smoke-bundle] release 产物不存在，请先运行 pnpm tauri:build');
    console.error(`[smoke-bundle] expected: ${exePath}`);
    process.exit(2);
  }

  requireFile(exePath, 'main exe');

  // Tauri externalBin 在 Windows 上产出 *-x86_64-pc-windows-msvc.exe 或同名 sidecar。
  const binariesDir = join(TAURI_DIR, 'binaries');
  const releaseSidecars = readdirSync(RELEASE_DIR).filter((name) =>
    name.startsWith('document-renderer-helper')
  );
  const stagedSidecars = existsSync(binariesDir)
    ? readdirSync(binariesDir).filter((name) => name.startsWith('document-renderer-helper'))
    : [];

  if (releaseSidecars.length === 0 && stagedSidecars.length === 0) {
    failures.push('document-renderer-helper sidecar not found in release/ or src-tauri/binaries/');
  } else {
    notes.push(`ok sidecar candidates: ${[...releaseSidecars, ...stagedSidecars].join(', ')}`);
  }

  const pdfiumCandidates = [
    join(RELEASE_DIR, 'pdfium', 'pdfium.dll'),
    join(TAURI_DIR, 'pdfium', 'pdfium.dll'),
    join(RELEASE_DIR, 'pdfium.dll')
  ];
  if (!pdfiumCandidates.some((path) => existsSync(path))) {
    failures.push(`pdfium.dll not found in: ${pdfiumCandidates.join(' | ')}`);
  } else {
    notes.push('ok pdfium.dll present');
  }

  const nsisDir = join(BUNDLE_DIR, 'nsis');
  if (existsSync(nsisDir)) {
    const installers = readdirSync(nsisDir).filter((name) => name.endsWith('.exe'));
    if (installers.length === 0) {
      notes.push('nsis dir exists but no .exe installer found (optional)');
    } else {
      notes.push(`ok nsis installers: ${installers.join(', ')}`);
    }
  } else {
    notes.push('nsis bundle not present (optional until tauri:build finishes packaging)');
  }

  const portableDir = join(BUNDLE_DIR, 'portable', 'imageasy');
  if (existsSync(portableDir)) {
    requireDir(portableDir, 'portable app dir');
    requireFile(join(portableDir, 'imageasy.exe'), 'portable main exe');
    const portableFiles = readdirSync(portableDir);
    if (!portableFiles.some((name) => name.includes('document-renderer-helper'))) {
      failures.push('portable package missing document-renderer-helper');
    } else {
      notes.push('ok portable contains document-renderer-helper');
    }
  } else {
    notes.push('portable package not present (optional until tauri:portable)');
  }

  for (const note of notes) {
    console.log(`[smoke-bundle] ${note}`);
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`[smoke-bundle] FAIL ${failure}`);
    }
    process.exit(1);
  }

  console.log('[smoke-bundle] all checks passed');
};

main();
