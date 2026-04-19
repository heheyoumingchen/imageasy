import { beforeEach, describe, expect, it } from 'vitest';
import { createSettingsStore, SETTINGS_STORAGE_KEY } from '../../src/stores/settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses defaults when no persisted settings exist', () => {
    const store = createSettingsStore();

    expect(store.getState().theme).toBe('dark');
    expect(store.getState().language).toBe('zh-CN');
    expect(store.getState().maxConcurrency).toBe(2);
    expect(store.getState().outputDirectoryStrategy).toBe('same-as-source');
    expect(store.getState().rememberLastParams).toBe(false);
  });

  it('writes updated settings to localStorage', () => {
    const store = createSettingsStore();

    store.getState().updateSettings({
      maxConcurrency: 4,
      outputDirectoryStrategy: 'custom',
      rememberLastParams: true
    });

    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify({
        theme: 'dark',
        language: 'zh-CN',
        maxConcurrency: 4,
        outputDirectoryStrategy: 'custom',
        rememberLastParams: true
      })
    );
  });

  it('hydrates persisted values during store creation', () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        theme: 'dark',
        language: 'zh-CN',
        maxConcurrency: 6,
        outputDirectoryStrategy: 'custom',
        rememberLastParams: true
      })
    );

    const store = createSettingsStore();

    expect(store.getState().maxConcurrency).toBe(6);
    expect(store.getState().outputDirectoryStrategy).toBe('custom');
    expect(store.getState().rememberLastParams).toBe(true);
  });
});
