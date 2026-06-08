import { useMemo, useState } from 'react';
import { getSettingsStore } from './useSettingsStore';
import { useDragDropImport } from './useDragDropImport';
import { chooseOutputDirectory, openDirectoryInSystem, openSplittingSources } from '../services/fileDialog';
import { inspectSplittingDirectory, inspectSplittingFile, splitImageFile } from '../services/splittingCommands';
import { runConcurrentQueue } from '../utils/batchQueue';
import { toErrorMessage } from '../utils/errors';
import { sourceDirectory } from '../utils/paths';
import type { InspectSplittingFileResult, SplittingItem, SplittingMode } from '../types/splitting';

const gridForMode = (mode: SplittingMode, horizontalSplits: number, verticalSplits: number) => {
  if (mode === 'horizontal') {
    return { columns: horizontalSplits, rows: 1 };
  }
  if (mode === 'vertical') {
    return { columns: 1, rows: verticalSplits };
  }
  return { columns: horizontalSplits, rows: verticalSplits };
};

const createItem = (result: InspectSplittingFileResult): SplittingItem => ({
  ...result,
  status: 'ready',
  selected: true,
  outputPaths: [],
  splitCount: 0,
});

const resetProcessedItem = (item: SplittingItem): SplittingItem =>
  item.status === 'success' || item.status === 'failed'
    ? { ...item, status: 'ready', errorMessage: null, outputPaths: [], splitCount: 0 }
    : item;

const markItem = (items: SplittingItem[], sourcePath: string, partial: Partial<SplittingItem>): SplittingItem[] =>
  items.map((item) => (item.sourcePath === sourcePath ? { ...item, ...partial } : item));

export const useSplittingWorkflow = () => {
  const [items, setItems] = useState<SplittingItem[]>([]);
  const [outputDirectory, setOutputDirectory] = useState('');
  const [outputDirectoryManual, setOutputDirectoryManual] = useState(false);
  const [mode, setMode] = useState<SplittingMode>('grid');
  const [horizontalSplits, setHorizontalSplits] = useState(2);
  const [verticalSplits, setVerticalSplits] = useState(2);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [failedDetailsOpen, setFailedDetailsOpen] = useState(false);

  const stats = useMemo(() => ({
    total: items.length,
    ready: items.filter((item) => item.status === 'ready').length,
    running: items.filter((item) => item.status === 'running').length,
    success: items.filter((item) => item.status === 'success').length,
    failed: items.filter((item) => item.status === 'failed').length,
  }), [items]);

  const failedItems = items.filter((item) => item.status === 'failed');

  const importSources = async (sources: { files: string[]; directories: string[]; cancelled: boolean }) => {
    if (sources.cancelled || isRunning) return;
    setPageError(null);
    const fileResults = await Promise.all(sources.files.map((path) => inspectSplittingFile(path)));
    const directoryGroups = await Promise.all(sources.directories.map((path) => inspectSplittingDirectory(path)));
    const supported = [...fileResults, ...directoryGroups.flat()].filter((result) => result.kind !== 'unsupported');
    setItems((current) => [...current, ...supported.map(createItem)]);

    if (!outputDirectoryManual && sources.directories[0]) {
      setOutputDirectory(sources.directories[0]);
    } else if (!outputDirectoryManual && sources.files[0]) {
      setOutputDirectory(sourceDirectory(sources.files[0]));
    }
  };

  const importFiles = async () => {
    await importSources(await openSplittingSources());
  };

  useDragDropImport(importSources, [outputDirectoryManual, isRunning]);

  const selectOutputDirectory = async () => {
    if (isRunning) return;
    const selected = await chooseOutputDirectory(outputDirectory || undefined);
    if (selected) {
      setOutputDirectory(selected);
      setOutputDirectoryManual(true);
    }
  };

  const resetCompletedItems = () => setItems((current) => current.map(resetProcessedItem));

  const updateMode = (value: SplittingMode) => { setMode(value); resetCompletedItems(); };
  const updateHorizontalSplits = (value: number) => { setHorizontalSplits(value); resetCompletedItems(); };
  const updateVerticalSplits = (value: number) => { setVerticalSplits(value); resetCompletedItems(); };

  const toggleItemSelected = (sourcePath: string) => {
    setItems((current) => current.map((item) => item.sourcePath === sourcePath ? { ...item, selected: !item.selected } : item));
  };

  const clearList = () => {
    if (isRunning) return;
    setItems([]);
    setPageError(null);
    setFailedDetailsOpen(false);
  };

  const retryFailed = () => {
    setItems((current) => current.map((item) => item.status === 'failed' ? { ...item, status: 'ready', selected: true, errorMessage: null, outputPaths: [], splitCount: 0 } : item));
  };

  const openOutputDirectory = async () => {
    if (outputDirectory) await openDirectoryInSystem(outputDirectory);
  };

  const runItem = async (item: SplittingItem, targetDirectory: string) => {
    setItems((current) => markItem(current, item.sourcePath, { status: 'running', errorMessage: null, outputPaths: [], splitCount: 0 }));
    try {
      const { columns, rows } = gridForMode(mode, horizontalSplits, verticalSplits);
      const splitting = getSettingsStore().getState().splitting;
      const result = await splitImageFile({
        sourcePath: item.sourcePath,
        outputDirectory: targetDirectory,
        outputFormat: splitting.outputFormat,
        columns,
        rows,
        quality: splitting.quality,
        namingPattern: splitting.namingPattern
      });
      setItems((current) => markItem(current, item.sourcePath, { status: 'success', outputPaths: result.outputPaths, splitCount: result.splitCount, errorMessage: null }));
    } catch (error) {
      setItems((current) => markItem(current, item.sourcePath, { status: 'failed', errorMessage: toErrorMessage(error) }));
    }
  };

  const startSplitting = async (copyErrors: { outputDirectoryRequired: string }) => {
    if (isRunning) return;
    let targetDirectory = outputDirectory;
    if (!targetDirectory) {
      if (getSettingsStore().getState().outputDirectoryStrategy === 'custom') {
        const selected = await chooseOutputDirectory();
        if (!selected) { setPageError(copyErrors.outputDirectoryRequired); return; }
        targetDirectory = selected;
        setOutputDirectory(selected);
        setOutputDirectoryManual(true);
      } else {
        setPageError(copyErrors.outputDirectoryRequired);
        return;
      }
    }
    const readyItems = items.filter((item) => item.status === 'ready' && item.selected);
    if (readyItems.length === 0) return;
    setPageError(null);
    setIsRunning(true);
    await runConcurrentQueue(readyItems, getSettingsStore().getState().maxConcurrency, (item) => runItem(item, targetDirectory));
    setIsRunning(false);
  };

  return {
    items, outputDirectory, mode, horizontalSplits, verticalSplits,
    pageError, isRunning, failedDetailsOpen, setFailedDetailsOpen, stats, failedItems,
    canStart: items.some((item) => item.status === 'ready' && item.selected) && Boolean(outputDirectory),
    importFiles, selectOutputDirectory, openOutputDirectory,
    updateMode, updateHorizontalSplits, updateVerticalSplits,
    retryFailed, toggleItemSelected, clearList, startSplitting,
  };
};
