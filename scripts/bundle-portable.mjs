/**
 * 绿色版（免安装/便携版）打包脚本
 *
 * 在 `pnpm tauri:build` 完成后运行，将编译产物打包为免安装 zip。
 * 产物放置在 src-tauri/target/release/bundle/portable/ 目录。
 *
 * 用法：node scripts/bundle-portable.mjs
 */

import { createWriteStream, existsSync, mkdirSync, statSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const TAURI_DIR = join(PROJECT_ROOT, 'src-tauri');
const RELEASE_DIR = join(TAURI_DIR, 'target', 'release');
const BUNDLE_DIR = join(RELEASE_DIR, 'bundle', 'portable');

const EXE_NAME = 'imageasy.exe';
const APP_NAME = 'imageasy';

// 读取版本号
async function getVersion() {
  const { readFileSync } = await import('node:fs');
  const conf = JSON.parse(readFileSync(join(TAURI_DIR, 'tauri.conf.json'), 'utf8'));
  return conf.version || '0.1.0';
}

// 复制目录（递归）
function copyDirSync(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// 简单 zip 创建（使用 PowerShell）
async function createZip(sourceDir, zipPath) {
  const { execSync } = await import('node:child_process');
  // 删除已有 zip
  if (existsSync(zipPath)) {
    const { unlinkSync } = await import('node:fs');
    unlinkSync(zipPath);
  }
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
}

async function main() {
  const version = await getVersion();
  const portableDir = join(BUNDLE_DIR, APP_NAME);

  console.log(`[bundle-portable] 开始打包绿色版 v${version}...`);

  // 检查编译产物
  const exePath = join(RELEASE_DIR, EXE_NAME);
  if (!existsSync(exePath)) {
    console.error(`[bundle-portable] 未找到编译产物: ${exePath}`);
    console.error('[bundle-portable] 请先运行 pnpm tauri:build');
    process.exit(1);
  }

  // 清理并创建目标目录
  const { rmSync } = await import('node:fs');
  if (existsSync(portableDir)) {
    rmSync(portableDir, { recursive: true, force: true });
  }
  mkdirSync(portableDir, { recursive: true });

  // 1. 复制主程序
  copyFileSync(exePath, join(portableDir, EXE_NAME));
  console.log(`[bundle-portable] ✓ ${EXE_NAME}`);

  // 2. 复制 WebView2Loader.dll（如果存在）
  const webview2 = join(RELEASE_DIR, 'WebView2Loader.dll');
  if (existsSync(webview2)) {
    copyFileSync(webview2, join(portableDir, 'WebView2Loader.dll'));
    console.log('[bundle-portable] ✓ WebView2Loader.dll');
  }

  // 3. 复制 pdfium 资源
  const pdfiumDir = join(TAURI_DIR, 'pdfium');
  if (existsSync(pdfiumDir)) {
    copyDirSync(pdfiumDir, join(portableDir, 'pdfium'));
    console.log('[bundle-portable] ✓ pdfium/');
  }

  // 4. 复制 Office 文档渲染 sidecar（Tauri 会按 target triple 命名）
  const helperCandidates = [
    join(RELEASE_DIR, 'document-renderer-helper.exe'),
    join(RELEASE_DIR, 'document-renderer-helper'),
  ];
  // also pick up any triple-suffixed sidecar next to the main binary if tauri placed it there
  for (const file of readdirSync(RELEASE_DIR)) {
    if (file.startsWith('document-renderer-helper')) {
      helperCandidates.push(join(RELEASE_DIR, file));
    }
  }
  let helperCopied = false;
  for (const helperPath of helperCandidates) {
    if (existsSync(helperPath) && statSync(helperPath).isFile()) {
      copyFileSync(helperPath, join(portableDir, basename(helperPath)));
      console.log(`[bundle-portable] ✓ ${basename(helperPath)}`);
      helperCopied = true;
    }
  }
  if (!helperCopied) {
    console.warn('[bundle-portable] 警告: 未找到 document-renderer-helper，Office 文档转换将不可用');
  }

  // 5. 复制其他 dll 依赖（release 目录中的 .dll 文件）
  for (const file of readdirSync(RELEASE_DIR)) {
    if (file.endsWith('.dll') && file !== 'WebView2Loader.dll') {
      const fullPath = join(RELEASE_DIR, file);
      if (statSync(fullPath).isFile()) {
        copyFileSync(fullPath, join(portableDir, file));
        console.log(`[bundle-portable] ✓ ${file}`);
      }
    }
  }

  // 6. 创建 .portable 标记文件（激活便携模式）
  writeFileSync(join(portableDir, '.portable'), '');
  console.log('[bundle-portable] ✓ .portable 标记文件');

  // 7. 创建空的 data 和 cache 目录
  mkdirSync(join(portableDir, 'data'), { recursive: true });
  mkdirSync(join(portableDir, 'cache'), { recursive: true });
  console.log('[bundle-portable] ✓ data/ cache/ 目录');

  // 8. 打包为 zip
  const zipName = `${APP_NAME}_${version}_x64_portable.zip`;
  const zipPath = join(BUNDLE_DIR, zipName);
  console.log(`[bundle-portable] 正在压缩为 ${zipName}...`);
  await createZip(portableDir, zipPath);

  console.log(`[bundle-portable] ✓ 绿色版打包完成!`);
  console.log(`[bundle-portable]   输出: ${zipPath}`);
  console.log(`[bundle-portable]   大小: ${(statSync(zipPath).size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((error) => {
  console.error(`[bundle-portable] ${error.message}`);
  process.exit(1);
});
