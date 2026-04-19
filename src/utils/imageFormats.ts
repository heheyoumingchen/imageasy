const supportedImageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];

export const isSupportedImageFile = (filePath: string) => {
  const normalized = filePath.toLowerCase();
  return supportedImageExtensions.some((extension) => normalized.endsWith(extension));
};

export const sortImageItems = (paths: string[]) => {
  return [...paths].sort((left, right) => {
    const leftName = left.split('/').pop() ?? left;
    const rightName = right.split('/').pop() ?? right;
    return leftName.localeCompare(rightName, 'zh-CN', { numeric: true });
  });
};

export { supportedImageExtensions };
