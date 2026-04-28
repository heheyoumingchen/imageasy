import type { ConversionColorMode, ConversionOutputSettings, ConversionSourceKind } from '../types/conversion';

const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];
const documentExtensions = ['.pdf', '.docx'];

export const supportedOutputFormats = ['jpg', 'png', 'webp'] as const;
export const supportedColorModes = ['rgb', 'cmyk', 'gray-cmyk'] as const;

const colorModeLabelMap: Record<ConversionColorMode, string> = {
  rgb: 'RGB',
  cmyk: 'CMYK',
  'gray-cmyk': '灰度 CMYK'
};

const hasExtension = (filePath: string, extensions: string[]) => {
  const normalized = filePath.toLowerCase();
  return extensions.some((extension) => normalized.endsWith(extension));
};

export const isImageFile = (filePath: string) => hasExtension(filePath, imageExtensions);

export const isDocumentFile = (filePath: string) => hasExtension(filePath, documentExtensions);

export const classifyConversionPath = (filePath: string): ConversionSourceKind => {
  if (isImageFile(filePath)) {
    return 'image';
  }

  if (isDocumentFile(filePath)) {
    return 'document';
  }

  return 'unsupported';
};

type SummarySettings = Pick<ConversionOutputSettings, 'outputFormat' | 'colorMode' | 'pageRangeMode' | 'pageRangeText'>;

export const buildConversionSummary = (settings: Partial<SummarySettings> & Pick<SummarySettings, 'outputFormat' | 'colorMode'>) => {
  const parts = [settings.outputFormat.toUpperCase(), colorModeLabelMap[settings.colorMode]];

  if (settings.pageRangeMode === 'all') {
    parts.push('全部页');
  } else if (settings.pageRangeMode === 'custom' && settings.pageRangeText) {
    parts.push(settings.pageRangeText);
  }

  return parts.join(' / ');
};
