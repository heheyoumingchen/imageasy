import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNTIME_FILE_BY_PLATFORM = {
  win32: 'pdfium.dll',
  darwin: 'libpdfium.dylib',
};

const PLATFORM_LABEL = {
  win32: 'windows',
  darwin: 'macos',
};

export async function stagePdfium({ binDir, platform, stageDir }) {
  if (!binDir || binDir.trim() === '') {
    throw new Error(
      'PDFIUM_BIN_DIR 未设置：请将其指向包含 PDFium 运行库的目录后再执行打包。',
    );
  }

  const fileName = RUNTIME_FILE_BY_PLATFORM[platform];
  if (!fileName) {
    throw new Error(
      `当前平台 ${platform} 不在支持范围 (windows / macos)，无法定位 PDFium 运行库。`,
    );
  }

  const resolvedBinDir = resolve(binDir);
  if (!existsSync(resolvedBinDir) || !statSync(resolvedBinDir).isDirectory()) {
    throw new Error(
      `PDFIUM_BIN_DIR 指向的目录不存在或无效：${resolvedBinDir}`,
    );
  }

  const sourcePath = join(resolvedBinDir, fileName);
  if (!existsSync(sourcePath)) {
    throw new Error(
      `当前平台 ${PLATFORM_LABEL[platform]} 需要 ${fileName}，但在 ${resolvedBinDir} 中未找到。`,
    );
  }

  const resolvedStageDir = resolve(stageDir);
  mkdirSync(resolvedStageDir, { recursive: true });

  const destPath = join(resolvedStageDir, fileName);
  copyFileSync(sourcePath, destPath);

  return { sourcePath, destPath, fileName };
}

const isCli = (() => {
  if (!process.argv[1]) return false;
  try {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isCli) {
  const projectRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
  stagePdfium({
    binDir: process.env.PDFIUM_BIN_DIR,
    platform: process.platform,
    stageDir: join(projectRoot, 'src-tauri', 'pdfium'),
  })
    .then(({ sourcePath, destPath }) => {
      console.log(`[stage-pdfium] copied ${sourcePath} -> ${destPath}`);
    })
    .catch((error) => {
      console.error(`[stage-pdfium] ${error.message}`);
      process.exit(1);
    });
}
