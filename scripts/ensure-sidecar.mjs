/**
 * 确保 document-renderer-helper 已按 Tauri externalBin 约定放好。
 *
 * tauri-build 在编译前会检查 binaries/document-renderer-helper-<triple>.exe 是否存在，
 * 但 helper 本身又依赖同一 crate 的 build.rs。因此首次构建需要：
 * 1) 临时去掉 externalBin 编译 helper
 * 2) 再 stage 到 binaries/
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const TAURI_DIR = join(PROJECT_ROOT, 'src-tauri');
const BINARIES_DIR = join(TAURI_DIR, 'binaries');
const CONF_PATH = join(TAURI_DIR, 'tauri.conf.json');
const HELPER_BASENAME = 'document-renderer-helper';

function detectTargetTriple() {
  if (process.env.TAURI_ENV_TARGET_TRIPLE) {
    return process.env.TAURI_ENV_TARGET_TRIPLE;
  }
  try {
    return execSync('rustc --print host-tuple', { encoding: 'utf8' }).trim();
  } catch {
    const hostLine = execSync('rustc -vV', { encoding: 'utf8' })
      .split(/\r?\n/)
      .find((line) => line.startsWith('host: '));
    return hostLine?.slice('host: '.length).trim() ?? null;
  }
}

function stagedPath(triple) {
  const ext = process.platform === 'win32' ? '.exe' : '';
  return join(BINARIES_DIR, `${HELPER_BASENAME}-${triple}${ext}`);
}

function releaseHelperPath() {
  const ext = process.platform === 'win32' ? '.exe' : '';
  return join(TAURI_DIR, 'target', 'release', `${HELPER_BASENAME}${ext}`);
}

function stageFrom(source, triple) {
  mkdirSync(BINARIES_DIR, { recursive: true });
  const dest = stagedPath(triple);
  copyFileSync(source, dest);
  console.log(`[ensure-sidecar] staged ${source} -> ${dest}`);
  return dest;
}

function buildHelperWithoutExternalBin() {
  const original = readFileSync(CONF_PATH, 'utf8');
  const conf = JSON.parse(original);
  const backup = conf.bundle?.externalBin;
  if (conf.bundle) {
    delete conf.bundle.externalBin;
  }
  const tempConfPath = join(TAURI_DIR, 'tauri.conf.bootstrap.json');
  writeFileSync(tempConfPath, JSON.stringify(conf, null, 2));

  try {
    console.log('[ensure-sidecar] building helper without externalBin check...');
    execSync('cargo build --manifest-path src-tauri/Cargo.toml --release --bin document-renderer-helper', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        TAURI_CONFIG: tempConfPath,
      },
    });
  } finally {
    if (existsSync(tempConfPath)) {
      unlinkSync(tempConfPath);
    }
    // 确保原始 conf 未被改写
    writeFileSync(CONF_PATH, original);
    if (backup) {
      // no-op: original already restored
    }
  }
}

function debugHelperPath() {
  const ext = process.platform === 'win32' ? '.exe' : '';
  return join(TAURI_DIR, 'target', 'debug', `${HELPER_BASENAME}${ext}`);
}

function stageNextToProfileExe(source, triple, profile) {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const profileDir = join(TAURI_DIR, 'target', profile);
  if (!existsSync(profileDir)) {
    return;
  }
  const dest = join(profileDir, `${HELPER_BASENAME}-${triple}${ext}`);
  copyFileSync(source, dest);
  console.log(`[ensure-sidecar] staged next to ${profile} exe: ${dest}`);
}

function main() {
  const triple = detectTargetTriple();
  if (!triple) {
    console.error('[ensure-sidecar] 无法检测 target triple');
    process.exit(1);
  }

  const staged = stagedPath(triple);
  const releaseHelper = releaseHelperPath();
  const debugHelper = debugHelperPath();

  // 已 stage 时仍同步到 debug/release 输出目录，避免 tauri dev 找不到 sidecar。
  if (existsSync(staged)) {
    console.log(`[ensure-sidecar] already present: ${staged}`);
    stageNextToProfileExe(staged, triple, 'debug');
    stageNextToProfileExe(staged, triple, 'release');
    return;
  }

  if (existsSync(releaseHelper)) {
    stageFrom(releaseHelper, triple);
    stageNextToProfileExe(releaseHelper, triple, 'debug');
    stageNextToProfileExe(releaseHelper, triple, 'release');
    return;
  }

  if (existsSync(debugHelper)) {
    stageFrom(debugHelper, triple);
    stageNextToProfileExe(debugHelper, triple, 'debug');
    return;
  }

  buildHelperWithoutExternalBin();
  if (!existsSync(releaseHelper)) {
    console.error(`[ensure-sidecar] helper build finished but missing: ${releaseHelper}`);
    process.exit(1);
  }
  stageFrom(releaseHelper, triple);
  stageNextToProfileExe(releaseHelper, triple, 'debug');
  stageNextToProfileExe(releaseHelper, triple, 'release');
}

main();
