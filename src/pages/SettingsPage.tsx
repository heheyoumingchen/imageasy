import { useEffect, useState } from 'react';
import { AboutCard, CacheCard, GeneralSettingsCard, TaskSettingsCard } from '../components/settings';
import type { TaskOutputFormat, TaskSettingsCardCopy, TaskSettingsValue } from '../components/settings';
import ConfirmDialog from '../components/feedback/ConfirmDialog';
import { getSettingsStore } from '../hooks/useSettingsStore';
import { clearAppCache, getAppCacheUsage } from '../services/cacheCommands';
import type { CacheUsageResult } from '../types/cache';
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
    rememberLastParams: state.rememberLastParams,
    conversion: state.conversion,
    extraction: state.extraction,
    splitting: state.splitting,
    stitching: state.stitching
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
        custom: 'Manual selection',
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
        conversionTask: 'Image Conversion',
        extractionTask: 'Image Extraction',
        splittingTask: 'Image Splitting',
        stitchingTask: 'Image Stitching',
        namingPattern: 'Naming pattern',
        sourceNameIndex: 'Source name - index',
        sourceNameDate: 'Source name - date',
        outputFormat: 'Output format',
        colorMode: 'Color mode',
        grayCmyk: 'Gray CMYK',
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
        custom: '每次手动选择',
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
        conversionTask: '格式转换',
        extractionTask: '图片提取',
        splittingTask: '图片分割',
        stitchingTask: '图片拼接',
        namingPattern: '命名规则',
        sourceNameIndex: '原文件名-序号',
        sourceNameDate: '原文件名-日期-序号',
        outputFormat: '导出格式',
        colorMode: '输出色彩模式',
        grayCmyk: '灰度 CMYK',
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

  const taskCardCopy = (title: string): TaskSettingsCardCopy => ({
    title,
    namingPattern: copy.namingPattern,
    sourceNameIndex: copy.sourceNameIndex,
    sourceNameDate: copy.sourceNameDate,
    outputFormat: copy.outputFormat,
    colorMode: copy.colorMode,
    grayCmyk: copy.grayCmyk,
    outputQuality: copy.outputQuality
  });

  const updateTaskDraft = <K extends 'conversion' | 'extraction' | 'splitting' | 'stitching'>(
    key: K,
    partial: Partial<PersistedSettings[K]>
  ) => {
    updateDraft({ [key]: { ...formState[key], ...partial } } as Partial<PersistedSettings>);
  };

  return (
    <div data-testid="settings-page-shell" className="flex flex-col h-full p-5 overflow-hidden bg-bg-main">
      <div className="flex-1 space-y-5 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
        <AboutCard copy={copy} onOpenContact={() => setIsContactDialogOpen(true)} />
        <GeneralSettingsCard
          copy={copy}
          formState={formState}
          isLoading={state.isLoading}
          onThemeChange={(theme) => updateDraft({ theme })}
          onLanguageChange={(language) => updateDraft({ language })}
          onMaxConcurrencyChange={(maxConcurrency) => updateDraft({ maxConcurrency })}
          onOutputDirectoryStrategyChange={(outputDirectoryStrategy) => updateDraft({ outputDirectoryStrategy })}
          rememberLastParams={formState.rememberLastParams}
          onToggleRemember={() => updateDraft({ rememberLastParams: !formState.rememberLastParams })}
        />
        <TaskSettingsCard
          copy={taskCardCopy(copy.conversionTask)}
          value={formState.conversion}
          formatOptions={['jpg', 'png', 'webp'] as TaskOutputFormat[]}
          showColorMode
          showQuality
          disabled={state.isLoading}
          onChange={(partial) => updateTaskDraft('conversion', partial)}
        />
        <TaskSettingsCard
          copy={taskCardCopy(copy.extractionTask)}
          value={formState.extraction}
          formatOptions={['jpg', 'png'] as TaskOutputFormat[]}
          showColorMode
          showQuality={false}
          disabled={state.isLoading}
          onChange={(partial) => updateTaskDraft('extraction', partial as Partial<typeof formState.extraction>)}
        />
        <TaskSettingsCard
          copy={taskCardCopy(copy.splittingTask)}
          value={formState.splitting}
          formatOptions={['jpg', 'png', 'webp'] as TaskOutputFormat[]}
          showColorMode={false}
          showQuality
          disabled={state.isLoading}
          onChange={(partial) => updateTaskDraft('splitting', partial)}
        />
        <TaskSettingsCard
          copy={taskCardCopy(copy.stitchingTask)}
          value={formState.stitching}
          formatOptions={['jpg', 'png', 'webp'] as TaskOutputFormat[]}
          showColorMode={false}
          showQuality
          disabled={state.isLoading}
          onChange={(partial) => updateTaskDraft('stitching', partial)}
        />
        <CacheCard copy={copy} cacheSizeText={cacheSizeText} isLoading={isClearingCache} onClear={handleClearCache} />
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
