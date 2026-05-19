import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { stagePdfium } from '../../scripts/stage-pdfium.mjs';

describe('stagePdfium', () => {
  let workDir: string;
  let stageDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'pdfium-stage-'));
    stageDir = join(workDir, 'pdfium');
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('fails when PDFIUM_BIN_DIR is unset', async () => {
    await expect(
      stagePdfium({ binDir: undefined, platform: 'win32', stageDir }),
    ).rejects.toThrow(/PDFIUM_BIN_DIR\s*未设置/);
  });

  it('fails when PDFIUM_BIN_DIR points to a nonexistent directory', async () => {
    const missing = join(workDir, 'does-not-exist');
    await expect(
      stagePdfium({ binDir: missing, platform: 'win32', stageDir }),
    ).rejects.toThrow(/不存在/);
  });

  it('fails when the expected runtime file is missing', async () => {
    const binDir = join(workDir, 'bin');
    mkdirSync(binDir);
    await expect(
      stagePdfium({ binDir, platform: 'win32', stageDir }),
    ).rejects.toThrow(/pdfium\.dll/);
  });

  it('copies pdfium.dll on Windows when present', async () => {
    const binDir = join(workDir, 'bin');
    mkdirSync(binDir);
    writeFileSync(join(binDir, 'pdfium.dll'), 'FAKE_DLL_CONTENT');

    const result = await stagePdfium({ binDir, platform: 'win32', stageDir });

    expect(existsSync(join(stageDir, 'pdfium.dll'))).toBe(true);
    expect(readFileSync(join(stageDir, 'pdfium.dll'), 'utf8')).toBe('FAKE_DLL_CONTENT');
    expect(result.fileName).toBe('pdfium.dll');
    expect(result.destPath).toBe(join(stageDir, 'pdfium.dll'));
  });

  it('copies libpdfium.dylib on macOS when present', async () => {
    const binDir = join(workDir, 'bin');
    mkdirSync(binDir);
    writeFileSync(join(binDir, 'libpdfium.dylib'), 'FAKE_DYLIB_CONTENT');

    const result = await stagePdfium({ binDir, platform: 'darwin', stageDir });

    expect(existsSync(join(stageDir, 'libpdfium.dylib'))).toBe(true);
    expect(result.fileName).toBe('libpdfium.dylib');
  });

  it('fails on unsupported platforms', async () => {
    const binDir = join(workDir, 'bin');
    mkdirSync(binDir);
    await expect(
      stagePdfium({ binDir, platform: 'linux', stageDir }),
    ).rejects.toThrow(/平台/);
  });
});
