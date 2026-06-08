import { useMemo, useState } from 'react';
import { getSettingsStore } from './useSettingsStore';
import { useDragDropImport } from './useDragDropImport';
import { chooseOutputDirectory, openDirectoryInSystem, openStitchingSources } from '../services/fileDialog';
import { inspectStitchingDirectory, inspectStitchingFile, stitchImageFiles } from '../services/stitchingCommands';
import { runConcurrentQueue } from '../utils/batchQueue';
import { toErrorMessage } from '../utils/errors';
import { sourceDirectory } from '../utils/paths';
import type { InspectStitchingFileResult, StitchingItem, StitchingNamingPattern, StitchingOutputFormat } from '../types/stitching';

const createItem = (result: InspectStitchingFileResult): StitchingItem => ({
  ...result,
  status: 'ready',
  selected: true,
  outputPath: null,
});

const resetProcessedItem = (item: StitchingItem): StitchingItem =>
  item.status === 'success' || item.status === 'failed'
    ? { ...item, status: 'ready', errorMessage: null, outputPath: null }
    : item;

const markItems = (items: StitchingItem[], partial: Partial<StitchingItem>): StitchingItem[] =>
  items.map((item) => (item.selected && item.status === 'running' ? { ...item, ...partial } : item));

export const useStitchingWorkflow = () => {
  const [items, setItems] = useState<StitchingItem[]>([]);
  const [outputDirectory, setOutputDirectory] = useState('');
  const [outputDirectoryManual, setOutputDirectoryManual] = useState(false);
  const [outputFormat, setOutputFormat] = useState<StitchingOutputFormat>('jpg');
  const [columns, setColumns] = useState(2);
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [namingPattern, setNamingPattern] = useState<StitchingNamingPattern>('source-name-index');
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
    const fileResults = await Promise.all(sources.files.map((path) => inspectStitchingFile(path)));
    const directoryGroups = await Promise.all(sources.directories.map((path) => inspectStitchingDirectory(path)));
    const supported = [...fileResults, ...directoryGroups.flat()].filter((result) => result.kind !== 'unsupported');
    setItems((current) => [...current, ...supported.map(createItem)]);

    if (!outputDirectoryManual && sources.directories[0]) {
      setOutputDirectory(sources.directories[0]);
    } else if (!outputDirectoryManual && sources.files[0]) {
      setOutputDirectory(sourceDirectory(sources.files[0]));
    }
  };

  const importFiles = async () => {
    await importSources(await openStitchingSources());
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

  const updateOutputFormat = (value: StitchingOutputFormat) => { setOutputFormat(value); resetCompletedItems(); };
  const updateColumns = (value: number) => { setColumns(value); resetCompletedItems(); };
  const updateBackgroundColor = (value: string) => { setBackgroundColor(value); resetCompletedItems(); };
  const updateNamingPattern = (value: StitchingNamingPattern) => { setNamingPattern(value); resetCompletedItems(); };

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
    setItems((current) => current.map((item) => item.status === 'failed' ? { ...item, status: 'ready', selected: true, errorMessage: null, outputPath: null } : item));
  };

  const openOutputDirectory = async () => {
    if (outputDirectory) await openDirectoryInSystem(outputDirectory);
  };

  const startStitching = async (copyErrors: { outputDirectoryRequired: string; columnsInvalid: string; notEnoughImages: string }) => {
    if (isRunning) return;
    if (!outputDirectory) { setPageError(copyErrors.outputDirectoryRequired); return; }
    if (columns < 1 || columns > 12) { setPageError(copyErrors.columnsInvalid); return; }
    const readyItems = items.filter((item) => item.status === 'ready' && item.selected);
    if (readyItems.length < 2) { setPageError(copyErrors.notEnoughImages); return; }
    setPageError(null);
    setIsRunning(true);

    setItems((current) => current.map((item) => item.selected && item.status === 'ready' ? { ...item, status: 'running' as const, errorMessage: null, outputPath: null } : item));

    try {
      const sourcePaths = readyItems.map((item) => item.sourcePath);
      const result = await stitchImageFiles({ sourcePaths, outputDirectory, outputFormat, columns, backgroundColor, namingPattern });
      setItems((current) => markItems(current, { status: 'success', outputPath: result.outputPath, errorMessage: null }));
    } catch (error) {
      setItems((current) => markItems(current, { status: 'failed', errorMessage: toErrorMessage(error) }));
    }

    setIsRunning(false);
  };

  return {
    items, outputDirectory, outputFormat, columns, backgroundColor, namingPattern,
    pageError, isRunning, failedDetailsOpen, setFailedDetailsOpen, stats, failedItems,
    canStart: items.filter((item) => item.status === 'ready' && item.selected).length >= 2 && Boolean(outputDirectory),
    importFiles, selectOutputDirectory, openOutputDirectory,
    updateOutputFormat, updateColumns, updateBackgroundColor, updateNamingPattern,
    retryFailed, toggleItemSelected, clearList, startStitching,
  };
};
