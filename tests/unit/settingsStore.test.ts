import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsStore, DEFAULT_SETTINGS } from '../../src/stores/settingsStore';

const loadedSettings = {
  ...DEFAULT_SETTINGS,
  maxConcurrency: 6,
  outputDirectoryStrategy: 'custom',
  defaultOutputDirectory: '/saved/output',
  rememberLastParams: true
} as const;

const savedSettings = {
  ...DEFAULT_SETTINGS,
  maxConcurrency: 4,
  outputDirectoryStrategy: 'custom',
  defaultOutputDirectory: '/saved/output',
  rememberLastParams: true
} as const;

const { loadSettings, saveSettings } = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn()
}));

vi.mock('../../src/services/settingsCommands', () => ({
  loadSettings,
  saveSettings
}));

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 单例 store 在测试间共享，重置回默认值避免用例互相污染。
    createSettingsStore().setState({ ...DEFAULT_SETTINGS });
  });

  it('uses defaults before settings are loaded from Tauri', () => {
    const store = createSettingsStore();

    expect(store.getState()).toEqual(expect.objectContaining(DEFAULT_SETTINGS));
    expect(store.getState().isLoading).toBe(false);
  });

  it('loads persisted settings through the Tauri settings command', async () => {
    loadSettings.mockResolvedValue(loadedSettings);
    const store = createSettingsStore();

    await store.getState().load();

    expect(loadSettings).toHaveBeenCalledTimes(1);
    expect(store.getState()).toEqual(
      expect.objectContaining({
        maxConcurrency: 6,
        outputDirectoryStrategy: 'custom',
        defaultOutputDirectory: '/saved/output',
        rememberLastParams: true,
        isLoading: false,
        errorMessage: null
      })
    );
  });

  it('normalizes legacy gray-cmyk export color mode to grayscale', async () => {
    loadSettings.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      exportSettings: { ...DEFAULT_SETTINGS.exportSettings, colorMode: 'gray-cmyk' }
    });
    const store = createSettingsStore();

    const settings = await store.getState().load();

    expect(settings?.exportSettings.colorMode).toBe('grayscale');
    expect(store.getState().exportSettings.colorMode).toBe('grayscale');
  });

  it('saves updated settings through the Tauri settings command', async () => {
    saveSettings.mockResolvedValue(savedSettings);
    const store = createSettingsStore();

    await store.getState().updateSettings({
      maxConcurrency: 4,
      outputDirectoryStrategy: 'custom',
      defaultOutputDirectory: '/saved/output',
      rememberLastParams: true
    });

    expect(saveSettings).toHaveBeenCalledWith(savedSettings);
    expect(store.getState()).toEqual(
      expect.objectContaining({
        maxConcurrency: 4,
        outputDirectoryStrategy: 'custom',
        defaultOutputDirectory: '/saved/output',
        rememberLastParams: true,
        errorMessage: null
      })
    );
  });
});
