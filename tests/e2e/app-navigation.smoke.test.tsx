import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { DEFAULT_SETTINGS } from '../../src/stores/settingsStore';

const { loadSettings, saveSettings, getAppCacheUsage, clearAppCache } = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  getAppCacheUsage: vi.fn(),
  clearAppCache: vi.fn()
}));

vi.mock('../../src/services/settingsCommands', () => ({
  loadSettings,
  saveSettings
}));

vi.mock('../../src/services/cacheCommands', () => ({
  getAppCacheUsage,
  clearAppCache
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: vi.fn().mockResolvedValue(() => {})
  })
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    startDragging: vi.fn()
  })
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {})
}));

/**
 * 前端路由冒烟：不启动 Tauri 进程，但覆盖懒加载页面切换主路径。
 * 真实安装包冒烟见 scripts/smoke-bundle.mjs + pnpm smoke:bundle。
 */
describe('e2e smoke: app navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSettings.mockResolvedValue(DEFAULT_SETTINGS);
    saveSettings.mockImplementation(async (settings) => settings);
    getAppCacheUsage.mockResolvedValue({
      downloadThumbnailBytes: 0,
      editorWorkingBytes: 0,
      editorThumbnailBytes: 0,
      editorPreviewBytes: 0,
      stitchingThumbnailBytes: 0,
      totalBytes: 0
    });
    clearAppCache.mockResolvedValue({
      downloadThumbnailBytes: 0,
      editorWorkingBytes: 0,
      editorThumbnailBytes: 0,
      editorPreviewBytes: 0,
      stitchingThumbnailBytes: 0,
      totalBytes: 0
    });
  });

  it('lazy-loads each primary workspace from the side nav', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(loadSettings).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: '打开' }, { timeout: 5000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '格式转换' }));
    expect(await screen.findByRole('button', { name: '开始转换' }, { timeout: 5000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '图片提取' }));
    expect(await screen.findByRole('button', { name: '开始提取' }, { timeout: 5000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '图片分割' }));
    expect(await screen.findByRole('button', { name: '分割图片' }, { timeout: 5000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '图片拼接' }));
    expect(await screen.findByRole('button', { name: '下载' }, { timeout: 5000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '图片下载' }));
    expect(await screen.findByRole('heading', { name: '提取结果' }, { timeout: 5000 })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '设置' })[0]);
    expect(await screen.findByTestId('settings-actions-footer', undefined, { timeout: 5000 })).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(within(nav).queryByRole('button', { name: '任务中心' })).not.toBeInTheDocument();
  });
});
