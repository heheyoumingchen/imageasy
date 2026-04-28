import { beforeEach, describe, expect, it } from 'vitest';
import { useConversionStore } from '../../src/stores/conversionStore';

const readyImage = {
  id: 'a',
  sourcePath: 'F:/demo/a.jpg',
  sourceName: 'a.jpg',
  kind: 'image' as const,
  status: 'ready' as const,
  errorMessage: null,
  outputSuffix: '',
  outputSettingsOverride: {},
  imageMetadata: { width: 800, height: 600, extension: 'jpg' },
  documentMetadata: null,
  outputPaths: []
};

const readyDocument = {
  id: 'b',
  sourcePath: 'F:/demo/b.pdf',
  sourceName: 'b.pdf',
  kind: 'document' as const,
  status: 'ready' as const,
  errorMessage: null,
  outputSuffix: '',
  outputSettingsOverride: {},
  imageMetadata: null,
  documentMetadata: { pageCount: 12, extension: 'pdf' },
  outputPaths: []
};

describe('conversionStore', () => {
  beforeEach(() => {
    useConversionStore.getState().reset();
  });

  it('hydrates new items and selects the first supported one', () => {
    useConversionStore.getState().setItems([readyImage, readyDocument]);

    expect(useConversionStore.getState().items).toHaveLength(2);
    expect(useConversionStore.getState().selectedItemId).toBe('a');
  });

  it('updates global output settings and keeps document defaults on all pages', () => {
    useConversionStore.getState().setItems([readyDocument]);
    useConversionStore.getState().updateGlobalSettings({
      outputFormat: 'png',
      colorMode: 'gray-cmyk',
      pageRangeMode: 'all',
      pageRangeText: ''
    });

    expect(useConversionStore.getState().globalSettings.outputFormat).toBe('png');
    expect(useConversionStore.getState().globalSettings.colorMode).toBe('gray-cmyk');
    expect(useConversionStore.getState().buildItemSummary('b')).toBe('PNG / 灰度 CMYK / 全部页');
  });

  it('supports single-item page-range overrides without changing the batch color mode', () => {
    useConversionStore.getState().setItems([readyDocument]);
    useConversionStore.getState().updateGlobalSettings({ colorMode: 'cmyk' });
    useConversionStore.getState().updateItemOverride('b', { pageRangeMode: 'custom', pageRangeText: '2-4' });

    expect(useConversionStore.getState().buildEffectiveDocumentPages('b')).toEqual([2, 3, 4]);
    expect(useConversionStore.getState().globalSettings.colorMode).toBe('cmyk');
  });

  it('aggregates batch progress from per-item statuses', () => {
    useConversionStore.getState().setItems([
      readyImage,
      readyDocument,
      { ...readyDocument, id: 'c', status: 'failed', errorMessage: '输出目录不可写' }
    ]);
    useConversionStore.getState().markItemRunning('a');
    useConversionStore.getState().markItemSucceeded('a', ['F:/out/a.jpg']);

    expect(useConversionStore.getState().stats.total).toBe(3);
    expect(useConversionStore.getState().stats.success).toBe(1);
    expect(useConversionStore.getState().stats.failed).toBe(1);
    expect(useConversionStore.getState().stats.ready).toBe(1);
  });
});
