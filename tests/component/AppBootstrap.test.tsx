import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { DEFAULT_SETTINGS } from '../../src/stores/settingsStore';

const loadedSettings = DEFAULT_SETTINGS;

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

describe('App bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSettings.mockResolvedValue(loadedSettings);
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

  it('renders the redesign shell with image editor selected by default', async () => {
    render(<App />);

    await waitFor(() => expect(loadSettings).toHaveBeenCalledTimes(1));

    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(within(nav).getByRole('button', { name: '图片编辑' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: '格式转换' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: '图片提取' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: '图片下载' })).toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: '转换图片' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: '提取图片' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: '任务中心' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: '设置' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '设置' })).toHaveLength(1);
    expect(screen.queryByText('美')).not.toBeInTheDocument();

    const topChrome = screen.getAllByRole('banner')[0];
    expect(within(topChrome).getByText('imageasy')).toBeInTheDocument();
    expect(within(topChrome).queryByText('desktop workflow studio')).not.toBeInTheDocument();
    expect(within(topChrome).queryByText('图片编辑工作区')).not.toBeInTheDocument();
    expect(within(topChrome).queryByText('Tauri v2')).not.toBeInTheDocument();
    expect(within(topChrome).queryByText('React 19')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '编辑调色面板' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('keeps only the custom top chrome content after the window shell polish', async () => {
    render(<App />);

    await waitFor(() => expect(loadSettings).toHaveBeenCalledTimes(1));

    const topChrome = screen.getAllByRole('banner')[0];
    expect(within(topChrome).getByText('imageasy')).toBeInTheDocument();
    expect(within(topChrome).queryByText('desktop workflow studio')).not.toBeInTheDocument();
    expect(within(topChrome).getAllByRole('button')).toHaveLength(3);
    expect(topChrome.className).toContain('h-12');
    expect(topChrome.className).not.toContain('shadow-sm');
  });

  it('updates the top bar subtitle for convert extract and settings pages', async () => {
    const user = userEvent.setup();
    render(<App />);

    const topChrome = screen.getAllByRole('banner')[0];
    expect(within(topChrome).queryByText('图片编辑工作区')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '格式转换' }));
    expect(within(topChrome).queryByText('批量转换工作区')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '图片提取' }));
    expect(within(topChrome).queryByText('文档图片提取工作区')).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '设置' })[0]);
    expect(within(topChrome).queryByText('设置与偏好')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: '设置中心' })).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-actions-footer')).toBeInTheDocument();
  });

  it('switches to the unified conversion workbench from navigation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '格式转换' }));

    expect(screen.getByRole('button', { name: '添加文件' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '导入文件夹' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始转换' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '转换设置区' })).toBeInTheDocument();
  });

  it('opens the image download workspace from navigation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '图片下载' }));

    expect(screen.queryByRole('heading', { level: 1, name: '图片下载' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '网页图片下载' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '微信公众号图片下载' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '提取结果' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始提取' })).toBeInTheDocument();
  });

  it('applies the saved language to the extraction workspace text after saving settings', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: '设置' })[0]);
    await user.selectOptions(await screen.findByLabelText('语言设置'), 'en-US');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await user.click(await screen.findByRole('button', { name: 'Extract' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Extraction' })).not.toBeInTheDocument();
      expect(screen.queryByText('Extract image assets from Word or PDF documents in batch.')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Import documents' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start extraction' })).toBeDisabled();
    });
  });

  it('falls back to the editor when persisted page state points to removed task center', async () => {
    vi.resetModules();
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react');
      let stateCallCount = 0;

      return {
        ...actual,
        useState: (<T,>(initialState: T) => {
          stateCallCount += 1;
          return actual.useState(stateCallCount === 1 ? ('task-center' as T) : initialState);
        }) as typeof actual.useState
      };
    });

    const { default: AppWithRemovedPageState } = await import('../../src/App');

    render(<AppWithRemovedPageState />);

    await waitFor(() => expect(loadSettings).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('button', { name: '打开' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: '任务中心' })).not.toBeInTheDocument();
  });
});
