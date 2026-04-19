export const buildNextJpgName = (sourceFileName: string, dateStamp: string, existingNames: string[]) => {
  const dotIndex = sourceFileName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? sourceFileName.slice(0, dotIndex) : sourceFileName;

  let index = 1;
  let candidate = '';

  do {
    candidate = `${baseName}_${dateStamp}_${String(index).padStart(3, '0')}.jpg`;
    index += 1;
  } while (existingNames.includes(candidate));

  return candidate;
};
