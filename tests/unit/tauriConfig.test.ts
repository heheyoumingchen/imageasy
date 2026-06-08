import { describe, expect, it } from 'vitest';
import tauriConfig from '../../src-tauri/tauri.conf.json';

describe('tauri window sizing', () => {
  it('uses the revised default and minimum window sizes', () => {
    const mainWindow = tauriConfig.app.windows[0];

    expect(mainWindow.width).toBe(1280);
    expect(mainWindow.height).toBe(832);
    expect(mainWindow.minWidth).toBe(960);
    expect(mainWindow.minHeight).toBe(640);
  });

  it('uses imageasy for the bundled product and window title', () => {
    const mainWindow = tauriConfig.app.windows[0];

    expect(tauriConfig.productName).toBe('imageasy');
    expect(mainWindow.title).toBe('imageasy');
  });

  it('declares bundled icon assets for tauri builds', () => {
    expect(tauriConfig.bundle.icon).toEqual([
      'icons/32x32.png',
      'icons/128x128.png',
      'icons/128x128@2x.png',
      'icons/icon.png',
      'icons/icon.icns',
      'icons/icon.ico'
    ]);
  });
});
