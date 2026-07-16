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
  // null 表示未探测（Office 文档导入时不启动 Office），显示「页数未知」。
  pageCount: number | null;
};

export const buildConversionSummary = (settings: Partial<SummarySettings> & Pick<SummarySettings, 'outputFormat' | 'colorMode'>) => {
  const parts = [settings.outputFormat.toUpperCase(), colorModeLabelMap[settings.colorMode]];

  const hasPageRange = settings.pageRangeMode !== undefined;
  if (hasPageRange && settings.pageCount === null) {
    parts.push('页数未知');
  } else if (settings.pageRangeMode === 'all') {
    parts.push('全部页');
  } else if (settings.pageRangeMode === 'custom' && settings.pageRangeText) {
    parts.push(settings.pageRangeText);
  }

  return parts.join(' / ');
};
