import { createStore } from 'zustand/vanilla';
import { loadSettings, saveSettings } from '../services/settingsCommands';
import { toErrorMessage } from '../utils/errors';

let settingsStore: ReturnType<typeof createSettingsStoreInternal> | null = null;

export type OutputDirectoryStrategy = 'same-as-source' | 'custom';

export type NamingPattern = 'source-name-index' | 'source-name-date';

export type ConversionTaskSettings = {
  namingPattern: NamingPattern;
  outputFormat: 'jpg' | 'png' | 'webp';
  colorMode: 'rgb' | 'cmyk' | 'gray-cmyk';
  quality: number;
};

export type ExtractionTaskSettings = {
  namingPattern: NamingPattern;
  outputFormat: 'png' | 'jpg';
  colorMode: 'rgb' | 'cmyk' | 'gray-cmyk';
};

export type SplittingTaskSettings = {
  namingPattern: NamingPattern;
  outputFormat: 'jpg' | 'png' | 'webp';
  quality: number;
};

export type StitchingTaskSettings = {
  namingPattern: NamingPattern;
  outputFormat: 'jpg' | 'png' | 'webp';
  quality: number;
};

export type PersistedSettings = {
  theme: 'dark' | 'light';
  language: 'zh-CN' | 'en-US';
  maxConcurrency: number;
  outputDirectoryStrategy: OutputDirectoryStrategy;
  rememberLastParams: boolean;
  conversion: ConversionTaskSettings;
  extraction: ExtractionTaskSettings;
  splitting: SplittingTaskSettings;
  stitching: StitchingTaskSettings;
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
  rememberLastParams: false,
  conversion: {
    namingPattern: 'source-name-index',
    outputFormat: 'jpg',
    colorMode: 'rgb',
    quality: 100
  },
  extraction: {
    namingPattern: 'source-name-index',
    outputFormat: 'jpg',
    colorMode: 'rgb'
  },
  splitting: {
    namingPattern: 'source-name-index',
    outputFormat: 'png',
    quality: 100
  },
  stitching: {
    namingPattern: 'source-name-index',
    outputFormat: 'jpg',
    quality: 100
  }
};

// 旧版本持久化文件可能缺少新增的任务设置分区，按默认值补全后再写入 store。
const normalizeSettings = (settings: Partial<PersistedSettings> | null | undefined): PersistedSettings => ({
  theme: settings?.theme ?? DEFAULT_SETTINGS.theme,
  language: settings?.language ?? DEFAULT_SETTINGS.language,
  maxConcurrency: settings?.maxConcurrency ?? DEFAULT_SETTINGS.maxConcurrency,
  outputDirectoryStrategy: settings?.outputDirectoryStrategy ?? DEFAULT_SETTINGS.outputDirectoryStrategy,
  rememberLastParams: settings?.rememberLastParams ?? DEFAULT_SETTINGS.rememberLastParams,
  conversion: { ...DEFAULT_SETTINGS.conversion, ...settings?.conversion },
  extraction: { ...DEFAULT_SETTINGS.extraction, ...settings?.extraction },
  splitting: { ...DEFAULT_SETTINGS.splitting, ...settings?.splitting },
  stitching: { ...DEFAULT_SETTINGS.stitching, ...settings?.stitching }
});

const createSettingsStoreInternal = () => {
  return createStore<SettingsState>((set, get) => ({
    ...DEFAULT_SETTINGS,
    isLoading: false,
    errorMessage: null,
    load: async () => {
      set({ isLoading: true, errorMessage: null });

      try {
        const settings = normalizeSettings(await loadSettings());
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
        rememberLastParams: partial.rememberLastParams ?? state.rememberLastParams,
        conversion: partial.conversion ?? state.conversion,
        extraction: partial.extraction ?? state.extraction,
        splitting: partial.splitting ?? state.splitting,
        stitching: partial.stitching ?? state.stitching
      };

      try {
        const savedSettings = normalizeSettings(await saveSettings(nextSettings));
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
