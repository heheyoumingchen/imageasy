import type { ConversionColorMode, ConversionOutputSettings } from '../types/conversion';

const colorModeLabelMap: Record<ConversionColorMode, string> = {
  rgb: 'RGB',
  cmyk: 'CMYK',
  'gray-cmyk': '灰度 CMYK'
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
