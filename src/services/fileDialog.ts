import { open, save } from '@tauri-apps/plugin-dialog';

const imageFilters = [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }];
const conversionFilters = [{ name: 'Supported files', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'pdf', 'docx'] }];

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

export const openConversionFiles = async () => {
  const selected = await open({
    directory: false,
    multiple: true,
    filters: conversionFilters
  });

  return Array.isArray(selected) ? selected.filter((value): value is string => typeof value === 'string') : [];
};

export const openConversionDirectory = async () => {
  const selected = await open({
    directory: true,
    multiple: false
  });

  return typeof selected === 'string' ? selected : null;
};

export const chooseOutputDirectory = async () => {
  const selected = await open({
    directory: true,
    multiple: false
  });

  return typeof selected === 'string' ? selected : null;
};
