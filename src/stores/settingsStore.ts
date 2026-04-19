import { createStore } from 'zustand/vanilla';

export type OutputDirectoryStrategy = 'same-as-source' | 'custom';

type PersistedSettings = {
  theme: 'dark';
  language: 'zh-CN';
  maxConcurrency: number;
  outputDirectoryStrategy: OutputDirectoryStrategy;
  rememberLastParams: boolean;
};

export type SettingsState = PersistedSettings & {
  updateSettings: (partial: Partial<PersistedSettings>) => void;
};

export const SETTINGS_STORAGE_KEY = 'image-batch-helper:settings';

const DEFAULT_SETTINGS: PersistedSettings = {
  theme: 'dark',
  language: 'zh-CN',
  maxConcurrency: 2,
  outputDirectoryStrategy: 'same-as-source',
  rememberLastParams: false
};

const readStoredSettings = (): Partial<PersistedSettings> => {
  if (typeof window === 'undefined') {
    return {};
  }

  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as Partial<PersistedSettings>;
};

export const createSettingsStore = () => {
  const initialState: PersistedSettings = {
    ...DEFAULT_SETTINGS,
    ...readStoredSettings()
  };

  return createStore<SettingsState>((set) => ({
    ...initialState,
    updateSettings: (partial) => {
      set((state) => {
        const nextState: PersistedSettings = {
          theme: state.theme,
          language: state.language,
          maxConcurrency: partial.maxConcurrency ?? state.maxConcurrency,
          outputDirectoryStrategy: partial.outputDirectoryStrategy ?? state.outputDirectoryStrategy,
          rememberLastParams: partial.rememberLastParams ?? state.rememberLastParams
        };

        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextState));

        return {
          ...state,
          ...nextState
        };
      });
    }
  }));
};
