import { createStore } from 'zustand/vanilla';
import { loadSettings, saveSettings } from '../services/settingsCommands';

export type OutputDirectoryStrategy = 'same-as-source' | 'custom';

export type PersistedSettings = {
  theme: 'dark';
  language: 'zh-CN';
  maxConcurrency: number;
  outputDirectoryStrategy: OutputDirectoryStrategy;
  rememberLastParams: boolean;
};

export type SettingsState = PersistedSettings & {
  isLoading: boolean;
  errorMessage: string | null;
  load: () => Promise<void>;
  updateSettings: (partial: Partial<PersistedSettings>) => Promise<void>;
};

export const DEFAULT_SETTINGS: PersistedSettings = {
  theme: 'dark',
  language: 'zh-CN',
  maxConcurrency: 2,
  outputDirectoryStrategy: 'same-as-source',
  rememberLastParams: false
};

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const createSettingsStore = () => {
  return createStore<SettingsState>((set, get) => ({
    ...DEFAULT_SETTINGS,
    isLoading: false,
    errorMessage: null,
    load: async () => {
      set({ isLoading: true, errorMessage: null });

      try {
        const settings = await loadSettings();
        set({ ...settings, isLoading: false, errorMessage: null });
      } catch (error) {
        set({ isLoading: false, errorMessage: toErrorMessage(error) });
      }
    },
    updateSettings: async (partial) => {
      const state = get();
      const nextSettings: PersistedSettings = {
        theme: state.theme,
        language: state.language,
        maxConcurrency: partial.maxConcurrency ?? state.maxConcurrency,
        outputDirectoryStrategy: partial.outputDirectoryStrategy ?? state.outputDirectoryStrategy,
        rememberLastParams: partial.rememberLastParams ?? state.rememberLastParams
      };

      try {
        const savedSettings = await saveSettings(nextSettings);
        set({ ...savedSettings, errorMessage: null });
      } catch (error) {
        set({ errorMessage: toErrorMessage(error) });
      }
    }
  }));
};
