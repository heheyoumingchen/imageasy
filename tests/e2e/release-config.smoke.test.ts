import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import tauriConfig from '../../src-tauri/tauri.conf.json';
import capabilities from '../../src-tauri/capabilities/default.json';
import packageJson from '../../package.json';

/**
 * 发布配置冒烟：在无安装包产物时也能守住关键打包/权限契约。
 */
describe('e2e smoke: release config contracts', () => {
  it('keeps product identity and sidecar packaging declarations', () => {
    expect(packageJson.name).toBe('imageasy');
    expect(tauriConfig.productName).toBe('imageasy');
    expect(tauriConfig.identifier).toBe('com.imageasy.desktop');
    expect(tauriConfig.identifier).not.toContain('anthropic');
    expect(tauriConfig.bundle.externalBin).toContain('binaries/document-renderer-helper');
    expect(tauriConfig.app.security.csp).toBeTruthy();
    expect(tauriConfig.app.security.assetProtocol.scope).not.toContain('**');
  });

  it('declares shell execute permission for the document renderer sidecar', () => {
    const permissions = capabilities.permissions as Array<string | { identifier: string; allow?: unknown[] }>;
    const shellPermission = permissions.find(
      (entry) => typeof entry === 'object' && entry.identifier === 'shell:allow-execute'
    );

    expect(shellPermission).toBeTruthy();
    if (typeof shellPermission === 'object' && Array.isArray(shellPermission.allow)) {
      const names = JSON.stringify(shellPermission.allow);
      expect(names).toContain('document-renderer-helper');
    }
  });

  it('keeps portable and sidecar staging scripts available', () => {
    expect(existsSync(join(process.cwd(), 'scripts/bundle-portable.mjs'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'scripts/stage-sidecar.mjs'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'scripts/ensure-sidecar.mjs'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'scripts/smoke-bundle.mjs'))).toBe(true);

    const packageText = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    expect(packageText).toContain('smoke:bundle');
    expect(packageText).toContain('test:e2e');
  });
});
