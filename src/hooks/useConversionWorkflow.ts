import { useState } from 'react';
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
import type { ConversionItem, ConversionOutputFormat, ConversionColorMode, ConversionOutputSettings, InspectConversionFileResult } from '../types/conversion';
import { expandPageRange } from '../utils/pageRange';
import { sourceDirectory } from '../utils/paths';
import { toErrorMessage } from '../utils/errors';
import { runConcurrentQueue } from '../utils/batchQueue';

// 转换专属参数（来自 conversionStore）与公共导出设置（来自 exportSettings）合并后的批次快照。
type ConversionBatchSettings = ConversionOutputSettings & {
  namingPattern: 'source-name-index' | 'source-name-date';
  outputFormat: ConversionOutputFormat;
  colorMode: ConversionColorMode;
  quality: number;
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

const buildImageOutputName = (item: ConversionItem, settings: ConversionBatchSettings) => {
  const targetExtension = settings.outputFormat;
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  return settings.namingPattern === 'source-name-date'
    ? `${item.sourceStem}-${stamp}-001.${targetExtension}`
    : `${item.sourceStem}-001.${targetExtension}`;
};

const buildImageConversionRequest = (item: ConversionItem, settings: ConversionBatchSettings) => {
  const outputName = buildImageOutputName(item, settings);
  const outputFormat = (outputName.split('.').pop() ?? settings.outputFormat) as ConversionOutputFormat;

  return {
    sourcePath: item.sourcePath,
    outputPath: `${settings.outputDirectory}/${outputName}`,
    outputFormat,
    colorMode: settings.colorMode,
    quality: settings.quality
  };
};

const buildDocumentPagesForSettings = (item: ConversionItem, settings: ConversionOutputSettings) => {
  if (!item.documentMetadata) {
    return [];
  }

  const pageRangeMode = item.outputSettingsOverride.pageRangeMode ?? settings.pageRangeMode;
  const pageRangeText = item.outputSettingsOverride.pageRangeText ?? settings.pageRangeText;

  if (pageRangeMode === 'all') {
    return Array.from({ length: item.documentMetadata.pageCount }, (_, index) => index + 1);
  }

  return expandPageRange(pageRangeText, item.documentMetadata.pageCount);
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

  const importSources = async (sources: { files: string[]; directories: string[]; cancelled: boolean }) => {
    if (sources.cancelled) {
      return;
    }
    const fallbackFiles = sources.files.length === 0 && sources.directories.length === 0 ? await openConversionFiles() : [];
    const sourceFiles = [...sources.files, ...fallbackFiles];
    const fileItems = await Promise.all(sourceFiles.map((path) => inspectConversionFile(path)));
    const directoryItemGroups = await Promise.all(sources.directories.map((path) => inspectConversionDirectory(path)));
    const supportedItems = [...fileItems, ...directoryItemGroups.flat()].filter((item) => item.kind !== 'unsupported').map(toItem);
    setItems([...items, ...supportedItems.filter((item) => !items.some((current) => current.id === item.id))]);

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

  const runConversionItem = async (item: ConversionItem, batchSettings: ConversionBatchSettings) => {
    try {
      markItemRunning(item.id);

      if (item.kind === 'image') {
        const paths = await convertImageFile(buildImageConversionRequest(item, batchSettings));
        markItemSucceeded(item.id, paths);
      } else if (item.kind === 'document') {
        const paths = await renderDocumentToImages({
          sourcePath: item.sourcePath,
          outputDirectory: batchSettings.outputDirectory,
          outputFormat: batchSettings.outputFormat,
          colorMode: batchSettings.colorMode,
          pageNumbers: buildDocumentPagesForSettings(item, batchSettings),
          renderDensity: batchSettings.renderDensity,
          namingPattern: batchSettings.namingPattern
        });
        markItemSucceeded(item.id, paths);
      }
    } catch (error) {
      markItemFailed(item.id, toErrorMessage(error));
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
    const batchSettings: ConversionBatchSettings = { ...globalSettings, ...exportSettings, outputDirectory };

    for (const item of readyItems.filter((entry) => entry.kind === 'document')) {
      try {
        buildDocumentPagesForSettings(item, batchSettings);
      } catch (error) {
        setPageError(toErrorMessage(error));
        return;
      }
    }

    setIsRunning(true);

    const settingsConcurrency = getSettingsStore().getState().maxConcurrency;
    await runConcurrentQueue(readyItems, settingsConcurrency, (item) => runConversionItem(item, batchSettings));
    setIsRunning(false);
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
    startConversion
  };
};
