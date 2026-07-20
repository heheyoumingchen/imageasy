/**
 * 将 release/debug 产物中的 document-renderer-helper 复制为 Tauri externalBin 约定命名。
 *
 * Tauri 约定：externalBin 路径为 `binaries/document-renderer-helper`，
 * 构建时会按目标三元组寻找 `document-renderer-helper-<target-triple>[.exe]`。
 *
 * 开发模式额外复制到 target/<profile>/，保证 app.shell().sidecar() 能找到同目录 helper。
 *
 * 用法：
 *   node scripts/stage-sidecar.mjs
 *   node scripts/stage-sidecar.mjs --profile debug
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const TAURI_DIR = join(PROJECT_ROOT, 'src-tauri');
const BINARIES_DIR = join(TAURI_DIR, 'binaries');
const HELPER_BASENAME = 'document-renderer-helper';

function parseArgs(argv) {
  let profile = 'release';
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--profile' && argv[i + 1]) {
      profile = argv[i + 1];
      i += 1;
    }
  }
  return { profile };
}

function detectTargetTriple() {
  if (process.env.TAURI_ENV_TARGET_TRIPLE) {
    return process.env.TAURI_ENV_TARGET_TRIPLE;
  }
  if (process.env.CARGO_BUILD_TARGET) {
    return process.env.CARGO_BUILD_TARGET;
  }
  try {
    return execSync('rustc --print host-tuple', { encoding: 'utf8' }).trim();
  } catch {
    try {
      return execSync('rustc -vV', { encoding: 'utf8' })
        .split(/\r?\n/)
        .find((line) => line.startsWith('host: '))
        ?.slice('host: '.length)
        .trim();
    } catch {
      return null;
    }
  }
}

function main() {
  const { profile } = parseArgs(process.argv.slice(2));
  const triple = detectTargetTriple();
  if (!triple) {
    console.error('[stage-sidecar] 无法检测 Rust target triple');
    process.exit(1);
  }

  const ext = process.platform === 'win32' ? '.exe' : '';
  const profileDir = join(TAURI_DIR, 'target', profile);
  const source = join(profileDir, `${HELPER_BASENAME}${ext}`);
  if (!existsSync(source)) {
    console.error(`[stage-sidecar] 未找到 helper 产物: ${source}`);
    console.error(
      `[stage-sidecar] 请先编译：cargo build --manifest-path src-tauri/Cargo.toml --bin document-renderer-helper${
        profile === 'release' ? ' --release' : ''
      }`
    );
    process.exit(1);
  }

  mkdirSync(BINARIES_DIR, { recursive: true });
  const stagedName = `${HELPER_BASENAME}-${triple}${ext}`;
  const destBinaries = join(BINARIES_DIR, stagedName);
  copyFileSync(source, destBinaries);
  console.log(`[stage-sidecar] copied ${source} -> ${destBinaries}`);

  // Tauri dev 从 target/<profile>/imageasy.exe 启动，sidecar 需同目录可见。
  const destNextToExe = join(profileDir, stagedName);
  copyFileSync(source, destNextToExe);
  console.log(`[stage-sidecar] copied ${source} -> ${destNextToExe}`);
}

main();
