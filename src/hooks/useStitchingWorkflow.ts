import { useMemo, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useDragDropImport } from './useDragDropImport';
import { chooseOutputDirectory, openStitchingSources } from '../services/fileDialog';
import { inspectStitchingDirectory, inspectStitchingFile, stitchImageFiles } from '../services/stitchingCommands';
import { getSettingsStore } from './useSettingsStore';
import { toErrorMessage } from '../utils/errors';
import { sourceDirectory } from '../utils/paths';
import { layoutTemplates, type CanvasRatio, type LayoutTemplate } from '../types/stitchingLayout';
import type { InspectStitchingFileResult, StitchingCanvasImage, StitchingResolution } from '../types/stitching';

const createCanvasImage = (result: InspectStitchingFileResult): StitchingCanvasImage => ({
  path: result.sourcePath,
  name: result.sourceName,
  preview: convertFileSrc(result.sourcePath),
  metadata: result.imageMetadata,
});

const firstTemplateForCount = (count: number): LayoutTemplate => {
  const normalized = Math.min(Math.max(count, 1), 16);
  return layoutTemplates[normalized]?.[0] ?? layoutTemplates[4][0];
};

const filledImageCount = (images: Array<StitchingCanvasImage | null>) => images.filter(Boolean).length;

export const useStitchingWorkflow = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<LayoutTemplate | null>(layoutTemplates[4][0]);
  const [canvasRatio, setCanvasRatio] = useState<CanvasRatio>('1:1');
  const [images, setImages] = useState<Array<StitchingCanvasImage | null>>([]);
  const [outputDirectory, setOutputDirectory] = useState('');
  const [padding, setPadding] = useState(0);
  const [spacing, setSpacing] = useState(0);
  const [borderRadius, setBorderRadius] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [resolution, setResolution] = useState<StitchingResolution>(1080);
  const [isRunning, setIsRunning] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [lastOutputPath, setLastOutputPath] = useState<string | null>(null);

  const visibleImages = useMemo(() => images.map((image) => image ?? undefined), [images]);
  const canStart = Boolean(selectedTemplate) && filledImageCount(images) >= 2 && !isRunning;

  const importInspections = async (sources: { files: string[]; directories: string[]; cancelled: boolean }) => {
    if (sources.cancelled || isRunning) return;
    setPageError(null);
    setLastOutputPath(null);
    const fileResults = await Promise.all(sources.files.map((path) => inspectStitchingFile(path)));
    const directoryGroups = await Promise.all(sources.directories.map((path) => inspectStitchingDirectory(path)));
    const imported = [...fileResults, ...directoryGroups.flat()]
      .filter((result) => result.kind === 'image')
      .map(createCanvasImage);

    if (imported.length === 0) return;

    setImages((current) => {
      const template = selectedTemplate ?? firstTemplateForCount(imported.length);
      const capacity = template.imageCount;
      const next = [...current];
      for (const image of imported) {
        const emptyIndex = next.findIndex((item) => item === null || item === undefined);
        if (emptyIndex >= 0 && emptyIndex < capacity) {
          next[emptyIndex] = image;
        } else if (next.length < capacity) {
          next.push(image);
        }
      }
      return next.slice(0, capacity);
    });
  };

  const importImages = async () => {
    await importInspections(await openStitchingSources());
  };

  const importImageForCell = async (cellIndex: number) => {
    if (isRunning) return;
    const sources = await openStitchingSources();
    if (sources.cancelled) return;
    const fileResults = await Promise.all(sources.files.map((path) => inspectStitchingFile(path)));
    const directoryGroups = await Promise.all(sources.directories.map((path) => inspectStitchingDirectory(path)));
    const image = [...fileResults, ...directoryGroups.flat()].filter((result) => result.kind === 'image').map(createCanvasImage)[0];
    if (!image) return;
    setImages((current) => {
      const next = [...current];
      next[cellIndex] = image;
      return next;
    });
  };

  useDragDropImport(importInspections, [isRunning, selectedTemplate]);

  const selectTemplate = (template: LayoutTemplate) => {
    setSelectedTemplate(template);
    setImages((current) => current.slice(0, template.imageCount));
    setLastOutputPath(null);
  };

  const removeImage = (cellIndex: number) => {
    if (isRunning) return;
    setImages((current) => {
      const next = [...current];
      next[cellIndex] = null;
      return next;
    });
    setLastOutputPath(null);
  };

  const clearImages = () => {
    if (isRunning) return;
    setImages([]);
    setPageError(null);
    setLastOutputPath(null);
  };

  const startStitching = async (copyErrors: { outputDirectoryRequired: string; notEnoughImages: string; templateRequired: string }) => {
    if (isRunning) return;
    if (!selectedTemplate) { setPageError(copyErrors.templateRequired); return; }
    if (filledImageCount(images) < 2) { setPageError(copyErrors.notEnoughImages); return; }

    const settings = getSettingsStore().getState();
    const { namingPattern, outputFormat, quality } = settings.stitching;

    // 输出目录由全局策略决定：same-as-source 从首张图片所在目录推断；custom 为空则弹框选择。
    let targetDirectory = outputDirectory;
    if (settings.outputDirectoryStrategy === 'same-as-source') {
      const firstImage = images.find((image): image is StitchingCanvasImage => Boolean(image));
      if (firstImage) {
        targetDirectory = sourceDirectory(firstImage.path);
      }
    } else if (!targetDirectory) {
      const selected = await chooseOutputDirectory();
      if (!selected) return;
      targetDirectory = selected;
      setOutputDirectory(selected);
    }

    if (!targetDirectory) { setPageError(copyErrors.outputDirectoryRequired); return; }

    setIsRunning(true);
    setPageError(null);
    setLastOutputPath(null);
    try {
      const cells = selectedTemplate.cells.map((cell, index) => ({
        sourcePath: images[index]?.path ?? '',
        row: cell.row,
        col: cell.col,
        rowSpan: cell.rowSpan,
        colSpan: cell.colSpan,
      }));
      const result = await stitchImageFiles({
        cells,
        rows: selectedTemplate.rows,
        cols: selectedTemplate.cols,
        canvasRatio,
        resolution,
        padding,
        spacing,
        borderRadius,
        backgroundColor,
        quality,
        outputDirectory: targetDirectory,
        outputFormat,
        namingPattern,
      });
      setLastOutputPath(result.outputPath);
    } catch (error) {
      setPageError(toErrorMessage(error));
    } finally {
      setIsRunning(false);
    }
  };

  return {
    selectedTemplate, canvasRatio, images: visibleImages,
    padding, spacing, borderRadius, backgroundColor, resolution,
    isRunning, pageError, lastOutputPath, canStart,
    setCanvasRatio, setPadding, setSpacing, setBorderRadius, setBackgroundColor, setResolution,
    selectTemplate,
    importImages, importImageForCell, removeImage, clearImages, startStitching,
  };
};
