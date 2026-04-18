import { open, save } from '@tauri-apps/plugin-dialog';

const imageFilters = [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }];

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
