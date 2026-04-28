import { describe, expect, it } from 'vitest';
import {
  buildConversionSummary,
  classifyConversionPath,
  isDocumentFile,
  isImageFile,
  supportedColorModes,
  supportedOutputFormats
} from '../../src/utils/conversionFormats';

describe('conversionFormats', () => {
  it('recognizes image and document inputs case-insensitively', () => {
    expect(isImageFile('C:/demo/a.JPG')).toBe(true);
    expect(isDocumentFile('C:/demo/a.PDF')).toBe(true);
    expect(isDocumentFile('C:/demo/a.docx')).toBe(true);
    expect(classifyConversionPath('C:/demo/a.docx')).toBe('document');
    expect(classifyConversionPath('C:/demo/a.webp')).toBe('image');
    expect(classifyConversionPath('C:/demo/a.pptx')).toBe('unsupported');
  });

  it('exports the supported global output specs', () => {
    expect(supportedOutputFormats).toEqual(['jpg', 'png', 'webp']);
    expect(supportedColorModes).toEqual(['rgb', 'cmyk', 'gray-cmyk']);
  });

  it('builds a human-readable summary for image and document items', () => {
    expect(buildConversionSummary({ outputFormat: 'jpg', colorMode: 'rgb' })).toBe('JPG / RGB');
    expect(buildConversionSummary({ outputFormat: 'jpg', colorMode: 'cmyk', pageRangeMode: 'all' })).toBe('JPG / CMYK / 全部页');
    expect(buildConversionSummary({ outputFormat: 'png', colorMode: 'gray-cmyk', pageRangeMode: 'custom', pageRangeText: '1-3,5' })).toBe(
      'PNG / 灰度 CMYK / 1-3,5'
    );
  });
});
