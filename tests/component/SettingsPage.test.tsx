import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../../src/pages/SettingsPage';
import { DEFAULT_SETTINGS } from '../../src/stores/settingsStore';
import { getSettingsStore } from '../../src/hooks/useSettingsStore';

const loadedSettings = DEFAULT_SETTINGS;

const { loadSettings, saveSettings } = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn()
}));

const { getAppCacheUsage, clearAppCache } = vi.hoisted(() => ({
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

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSettings.mockResolvedValue(loadedSettings);
    saveSettings.mockImplementation(async (settings) => settings);
    getAppCacheUsage.mockResolvedValue({
      downloadThumbnailBytes: 1024 * 1024,
      editorWorkingBytes: 512 * 1024,
      editorThumbnailBytes: 256 * 1024,
      totalBytes: 1792 * 1024
    });
    clearAppCache.mockResolvedValue({
      downloadThumbnailBytes: 0,
      editorWorkingBytes: 0,
      editorThumbnailBytes: 0,
      totalBytes: 0
    });
  });

  it('saves theme and language changes from the settings page', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    const lightThemeButton = screen.getByRole('button', { name: '浅色模式' });
    const languageSelect = screen.getByLabelText('语言设置');

    await user.click(lightThemeButton);
    await user.selectOptions(languageSelect, 'en-US');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(saveSettings).toHaveBeenLastCalledWith({
        ...loadedSettings,
        theme: 'light',
        language: 'en-US'
      });
    });
  });

  it('keeps edits local until the user clicks save', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    const maxConcurrencyInput = await screen.findByLabelText('最大并发任务数');
    const outputStrategySelect = screen.getByLabelText('默认输出目录策略');
    const rememberToggle = screen.getByRole('button', { name: '切换图片时保留调整参数' });

    fireEvent.change(maxConcurrencyInput, { target: { value: '4' } });
    await user.selectOptions(outputStrategySelect, 'custom');
    await user.click(rememberToggle);

    expect(saveSettings).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '保存设置' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '保存设置' }));

    await waitFor(() => {
      expect(saveSettings).toHaveBeenLastCalledWith({
        ...loadedSettings,
        maxConcurrency: 4,
        outputDirectoryStrategy: 'custom',
        rememberLastParams: true
      });
    });
  });

  it('restores the loaded values when the user resets the draft', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    const maxConcurrencyInput = await screen.findByLabelText('最大并发任务数');
    const rememberToggle = screen.getByRole('button', { name: '切换图片时保留调整参数' });

    fireEvent.change(maxConcurrencyInput, { target: { value: '5' } });
    await user.click(rememberToggle);
    await user.click(screen.getByRole('button', { name: '恢复默认设置' }));

    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(rememberToggle).toHaveAttribute('aria-pressed', 'false');
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('removes the heavy page header copy and moves actions to the page footer', async () => {
    render(<SettingsPage />);

    await screen.findByLabelText('语言设置');

    expect(screen.queryByRole('heading', { level: 1, name: '设置中心' })).not.toBeInTheDocument();
    expect(screen.queryByText('管理全局默认值与批量任务执行方式')).not.toBeInTheDocument();

    const pageShell = screen.getByTestId('settings-page-shell');
    expect(pageShell.className).toContain('p-5');
    expect(pageShell.className).not.toContain('p-8');

    const footerActions = screen.getByTestId('settings-actions-footer');
    expect(within(footerActions).getByRole('button', { name: '恢复默认设置' })).toBeInTheDocument();
    expect(within(footerActions).getByRole('button', { name: '保存设置' })).toBeInTheDocument();

    const generalTitle = screen.getByText('界面与任务设置');
    expect(generalTitle.className).toContain('mb-2');
    expect(screen.getByText('图片编辑偏好').className).toContain('mb-4');
    expect(screen.getByText('关于软件').className).toContain('mb-2');
    expect(screen.getByText('缓存').className).toContain('mb-2');

    const concurrencyControl = screen.getByTestId('settings-concurrency-control');
    expect(concurrencyControl.className).toContain('max-w-[280px]');
    expect(screen.getByTestId('settings-editor-card')).toBeInTheDocument();
  });

  it('lays out the about card identity horizontally', async () => {
    render(<SettingsPage />);

    const aboutIdentity = await screen.findByTestId('about-app-identity');
    expect(aboutIdentity.className).toContain('items-center');
    const logo = within(aboutIdentity).getByAltText('imageasy logo');
    expect(logo.getAttribute('src')).toBe('/brand/logo.png');
    expect(logo.className).toContain('w-14');
    expect(aboutIdentity.className).toContain('gap-3');
    expect(within(aboutIdentity).getByText('imageasy')).toBeInTheDocument();
    expect(within(aboutIdentity).getByText('v1.0.0')).toBeInTheDocument();
  });

  it('opens a contact dialog from the about card', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    const contactTrigger = await screen.findByRole('button', { name: '联系方式' });
    await user.click(contactTrigger);

    const dialog = screen.getByRole('dialog', { name: '联系方式' });
    expect(within(dialog).getByText('heheyouchen@outlook.com')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });

  it('applies the selected theme through the app shell without page-local theme animation', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    const shell = await screen.findByTestId('settings-page-shell');
    expect(shell).not.toHaveAttribute('data-theme');
    expect(shell.className).not.toContain('fade-in');

    await user.click(await screen.findByRole('button', { name: '深色模式' }));
    expect(getSettingsStore().getState().theme).toBe('dark');

    await user.click(screen.getByRole('button', { name: '浅色模式' }));
    expect(getSettingsStore().getState().theme).toBe('light');
  });

  it('renders English static copy after switching language in settings', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    await user.selectOptions(await screen.findByLabelText('语言设置'), 'en-US');

    expect(screen.queryByRole('heading', { level: 1, name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByText('System preferences and global defaults')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-actions-footer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore Defaults' })).toBeInTheDocument();
    expect(screen.getByText('Interface & Task')).toBeInTheDocument();
    expect(screen.getByText('App Theme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
    expect(screen.getByLabelText('Max Concurrent Tasks')).toBeInTheDocument();
    expect(screen.getByLabelText('Default Output Strategy')).toBeInTheDocument();
    expect(screen.getByText('Editing Preferences')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retain parameters on switch' })).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contact' })).toBeInTheDocument();
  });

  it('shows cache usage and clears app cache', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    expect(await screen.findByText('缓存')).toBeInTheDocument();
    expect(screen.getByText('1.8 MB')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清理缓存' }));

    await waitFor(() => expect(clearAppCache).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('0 B')).toBeInTheDocument();
  });

  it('shows English cache copy after switching language', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);
    await user.selectOptions(await screen.findByLabelText('语言设置'), 'en-US');

    expect(await screen.findByText('Cache')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Cache' })).toBeInTheDocument();
  });
});
