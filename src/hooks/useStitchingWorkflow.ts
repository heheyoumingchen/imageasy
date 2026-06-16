import { useMemo, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useDragDropImport } from './useDragDropImport';
import { openDirectoryInSystem, openStitchingSources } from '../services/fileDialog';
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
  scale: 1,
  offsetX: 0,
  offsetY: 0,
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

  const appendImportedImages = (imported: StitchingCanvasImage[]) => {
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

  const importInspections = async (sources: { files: string[]; directories: string[]; cancelled: boolean }) => {
    if (sources.cancelled || isRunning) return;
    setPageError(null);
    setLastOutputPath(null);

    const filePromises = sources.files.map(async (path) => {
      try {
        const result = await inspectStitchingFile(path);
        if (result.kind === 'image') {
          return createCanvasImage(result);
        }
        return null;
      } catch (error) {
        setPageError(toErrorMessage(error));
        return null;
      }
    });

    const fileImages = (await Promise.all(filePromises)).filter((image): image is StitchingCanvasImage => image !== null);
    if (fileImages.length > 0) {
      appendImportedImages(fileImages);
    }

    for (const path of sources.directories) {
      try {
        const directoryResults = await inspectStitchingDirectory(path);
        appendImportedImages(directoryResults.filter((result) => result.kind === 'image').map(createCanvasImage));
      } catch (error) {
        setPageError(toErrorMessage(error));
      }
    }
  };

  const importImages = async () => {
    await importInspections(await openStitchingSources());
  };

  const importImageForCell = async (cellIndex: number) => {
    if (isRunning) return;
    const sources = await openStitchingSources();
    if (sources.cancelled) return;

    for (const path of sources.files) {
      const result = await inspectStitchingFile(path);
      if (result.kind === 'image') {
        setImages((current) => {
          const next = [...current];
          next[cellIndex] = createCanvasImage(result);
          return next;
        });
        return;
      }
    }

    for (const path of sources.directories) {
      const directoryResults = await inspectStitchingDirectory(path);
      const image = directoryResults.find((result) => result.kind === 'image');
      if (image) {
        setImages((current) => {
          const next = [...current];
          next[cellIndex] = createCanvasImage(image);
          return next;
        });
        return;
      }
    }
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

  // 交换两个方格内的图片位置（拖拽移动）。
  const swapImages = (fromIndex: number, toIndex: number) => {
    if (isRunning || fromIndex === toIndex) return;
    setImages((current) => {
      const next = [...current];
      const temp = next[fromIndex] ?? null;
      next[fromIndex] = next[toIndex] ?? null;
      next[toIndex] = temp;
      return next;
    });
    setLastOutputPath(null);
  };

  // 调整某个方格内图片的缩放与位移（编辑模式）。
  // 图片以 contain 方式适配方格，scale 限制 1~6，offset 以方格尺寸的比例表示（-1~1，可自由平移，空白由背景色填充）。
  const updateImageTransform = (cellIndex: number, transform: { scale?: number; offsetX?: number; offsetY?: number }) => {
    if (isRunning) return;
    setImages((current) => {
      const target = current[cellIndex];
      if (!target) return current;
      const next = [...current];
      const scale = transform.scale !== undefined ? Math.min(Math.max(transform.scale, 1), 6) : target.scale;
      const offsetX = transform.offsetX !== undefined ? Math.min(Math.max(transform.offsetX, -1), 1) : target.offsetX;
      const offsetY = transform.offsetY !== undefined ? Math.min(Math.max(transform.offsetY, -1), 1) : target.offsetY;
      next[cellIndex] = { ...target, scale, offsetX, offsetY };
      return next;
    });
    setLastOutputPath(null);
  };

  // 将某个方格内图片恢复默认缩放与位移。
  const resetImageTransform = (cellIndex: number) => {
    if (isRunning) return;
    setImages((current) => {
      const target = current[cellIndex];
      if (!target) return current;
      const next = [...current];
      next[cellIndex] = { ...target, scale: 1, offsetX: 0, offsetY: 0 };
      return next;
    });
    setLastOutputPath(null);
  };

  const openOutputDirectory = async () => {
    if (outputDirectory) await openDirectoryInSystem(outputDirectory);
  };

  const startStitching = async (copyErrors: { outputDirectoryRequired: string; notEnoughImages: string; templateRequired: string }) => {
    if (isRunning) return;
    if (!selectedTemplate) { setPageError(copyErrors.templateRequired); return; }
    if (filledImageCount(images) < 2) { setPageError(copyErrors.notEnoughImages); return; }

    const settings = getSettingsStore().getState();
    const { namingPattern, outputFormat, colorMode, quality } = settings.exportSettings;

    // 输出目录由全局策略决定：same-as-source 从首张图片所在目录推断；custom 使用设置页保存的固定默认目录。
    let targetDirectory = outputDirectory;
    if (settings.outputDirectoryStrategy === 'same-as-source') {
      const firstImage = images.find((image): image is StitchingCanvasImage => Boolean(image));
      if (firstImage) {
        targetDirectory = sourceDirectory(firstImage.path);
      }
    } else {
      targetDirectory = settings.defaultOutputDirectory;
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
        scale: images[index]?.scale ?? 1,
        offsetX: images[index]?.offsetX ?? 0,
        offsetY: images[index]?.offsetY ?? 0,
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
        colorMode,
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
    isRunning, pageError, lastOutputPath, canStart, outputDirectory,
    setCanvasRatio, setPadding, setSpacing, setBorderRadius, setBackgroundColor, setResolution,
    selectTemplate,
    importImages, importImageForCell, removeImage, clearImages, openOutputDirectory, startStitching,
    swapImages, updateImageTransform, resetImageTransform,
  };
};
