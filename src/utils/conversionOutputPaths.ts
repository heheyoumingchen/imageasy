import type { ConversionItem, ConversionNamingPattern, ConversionOutputFormat } from '../types/conversion';

export type ImageOutputPathSettings = {
  outputDirectory: string;
  outputFormat: ConversionOutputFormat;
  namingPattern: ConversionNamingPattern;
  dateStamp: string;
};

const normalizeDirectory = (path: string) => path.replace(/[\\/]+$/, '');

export const buildImageOutputName = (item: Pick<ConversionItem, 'sourceStem'>, settings: ImageOutputPathSettings) => {
  const targetExtension = settings.outputFormat;

  if (settings.namingPattern === 'source-name-original') {
    return `${item.sourceStem}.${targetExtension}`;
  }

  if (settings.namingPattern === 'source-name-date') {
    return `${item.sourceStem}-${settings.dateStamp}-001.${targetExtension}`;
  }

  return `${item.sourceStem}-001.${targetExtension}`;
};

export const joinOutputPath = (directory: string, fileName: string) => `${normalizeDirectory(directory)}/${fileName}`;

// Windows 路径大小写不敏感且分隔符混用，统一后再比较是否指向同一文件。
export const pathsReferToSameFile = (left: string, right: string) => {
  const normalize = (value: string) => value.replace(/\\/g, '/').toLocaleLowerCase();
  return normalize(left) === normalize(right);
};

export const willOverwriteSource = (
  item: Pick<ConversionItem, 'sourcePath' | 'sourceStem'>,
  settings: ImageOutputPathSettings
) => {
  const outputName = buildImageOutputName(item, settings);
  return pathsReferToSameFile(joinOutputPath(settings.outputDirectory, outputName), item.sourcePath);
};
