import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../../src/pages/SettingsPage';

const { loadSettings, saveSettings } = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn()
}));

vi.mock('../../src/services/settingsCommands', () => ({
  loadSettings,
  saveSettings
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSettings.mockResolvedValue({
      theme: 'dark',
      language: 'zh-CN',
      maxConcurrency: 2,
      outputDirectoryStrategy: 'same-as-source',
      rememberLastParams: false
    });
    saveSettings.mockImplementation(async (settings) => settings);
  });

  it('loads settings from Tauri and saves form changes', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    expect(await screen.findByText('设置中心')).toBeInTheDocument();
    expect(loadSettings).toHaveBeenCalledTimes(1);

    const maxConcurrencyInput = screen.getByLabelText('最大并发任务数');
    const outputStrategySelect = screen.getByLabelText('默认输出目录策略');
    const rememberCheckbox = screen.getByLabelText('记住上次参数');

    await user.clear(maxConcurrencyInput);
    await user.type(maxConcurrencyInput, '4');
    await user.selectOptions(outputStrategySelect, 'custom');
    await user.click(rememberCheckbox);

    await waitFor(() => {
      expect(saveSettings).toHaveBeenLastCalledWith({
        theme: 'dark',
        language: 'zh-CN',
        maxConcurrency: 4,
        outputDirectoryStrategy: 'custom',
        rememberLastParams: true
      });
    });

    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    expect(rememberCheckbox).toBeChecked();
  });

  it('renders app-wide setting sections for editing and batch work', async () => {
    render(<SettingsPage />);

    expect(await screen.findByText('常规设置')).toBeInTheDocument();
    expect(screen.getByText('图片编辑')).toBeInTheDocument();
    expect(screen.getByText('批量任务')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '与源文件同目录' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '每次手动选择' })).toBeInTheDocument();
  });
});
