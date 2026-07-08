import type { ConversionColorMode, ConversionOutputFormat, PageRangeMode } from '../types/conversion';

const colorModeLabelMap: Record<ConversionColorMode, string> = {
  rgb: 'RGB',
  cmyk: 'CMYK',
  grayscale: '灰度'
};

type SummarySettings = {
  outputFormat: ConversionOutputFormat;
  colorMode: ConversionColorMode;
  pageRangeMode: PageRangeMode;
  pageRangeText: string;
};

export const buildConversionSummary = (settings: Partial<SummarySettings> & Pick<SummarySettings, 'outputFormat' | 'colorMode'>) => {
  const parts = [settings.outputFormat.toUpperCase(), colorModeLabelMap[settings.colorMode]];

  if (settings.pageRangeMode === 'all') {
    parts.push('全部页');
  } else if (settings.pageRangeMode === 'custom' && settings.pageRangeText) {
    parts.push(settings.pageRangeText);
  }

  return parts.join(' / ');
};
