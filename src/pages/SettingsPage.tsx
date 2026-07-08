import { useEffect, useState } from 'react';
import { AboutCard, GeneralSettingsCard, TaskSettingsCard } from '../components/settings';
import type { TaskOutputFormat, TaskSettingsCardCopy, TaskSettingsValue } from '../components/settings';
import ConfirmDialog from '../components/feedback/ConfirmDialog';
import { getSettingsStore } from '../hooks/useSettingsStore';
import { clearAppCache, getAppCacheUsage } from '../services/cacheCommands';
import type { CacheUsageResult } from '../types/cache';
import { chooseOutputDirectory } from '../services/fileDialog';
import type { PersistedSettings } from '../stores/settingsStore';

const buildFormState = (draft: PersistedSettings | null, settings: PersistedSettings): PersistedSettings => draft ?? settings;

const hasSettingsDraftChanged = (draft: PersistedSettings | null, savedSnapshot: PersistedSettings | null) =>
  draft !== null && savedSnapshot !== null && JSON.stringify(draft) !== JSON.stringify(savedSnapshot);

const formatCacheBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
};

const CONTACT_EMAIL = 'heheyouchen@outlook.com';

const SettingsPage = () => {
  const settingsStore = getSettingsStore();
  const [, setVersion] = useState(0);
  const state = settingsStore.getState();
  const [draft, setDraft] = useState<PersistedSettings | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<PersistedSettings | null>(null);
  const [cacheUsage, setCacheUsage] = useState<CacheUsageResult | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  const sync = () => {
    setVersion((value) => value + 1);
  };

  useEffect(() => {
    void settingsStore
      .getState()
      .load()
      .then((settings) => {
        if (!settings) {
          return;
        }

        setDraft(settings);
        setSavedSnapshot(settings);
      })
      .finally(sync);
  }, [settingsStore]);

  useEffect(() => {
    void getAppCacheUsage().then(setCacheUsage).catch(() => setCacheUsage(null));
  }, []);

  const formState = buildFormState(draft, {
    theme: state.theme,
    language: state.language,
    maxConcurrency: state.maxConcurrency,
    outputDirectoryStrategy: state.outputDirectoryStrategy,
    defaultOutputDirectory: state.defaultOutputDirectory,
    rememberLastParams: state.rememberLastParams,
    exportSettings: state.exportSettings
  });
  const isDirty = hasSettingsDraftChanged(draft, savedSnapshot);
  const isEnglish = formState.language === 'en-US';

  const copy = isEnglish
    ? {
        reset: 'Restore Defaults',
        save: 'Save Changes',
        general: 'Interface & Task',
        theme: 'App Theme',
        themeDark: 'Dark',
        themeLight: 'Light',
        language: 'Language',
        maxConcurrency: 'Max Concurrent Tasks',
        outputDirectoryStrategy: 'Default Output Strategy',
        sameAsSource: 'Same as source folder',
        custom: 'Fixed default folder',
        chooseDefaultOutputDirectory: 'Choose output folder',
        defaultOutputDirectoryPlaceholder: 'No default output folder selected',
        editor: 'Editing Preferences',
        rememberLastParams: 'Retain parameters on switch',
        aboutApp: 'About',
        appName: 'imageasy',
        appVersion: 'v1.0.0',
        cacheTitle: 'Cache',
        cacheDescription: 'Clear download thumbnail cache and image editor temporary files without affecting system caches.',
        cacheSizeLabel: 'Cache Usage',
        cleanCache: 'Clear Cache',
        loading: 'Loading',
        checkForUpdates: 'Check for Updates',
        contact: 'Contact',
        close: 'Close',
        exportSettings: 'Common Export Settings',
        namingPattern: 'Naming pattern',
        sourceNameIndex: 'Source name - index',
        sourceNameDate: 'Source name - date',
        sourceNameOriginal: 'Original filename',
        outputFormat: 'Output format',
        colorMode: 'Color mode',
        grayscale: 'Grayscale',
        outputQuality: 'Output quality',
      }
    : {
        reset: '恢复默认设置',
        save: '保存设置',
        general: '界面与任务设置',
        theme: '界面主题',
        themeDark: '深色模式',
        themeLight: '浅色模式',
        language: '语言设置',
        maxConcurrency: '最大并发任务数',
        outputDirectoryStrategy: '默认输出目录策略',
        sameAsSource: '与源文件同目录',
        custom: '固定默认输出目录',
        chooseDefaultOutputDirectory: '选择输出目录',
        defaultOutputDirectoryPlaceholder: '未选择默认输出目录',
        editor: '图片编辑偏好',
        rememberLastParams: '切换图片时保留调整参数',
        aboutApp: '关于软件',
        appName: 'imageasy',
        appVersion: 'v1.0.0',
        cacheTitle: '缓存',
        cacheDescription: '清理图片下载缩略图缓存和图片编辑临时文件，不影响系统缓存。',
        cacheSizeLabel: '缓存占用',
        cleanCache: '清理缓存',
        loading: '同步中',
        checkForUpdates: '检查新版本（Check for Updates）',
        contact: '联系方式',
        close: '关闭',
        exportSettings: '公共导出设置',
        namingPattern: '命名规则',
        sourceNameIndex: '原文件名-序号',
        sourceNameDate: '原文件名-日期-序号',
        sourceNameOriginal: '原文件名',
        outputFormat: '导出格式',
        colorMode: '输出色彩模式',
        grayscale: '灰度',
        outputQuality: '输出质量',
      };

  const updateDraft = (partial: Partial<PersistedSettings>) => {
    setDraft((current) => ({
      ...(current ?? formState),
      ...partial
    }));
    if (partial.theme) {
      settingsStore.setState({ theme: partial.theme });
    }
    if (partial.language) {
      settingsStore.setState({ language: partial.language });
    }
  };

  const handleSave = async () => {
    if (!draft) {
      return;
    }

    const saved = await settingsStore.getState().updateSettings(draft);
    if (!saved) {
      sync();
      return;
    }

    setDraft(saved);
    setSavedSnapshot(saved);
    sync();
  };

  const handleReset = () => {
    if (!savedSnapshot) {
      return;
    }

    setDraft(savedSnapshot);
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      const result = await clearAppCache();
      setCacheUsage(result);
    } finally {
      setIsClearingCache(false);
    }
  };

  const cacheSizeText = formatCacheBytes(cacheUsage?.totalBytes ?? 0);

  const taskCardCopy = (): TaskSettingsCardCopy => ({
    title: copy.exportSettings,
    namingPattern: copy.namingPattern,
    sourceNameIndex: copy.sourceNameIndex,
    sourceNameDate: copy.sourceNameDate,
    sourceNameOriginal: copy.sourceNameOriginal,
    outputFormat: copy.outputFormat,
    colorMode: copy.colorMode,
    grayscale: copy.grayscale,
    outputDirectoryStrategy: copy.outputDirectoryStrategy,
    sameAsSource: copy.sameAsSource,
    custom: copy.custom,
    chooseDefaultOutputDirectory: copy.chooseDefaultOutputDirectory,
    defaultOutputDirectoryPlaceholder: copy.defaultOutputDirectoryPlaceholder
  });

  const updateExportSettings = (partial: Partial<typeof formState.exportSettings>) => {
    updateDraft({ exportSettings: { ...formState.exportSettings, ...partial } });
  };

  const chooseDefaultOutputDirectory = async () => {
    const selected = await chooseOutputDirectory(formState.defaultOutputDirectory || undefined);
    if (selected) {
      updateDraft({ defaultOutputDirectory: selected });
    }
  };

  return (
    <div data-testid="settings-page-shell" className="flex flex-col h-full p-5 overflow-hidden bg-bg-main">
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
        {/* 关于软件 / 界面与任务设置 / 公共导出设置 共用一个底纹，中间用细线分隔 */}
        <div className="bg-white rounded border border-border-light divide-y divide-border-light/70">
          <AboutCard copy={copy} onOpenContact={() => setIsContactDialogOpen(true)} />
          <GeneralSettingsCard
            copy={copy}
            formState={formState}
            isLoading={state.isLoading}
            cacheSizeText={cacheSizeText}
            isClearingCache={isClearingCache}
            onThemeChange={(theme) => updateDraft({ theme })}
            onLanguageChange={(language) => updateDraft({ language })}
            onMaxConcurrencyChange={(maxConcurrency) => updateDraft({ maxConcurrency })}
            onOutputQualityChange={(quality) => updateExportSettings({ quality })}
            onClearCache={handleClearCache}
          />
          <TaskSettingsCard
            copy={taskCardCopy()}
            value={formState.exportSettings}
            formatOptions={['jpg', 'png', 'webp'] as TaskOutputFormat[]}
            showColorMode
            outputDirectoryStrategy={formState.outputDirectoryStrategy}
            defaultOutputDirectory={formState.defaultOutputDirectory}
            disabled={state.isLoading}
            onChange={updateExportSettings}
            onOutputDirectoryStrategyChange={(outputDirectoryStrategy) => updateDraft({ outputDirectoryStrategy })}
            onChooseDefaultOutputDirectory={chooseDefaultOutputDirectory}
          />
        </div>
      </div>

      <div data-testid="settings-actions-footer" className="mt-6 flex justify-end gap-4 border-t border-border-light/60 pt-6">
        <button
          type="button"
          className="h-10 px-6 rounded border border-border-light bg-white text-sm font-bold text-[#515867] transition-all hover:border-meitu hover:text-meitu active:scale-95 disabled:opacity-40"
          disabled={!isDirty || state.isLoading}
          onClick={handleReset}
        >
          {copy.reset}
        </button>
        <button
          type="button"
          className="h-10 px-10 rounded bg-meitu text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:shadow-none"
          disabled={!isDirty || state.isLoading}
          onClick={handleSave}
        >
          {copy.save}
        </button>
      </div>

      <ConfirmDialog open={isContactDialogOpen} title={copy.contact} confirmLabel={copy.close} onConfirm={() => setIsContactDialogOpen(false)}>
        <p className="mt-4 text-sm text-[#515867]">{CONTACT_EMAIL}</p>
      </ConfirmDialog>

      {state.isLoading && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-white/80 border border-white rounded p-8 flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-meitu/20 border-t-meitu" />
            <span className="text-xs font-bold text-meitu uppercase tracking-widest">{copy.loading}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
