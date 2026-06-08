import { createStore } from 'zustand/vanilla';
import { loadSettings, saveSettings } from '../services/settingsCommands';
import { toErrorMessage } from '../utils/errors';

let settingsStore: ReturnType<typeof createSettingsStoreInternal> | null = null;

export type OutputDirectoryStrategy = 'same-as-source' | 'custom';

export type PersistedSettings = {
  theme: 'dark' | 'light';
  language: 'zh-CN' | 'en-US';
  maxConcurrency: number;
  outputDirectoryStrategy: OutputDirectoryStrategy;
  rememberLastParams: boolean;
};

export type SettingsState = PersistedSettings & {
  isLoading: boolean;
  errorMessage: string | null;
  load: () => Promise<PersistedSettings | null>;
  updateSettings: (partial: Partial<PersistedSettings>) => Promise<PersistedSettings | null>;
};

export const DEFAULT_SETTINGS: PersistedSettings = {
  theme: 'light',
  language: 'zh-CN',
  maxConcurrency: 2,
  outputDirectoryStrategy: 'same-as-source',
  rememberLastParams: false
};

const createSettingsStoreInternal = () => {
  return createStore<SettingsState>((set, get) => ({
    ...DEFAULT_SETTINGS,
    isLoading: false,
    errorMessage: null,
    load: async () => {
      set({ isLoading: true, errorMessage: null });

      try {
        const settings = await loadSettings();
        set({ ...settings, isLoading: false, errorMessage: null });
        return settings;
      } catch (error) {
        set({ isLoading: false, errorMessage: toErrorMessage(error) });
        return null;
      }
    },
    updateSettings: async (partial) => {
      const state = get();
      const nextSettings: PersistedSettings = {
        theme: partial.theme ?? state.theme,
        language: partial.language ?? state.language,
        maxConcurrency: partial.maxConcurrency ?? state.maxConcurrency,
        outputDirectoryStrategy: partial.outputDirectoryStrategy ?? state.outputDirectoryStrategy,
        rememberLastParams: partial.rememberLastParams ?? state.rememberLastParams
      };

      try {
        const savedSettings = await saveSettings(nextSettings);
        set({ ...savedSettings, errorMessage: null });
        return savedSettings;
      } catch (error) {
        set({ errorMessage: toErrorMessage(error) });
        return null;
      }
    }
  }));
};

export const createSettingsStore = () => {
  if (!settingsStore) {
    settingsStore = createSettingsStoreInternal();
  }

  return settingsStore;
};
