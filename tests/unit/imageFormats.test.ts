import { describe, expect, it } from 'vitest';
import { isSupportedImageFile, sortImageItems } from '../../src/utils/imageFormats';

describe('imageFormats', () => {
  it('filters supported image files case-insensitively', () => {
    expect(isSupportedImageFile('C:/demo/a.JPG')).toBe(true);
    expect(isSupportedImageFile('C:/demo/a.docx')).toBe(false);
  });

  it('sorts image items by file name ascending', () => {
    expect(sortImageItems(['C:/demo/2.png', 'C:/demo/10.png', 'C:/demo/1.png'])).toEqual([
      'C:/demo/1.png',
      'C:/demo/2.png',
      'C:/demo/10.png'
    ]);
  });
});
