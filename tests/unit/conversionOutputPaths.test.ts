import { describe, expect, it } from 'vitest';
import { buildImageOutputName, joinOutputPath, resolveItemOutputDirectory, willOverwriteSource } from '../../src/utils/conversionOutputPaths';

const item = { sourcePath: 'F:/demo/photo.jpg', sourceStem: 'photo' };

describe('conversion output paths', () => {
  it('uses the original source stem with the selected output extension', () => {
    expect(buildImageOutputName(item, {
      outputDirectory: 'F:/out',
      outputFormat: 'webp',
      namingPattern: 'source-name-original',
      dateStamp: '20260708'
    })).toBe('photo.webp');
  });

  it('keeps index and date naming patterns intact', () => {
    expect(buildImageOutputName(item, {
      outputDirectory: 'F:/out',
      outputFormat: 'png',
      namingPattern: 'source-name-index',
      dateStamp: '20260708'
    })).toBe('photo-001.png');
    expect(buildImageOutputName(item, {
      outputDirectory: 'F:/out',
      outputFormat: 'png',
      namingPattern: 'source-name-date',
      dateStamp: '20260708'
    })).toBe('photo-20260708-001.png');
  });

  it('detects when original-name output replaces the source file', () => {
    expect(willOverwriteSource(item, {
      outputDirectory: 'F:/demo',
      outputFormat: 'jpg',
      namingPattern: 'source-name-original',
      dateStamp: '20260708'
    })).toBe(true);
  });

  it('does not treat a different output directory as source replacement', () => {
    expect(willOverwriteSource(item, {
      outputDirectory: 'F:/out',
      outputFormat: 'jpg',
      namingPattern: 'source-name-original',
      dateStamp: '20260708'
    })).toBe(false);
  });

  it('does not treat index naming in the source directory as replacement', () => {
    expect(willOverwriteSource(item, {
      outputDirectory: 'F:/demo',
      outputFormat: 'jpg',
      namingPattern: 'source-name-index',
      dateStamp: '20260708'
    })).toBe(false);
  });

  it('joins output paths without duplicate trailing separators', () => {
    expect(joinOutputPath('F:/out/', 'photo.jpg')).toBe('F:/out/photo.jpg');
  });

  it('keeps each source file in its own folder under same-as-source', () => {
    expect(resolveItemOutputDirectory('F:/album-a/photo.jpg', 'same-as-source', 'F:/fallback')).toBe('F:/album-a');
    expect(resolveItemOutputDirectory('F:/album-b/nested/photo.jpg', 'same-as-source', 'F:/fallback')).toBe('F:/album-b/nested');
  });

  it('uses the custom directory for every item under custom strategy', () => {
    expect(resolveItemOutputDirectory('F:/album-a/photo.jpg', 'custom', 'F:/picked')).toBe('F:/picked');
    expect(resolveItemOutputDirectory('F:/album-b/photo.jpg', 'custom', 'F:/picked')).toBe('F:/picked');
  });
});
