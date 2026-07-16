import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import { splitSourcePaths, type SourceSelection } from '../utils/paths';

const imageFilters = [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }];
const conversionFilters = [{ name: 'Supported files', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'pdf', 'docx', 'doc', 'wps'] }];
const extractionFilters = [{ name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx'] }];
const splittingFilters = [{ name: 'Images and PDF', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'pdf'] }];
const stitchingFilters = [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }];

export const openImageFile = async () => {
  const selected = await open({
    directory: false,
    multiple: false,
    filters: imageFilters
  });

  return typeof selected === 'string' ? selected : null;
};

export const chooseJpgSavePath = async (defaultPath: string) => {
  const selected = await save({
    defaultPath,
    filters: [{ name: 'JPEG Image', extensions: ['jpg'] }]
  });

  return typeof selected === 'string' ? selected : null;
};

const normalizeSelection = (selected: unknown) => {
  if (selected === null || selected === undefined) {
    return { paths: [] as string[], cancelled: true };
  }
  if (Array.isArray(selected)) {
    return { paths: selected.filter((value): value is string => typeof value === 'string'), cancelled: false };
  }

  return { paths: typeof selected === 'string' ? [selected] : [], cancelled: false };
};

const openSourceSelection = async (filters: Array<{ name: string; extensions: string[] }>): Promise<SourceSelection> => {
  const { paths: selected, cancelled } = normalizeSelection(
    await open({
      directory: false,
      multiple: true,
      recursive: true,
      filters
    })
  );

  if (cancelled) {
    return { files: [], directories: [], cancelled: true };
  }

  return { ...splitSourcePaths(selected), cancelled: false };
};

export const openConversionSources = async (): Promise<SourceSelection> => openSourceSelection(conversionFilters);

export const openExtractionSources = async (): Promise<SourceSelection> => openSourceSelection(extractionFilters);

export const openSplittingSources = async (): Promise<SourceSelection> => openSourceSelection(splittingFilters);

export const openStitchingSources = async (): Promise<SourceSelection> => openSourceSelection(stitchingFilters);

export const openConversionFiles = async () => {
  const selected = await open({
    directory: false,
    multiple: true,
    filters: conversionFilters
  });

  if (selected === null || selected === undefined) {
    return [];
  }

  return Array.isArray(selected) ? selected.filter((value): value is string => typeof value === 'string') : [];
};

export const openExtractionDocuments = async () => {
  const selected = await open({
    directory: false,
    multiple: true,
    filters: extractionFilters
  });

  if (selected === null || selected === undefined) {
    return [];
  }

  return Array.isArray(selected) ? selected.filter((value): value is string => typeof value === 'string') : [];
};

export const chooseOutputDirectory = async (defaultPath?: string) => {
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath
  });

  return typeof selected === 'string' ? selected : null;
};

export const openDirectoryInSystem = async (path: string) => {
  await invoke('open_directory_in_system', { path });
};
