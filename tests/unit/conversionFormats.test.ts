import { describe, expect, it } from 'vitest';
import { buildConversionSummary } from '../../src/utils/conversionFormats';

describe('conversionFormats', () => {
  it('builds a human-readable summary for image and document items', () => {
    expect(buildConversionSummary({ outputFormat: 'jpg', colorMode: 'rgb' })).toBe('JPG / RGB');
    expect(buildConversionSummary({ outputFormat: 'jpg', colorMode: 'cmyk', pageRangeMode: 'all' })).toBe('JPG / CMYK / 全部页');
    expect(buildConversionSummary({ outputFormat: 'png', colorMode: 'grayscale', pageRangeMode: 'custom', pageRangeText: '1-3,5' })).toBe(
      'PNG / 灰度 / 1-3,5'
    );
  });
});
