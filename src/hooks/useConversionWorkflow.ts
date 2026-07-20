import { useRef, useState } from 'react';
import {
  convertImageFile,
  inspectConversionDirectory,
  inspectConversionFile,
  renderDocumentToImages
} from '../services/conversionCommands';
import { useDragDropImport } from './useDragDropImport';
import { openConversionSources, openConversionFiles, chooseOutputDirectory, openDirectoryInSystem } from '../services/fileDialog';
import { getSettingsStore } from './useSettingsStore';
import { useConversionStore } from '../stores/conversionStore';
import type { ConversionItem, ConversionOutputFormat, ConversionColorMode, ConversionNamingPattern, ConversionOutputSettings, InspectConversionFileResult } from '../types/conversion';
import { buildImageOutputName, joinOutputPath, willOverwriteSource } from '../utils/conversionOutputPaths';
import { expandPageRange } from '../utils/pageRange';
import { sourceDirectory } from '../utils/paths';
import { normalizeConversionError, toErrorMessage } from '../utils/errors';
import { createBatchQueueControl, runConcurrentQueue, type BatchQueueControl } from '../utils/batchQueue';
import {
  cancelBatchTask,
  createBatchTaskId,
  registerBatchTask
} from '../services/batchTaskCommands';

// 转换专属参数（来自 conversionStore）与公共导出设置（来自 exportSettings）合并后的批次快照。
type ConversionBatchSettings = ConversionOutputSettings & {
  namingPattern: ConversionNamingPattern;
  outputFormat: ConversionOutputFormat;
  colorMode: ConversionColorMode;
  quality: number;
  // 同一批次共享一个日期戳，避免逐张生成时刻不同导致文件名不一致。
  dateStamp: string;
};

const toItem = (result: InspectConversionFileResult): ConversionItem => ({
  id: `${result.sourcePath}:${result.kind}`,
  sourcePath: result.sourcePath,
  sourceName: result.sourceName,
  sourceStem: result.sourceName.replace(/\.[^.]+$/, ''),
  kind: result.kind,
  status: result.kind === 'unsupported' ? 'unsupported' : 'ready',
  errorMessage: result.errorMessage,
  outputSettingsOverride: {},
  imageMetadata: result.imageMetadata,
  documentMetadata: result.documentMetadata,
  selected: true,
  outputPaths: []
});

const buildImageConversionRequest = (item: ConversionItem, settings: ConversionBatchSettings) => {
  const outputName = buildImageOutputName(item, settings);

  return {
    sourcePath: item.sourcePath,
    outputPath: joinOutputPath(settings.outputDirectory, outputName),
    outputFormat: settings.outputFormat,
    colorMode: settings.colorMode,
    quality: settings.quality,
    // 仅当该项输出会替换源文件时授权覆盖；此时批次开始前已弹出统一确认。
    allowSourceOverwrite: willOverwriteSource(item, settings)
  };
};

const buildDocumentPagesForSettings = (item: ConversionItem, settings: ConversionOutputSettings) => {
  if (!item.documentMetadata) {
    return [];
  }

  const pageRangeMode = item.outputSettingsOverride.pageRangeMode ?? settings.pageRangeMode;
  const pageRangeText = item.outputSettingsOverride.pageRangeText ?? settings.pageRangeText;

  // all 语义交给后端展开为全部页，前端一律发空列表；未知页数时也不在前端猜测总页数。
  if (pageRangeMode === 'all') {
    return [];
  }

  // 页数已知时用上界校验；未知（Office 文档）时只解析语法，交给后端在真实页数下再校验。
  return expandPageRange(pageRangeText, item.documentMetadata.pageCount ?? undefined);
};

const getReadyConversionItems = (items: ConversionItem[]) => items.filter((item) => item.status === 'ready' && item.selected);

const resetFailedConversionItems = (items: ConversionItem[]): ConversionItem[] =>
  items.map((item) => (item.status === 'failed' ? { ...item, status: 'ready' as const, errorMessage: null, outputPaths: [] } : item));

const canRunConversionBatch = (items: ConversionItem[], outputDirectory: string) =>
  getReadyConversionItems(items).length > 0 && outputDirectory.trim().length > 0;

export const useConversionWorkflow = () => {
  const {
    items,
    selectedItemId,
    globalSettings,
    stats,
    setItems,
    selectItem,
    toggleItemSelected,
    updateGlobalSettings,
    buildItemSummary,
    markItemRunning,
    markItemSucceeded,
    markItemFailed,
    reset
  } = useConversionStore();
  const [isRunning, setIsRunning] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [failedDetailsOpen, setFailedDetailsOpen] = useState(false);
  const batchControlRef = useRef<BatchQueueControl | null>(null);
  const batchTaskIdRef = useRef<string | null>(null);

  const importSources = async (sources: { files: string[]; directories: string[]; cancelled: boolean }) => {
    if (sources.cancelled) {
      return;
    }
    setPageError(null);
    const fallbackFiles = sources.files.length === 0 && sources.directories.length === 0 ? await openConversionFiles() : [];
    const sourceFiles = [...sources.files, ...fallbackFiles];

    // 逐项 inspect：单文件失败不拖垮整批导入（此前 PDF 读页数失败会 Unhandled rejection）。
    const fileResults = await Promise.all(
      sourceFiles.map(async (path) => {
        try {
          return await inspectConversionFile(path);
        } catch (error) {
          return {
            kind: 'unsupported' as const,
            sourcePath: path,
            sourceName: path.replace(/^.*[\\/]/, ''),
            imageMetadata: null,
            documentMetadata: null,
            errorMessage: toErrorMessage(error)
          };
        }
      })
    );
    const directoryResults = await Promise.all(
      sources.directories.map(async (path) => {
        try {
          return await inspectConversionDirectory(path);
        } catch (error) {
          setPageError(toErrorMessage(error));
          return [] as Awaited<ReturnType<typeof inspectConversionDirectory>>;
        }
      })
    );

    const inspected = [...fileResults, ...directoryResults.flat()];
    const failedInspect = inspected.filter((item) => item.kind === 'unsupported' && item.errorMessage);
    const supportedItems = inspected.filter((item) => item.kind !== 'unsupported').map(toItem);
    setItems([...items, ...supportedItems.filter((item) => !items.some((current) => current.id === item.id))]);

    if (failedInspect.length > 0 && supportedItems.length === 0) {
      setPageError(failedInspect[0]?.errorMessage ?? '导入失败');
    } else if (failedInspect.length > 0) {
      setPageError(`${failedInspect.length} 个文件无法导入：${failedInspect[0]?.errorMessage ?? '未知错误'}`);
    }

    if (!globalSettings.outputDirectory && sources.directories[0]) {
      updateGlobalSettings({ outputDirectory: sources.directories[0] });
    } else if (!globalSettings.outputDirectory && sourceFiles[0]) {
      updateGlobalSettings({ outputDirectory: sourceDirectory(sourceFiles[0]) });
    }
  };

  const importFiles = async () => {
    if (isRunning) {
      return;
    }

    await importSources(await openConversionSources());
  };

  useDragDropImport(importSources, [globalSettings.outputDirectory]);

  const chooseDirectory = async () => {
    if (isRunning) {
      return;
    }

    const path = await chooseOutputDirectory(globalSettings.outputDirectory || undefined);
    if (!path) {
      return;
    }

    updateGlobalSettings({ outputDirectory: path });
  };

  const retryFailedItems = async () => {
    if (!items.some((item) => item.status === 'failed')) {
      return;
    }

    setItems(resetFailedConversionItems(items));
  };

  const clearList = () => {
    if (isRunning) {
      return;
    }

    setFailedDetailsOpen(false);
    setPageError(null);
    reset();
  };

  const openOutputDirectory = async () => {
    if (!globalSettings.outputDirectory) {
      return;
    }

    await openDirectoryInSystem(globalSettings.outputDirectory);
  };

  const failedItems = items.filter((item) => item.status === 'failed');

  const runConversionItem = async (
    item: ConversionItem,
    batchSettings: ConversionBatchSettings,
    taskId: string
  ) => {
    try {
      markItemRunning(item.id);

      if (item.kind === 'image') {
        const paths = await convertImageFile({
          ...buildImageConversionRequest(item, batchSettings),
          taskId
        });
        markItemSucceeded(item.id, paths);
      } else if (item.kind === 'document') {
        const paths = await renderDocumentToImages({
          sourcePath: item.sourcePath,
          outputDirectory: batchSettings.outputDirectory,
          outputFormat: batchSettings.outputFormat,
          colorMode: batchSettings.colorMode,
          quality: batchSettings.quality,
          pageNumbers: buildDocumentPagesForSettings(item, batchSettings),
          renderDensity: batchSettings.renderDensity,
          namingPattern: batchSettings.namingPattern,
          taskId
        });
        markItemSucceeded(item.id, paths);
      }
    } catch (error) {
      // 结构化 CommandError 走 normalizeConversionError 的友好文案；取消与其它失败都落到列表项上。
      markItemFailed(item.id, toErrorMessage(normalizeConversionError(error)));
    }
  };

  const startConversion = async () => {
    if (isRunning) {
      return;
    }

    setPageError(null);

    const readyItems = getReadyConversionItems(items);
    if (readyItems.length === 0) {
      return;
    }

    // same-as-source 策略沿用从源推断的 outputDirectory；custom 策略使用设置页保存的固定默认目录。
    let outputDirectory = globalSettings.outputDirectory;
    const settingsState = getSettingsStore().getState();
    if (settingsState.outputDirectoryStrategy === 'custom') {
      outputDirectory = settingsState.defaultOutputDirectory;
    }
    if (!outputDirectory.trim()) {
      return;
    }

    const exportSettings = settingsState.exportSettings;
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const batchSettings: ConversionBatchSettings = { ...globalSettings, ...exportSettings, outputDirectory, dateStamp };

    for (const item of readyItems.filter((entry) => entry.kind === 'document')) {
      try {
        buildDocumentPagesForSettings(item, batchSettings);
      } catch (error) {
        setPageError(toErrorMessage(error));
        return;
      }
    }

    // 原文件名 + 源文件同目录时，输出会替换原始图片；批量开始前统一确认一次。
    const replacingSource = readyItems
      .filter((item) => item.kind === 'image')
      .some((item) => willOverwriteSource(item, batchSettings));
    if (replacingSource && !window.confirm('当前设置会替换源文件同目录下的原始图片。是否继续？')) {
      return;
    }

    const control = createBatchQueueControl();
    batchControlRef.current = control;
    const taskId = createBatchTaskId('convert');
    batchTaskIdRef.current = taskId;
    setIsRunning(true);

    try {
      await registerBatchTask(taskId);
      const settingsConcurrency = getSettingsStore().getState().maxConcurrency;
      await runConcurrentQueue(
        readyItems,
        settingsConcurrency,
        (item) => runConversionItem(item, batchSettings, taskId),
        control
      );
    } finally {
      batchControlRef.current = null;
      batchTaskIdRef.current = null;
      setIsRunning(false);
    }
  };

  const cancelConversion = () => {
    batchControlRef.current?.cancel();
    const taskId = batchTaskIdRef.current;
    if (taskId) {
      void cancelBatchTask(taskId);
    }
  };

  const canStart =
    getSettingsStore().getState().outputDirectoryStrategy === 'custom'
      ? getReadyConversionItems(items).length > 0
      : canRunConversionBatch(items, globalSettings.outputDirectory);

  return {
    items,
    selectedItemId,
    globalSettings,
    stats,
    isRunning,
    pageError,
    failedDetailsOpen,
    setFailedDetailsOpen,
    failedItems,
    canStart,
    selectItem,
    toggleItemSelected,
    updateGlobalSettings,
    buildItemSummary,
    importFiles,
    chooseDirectory,
    retryFailedItems,
    clearList,
    openOutputDirectory,
    startConversion,
    cancelConversion
  };
};
