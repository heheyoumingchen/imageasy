import { useMemo, useState } from 'react';
import { extractDocumentImages, inspectExtractionDirectory, inspectExtractionDocument } from '../services/extractionCommands';
import { openDirectoryInSystem, openExtractionDocuments, openExtractionSources } from '../services/fileDialog';
import { useDragDropImport } from './useDragDropImport';
import { getSettingsStore } from './useSettingsStore';
import { sourceDirectory, sourceName } from '../utils/paths';
import { toErrorMessage } from '../utils/errors';
import type { ExtractionDocumentInfo, ExtractionOutputFormat } from '../types/extraction';

export type ExtractionItem = ExtractionDocumentInfo & {
  status: 'ready' | 'running' | 'success' | 'failed';
  selected: boolean;
  extractedCount: number;
  errorMessage: string | null;
};

const fallbackDocumentInfo = (path: string): ExtractionDocumentInfo => ({
  sourcePath: path,
  sourceName: sourceName(path),
  extension: sourceName(path).split('.').pop()?.toLowerCase() ?? '',
  embeddedImageCount: 0,
  pageCount: 0
});

const createExtractionItem = (documentInfo: ExtractionDocumentInfo): ExtractionItem => ({
  ...documentInfo,
  status: 'ready',
  selected: true,
  extractedCount: 0,
  errorMessage: null
});

const createFailedExtractionItem = (documentInfo: ExtractionDocumentInfo, error: unknown): ExtractionItem => ({
  ...documentInfo,
  status: 'failed',
  selected: true,
  extractedCount: 0,
  errorMessage: toErrorMessage(error)
});

const resetProcessedExtractionItem = (item: ExtractionItem): ExtractionItem =>
  item.status === 'success' || item.status === 'failed'
    ? { ...item, status: 'ready', errorMessage: null, extractedCount: 0 }
    : item;

const markExtractionItemRunning = (items: ExtractionItem[], sourcePath: string): ExtractionItem[] =>
  items.map((entry) => (entry.sourcePath === sourcePath ? { ...entry, status: 'running' } : entry));

const markExtractionItemSucceeded = (items: ExtractionItem[], sourcePath: string, extractedCount: number): ExtractionItem[] =>
  items.map((entry) =>
    entry.sourcePath === sourcePath
      ? { ...entry, status: 'success', extractedCount, errorMessage: null }
      : entry
  );

const markExtractionItemFailed = (items: ExtractionItem[], sourcePath: string, errorMessage: string): ExtractionItem[] =>
  items.map((entry) =>
    entry.sourcePath === sourcePath
      ? { ...entry, status: 'failed', errorMessage }
      : entry
  );

const retryFailedExtractionItems = (items: ExtractionItem[]): ExtractionItem[] =>
  items.map((item) =>
    item.status === 'failed' ? { ...item, status: 'ready', selected: true, extractedCount: 0, errorMessage: null } : item
  );

const toggleExtractionItemSelected = (items: ExtractionItem[], sourcePath: string): ExtractionItem[] =>
  items.map((item) => (item.sourcePath === sourcePath ? { ...item, selected: !item.selected } : item));

const supportedExtractionExtensions = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx']);
const isSupportedExtractionPath = (path: string) => {
  const extension = sourceName(path).split('.').pop()?.toLowerCase() ?? '';
  return supportedExtractionExtensions.has(extension);
};

export const useExtractionWorkflow = () => {
  const [items, setItems] = useState<ExtractionItem[]>([]);
  const [outputDirectory, setOutputDirectory] = useState('');
  const [outputDirectoryManual, setOutputDirectoryManual] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [failedDetailsOpen, setFailedDetailsOpen] = useState(false);

  const stats = useMemo(() => {
    return {
      total: items.length,
      ready: items.filter(i => i.status === 'ready').length,
      running: items.filter(i => i.status === 'running').length,
      success: items.filter(i => i.status === 'success').length,
      failed: items.filter(i => i.status === 'failed').length,
      totalExpected: items.reduce((sum, item) => sum + item.embeddedImageCount, 0),
      totalExtracted: items.reduce((sum, item) => sum + item.extractedCount, 0)
    };
  }, [items]);

  const failedItems = items.filter((item) => item.status === 'failed');

  const importSources = async (sources: { files: string[]; directories: string[]; cancelled: boolean }) => {
    if (sources.cancelled) {
      return;
    }
    const fallbackFiles = sources.files.length === 0 && sources.directories.length === 0 ? await openExtractionDocuments() : [];
    const sourceFiles = [...sources.files, ...fallbackFiles].filter(isSupportedExtractionPath);

    for (const path of sourceFiles) {
      try {
        const documentInfo = await inspectExtractionDocument(path);
        setItems((current) => current.some((item) => item.sourcePath === documentInfo.sourcePath) ? current : [...current, createExtractionItem(documentInfo)]);
      } catch {
      }
    }
    for (const path of sources.directories) {
      try {
        const directoryItems = await inspectExtractionDirectory(path);
        setItems((current) => {
          const existing = new Set(current.map((item) => item.sourcePath));
          const fresh = directoryItems.filter((info) => !existing.has(info.sourcePath));
          return [...current, ...fresh.map(createExtractionItem)];
        });
      } catch (error) {
        setItems((current) => current.some((item) => item.sourcePath === path) ? current : [...current, createFailedExtractionItem(fallbackDocumentInfo(path), error)]);
      }
    }
    if (!outputDirectoryManual && sources.directories[0]) {
      setOutputDirectory(sources.directories[0]);
    } else if (!outputDirectoryManual && sourceFiles[0]) {
      setOutputDirectory(sourceDirectory(sourceFiles[0]));
    }
  };

  const importDocuments = async () => {
    setPageError(null);
    await importSources(await openExtractionSources());
  };

  useDragDropImport(importSources, [outputDirectory]);

  const openOutputDirectory = async () => {
    if (outputDirectory) {
      await openDirectoryInSystem(outputDirectory);
    }
  };

  const retryFailed = () => {
    setItems((current) => retryFailedExtractionItems(current));
  };

  const toggleItemSelected = (sourcePath: string) => {
    setItems((current) => toggleExtractionItemSelected(current, sourcePath));
  };

  const clearList = () => {
    setItems([]);
  };

  const startExtraction = async (selectOutputDirectoryError: string) => {
    const { exportSettings, outputDirectoryStrategy, defaultOutputDirectory } = getSettingsStore().getState();

    const targetDirectory = outputDirectoryStrategy === 'custom' ? defaultOutputDirectory : outputDirectory;

    if (!targetDirectory) {
      setPageError(selectOutputDirectoryError);
      return;
    }

    setPageError(null);
    setIsRunning(true);

    const readyItems = items.filter(i => i.status === 'ready' && i.selected);

    for (const item of readyItems) {
      setItems((current) => markExtractionItemRunning(current, item.sourcePath));

      try {
        const result = await extractDocumentImages({
          sourcePath: item.sourcePath,
          outputDirectory: targetDirectory,
          outputFormat: exportSettings.outputFormat as ExtractionOutputFormat,
          colorMode: exportSettings.colorMode,
          quality: exportSettings.quality,
          namingPattern: exportSettings.namingPattern,
          includeOutputPaths: false
        });
        setItems((current) => markExtractionItemSucceeded(current, item.sourcePath, result.extractedCount));
      } catch (error) {
        setItems((current) => markExtractionItemFailed(current, item.sourcePath, toErrorMessage(error)));
      }
    }

    setIsRunning(false);
  };

  return {
    items,
    outputDirectory,
    pageError,
    isRunning,
    failedDetailsOpen,
    setFailedDetailsOpen,
    stats,
    failedItems,
    importDocuments,
    openOutputDirectory,
    retryFailed,
    toggleItemSelected,
    clearList,
    startExtraction
  };
};
