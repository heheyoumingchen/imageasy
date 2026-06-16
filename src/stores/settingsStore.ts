import { createStore } from 'zustand/vanilla';
import { loadSettings, saveSettings } from '../services/settingsCommands';
import { toErrorMessage } from '../utils/errors';

let settingsStore: ReturnType<typeof createSettingsStoreInternal> | null = null;

export type OutputDirectoryStrategy = 'same-as-source' | 'custom';

export type NamingPattern = 'source-name-index' | 'source-name-date';

export type ExportColorMode = 'rgb' | 'cmyk' | 'gray-cmyk';
export type ExportOutputFormat = 'jpg' | 'png' | 'webp';

// 四个功能（转换 / 提取 / 分割 / 拼接）现已共享同一份导出设置。
export type ExportTaskSettings = {
  namingPattern: NamingPattern;
  outputFormat: ExportOutputFormat;
  colorMode: ExportColorMode;
  quality: number;
};

export type PersistedSettings = {
  theme: 'dark' | 'light';
  language: 'zh-CN' | 'en-US';
  maxConcurrency: number;
  outputDirectoryStrategy: OutputDirectoryStrategy;
  defaultOutputDirectory: string;
  rememberLastParams: boolean;
  exportSettings: ExportTaskSettings;
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
  defaultOutputDirectory: '',
  rememberLastParams: false,
  exportSettings: {
    namingPattern: 'source-name-index',
    outputFormat: 'jpg',
    colorMode: 'rgb',
    quality: 100
  }
};

// 旧版本持久化文件按 conversion/extraction/splitting/stitching 四块存储，
// 迁移时优先沿用 conversion 作为统一导出设置，避免老配置丢失。
const normalizeSettings = (settings: Partial<PersistedSettings> & { conversion?: Partial<ExportTaskSettings> } | null | undefined): PersistedSettings => ({
  theme: settings?.theme ?? DEFAULT_SETTINGS.theme,
  language: settings?.language ?? DEFAULT_SETTINGS.language,
  maxConcurrency: settings?.maxConcurrency ?? DEFAULT_SETTINGS.maxConcurrency,
  outputDirectoryStrategy: settings?.outputDirectoryStrategy ?? DEFAULT_SETTINGS.outputDirectoryStrategy,
  defaultOutputDirectory: settings?.defaultOutputDirectory ?? DEFAULT_SETTINGS.defaultOutputDirectory,
  rememberLastParams: settings?.rememberLastParams ?? DEFAULT_SETTINGS.rememberLastParams,
  exportSettings: { ...DEFAULT_SETTINGS.exportSettings, ...settings?.conversion, ...settings?.exportSettings }
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
        defaultOutputDirectory: partial.defaultOutputDirectory ?? state.defaultOutputDirectory,
        rememberLastParams: partial.rememberLastParams ?? state.rememberLastParams,
        exportSettings: partial.exportSettings ?? state.exportSettings
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
