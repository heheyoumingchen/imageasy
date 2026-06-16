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
