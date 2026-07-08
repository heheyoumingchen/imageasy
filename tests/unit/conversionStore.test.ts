import { beforeEach, describe, expect, it } from 'vitest';
import { useConversionStore } from '../../src/stores/conversionStore';
import { getSettingsStore } from '../../src/hooks/useSettingsStore';
import { DEFAULT_SETTINGS } from '../../src/stores/settingsStore';

const readyImage = {
  id: 'a',
  sourcePath: 'F:/demo/a.jpg',
  sourceName: 'a.jpg',
  sourceStem: 'a',
  kind: 'image' as const,
  status: 'ready' as const,
  errorMessage: null,
  outputSettingsOverride: {},
  imageMetadata: { width: 800, height: 600, extension: 'jpg' },
  documentMetadata: null,
  selected: true,
  outputPaths: []
};

const readyDocument = {
  id: 'b',
  sourcePath: 'F:/demo/b.pdf',
  sourceName: 'b.pdf',
  sourceStem: 'b',
  kind: 'document' as const,
  status: 'ready' as const,
  errorMessage: null,
  outputSettingsOverride: {},
  imageMetadata: null,
  documentMetadata: { pageCount: 12, extension: 'pdf' },
  selected: true,
  outputPaths: []
};

describe('conversionStore', () => {
  beforeEach(() => {
    useConversionStore.getState().reset();
    getSettingsStore().setState({ exportSettings: { ...DEFAULT_SETTINGS.exportSettings } });
  });

  it('hydrates new items and selects the first supported one', () => {
    useConversionStore.getState().setItems([readyImage, readyDocument]);

    expect(useConversionStore.getState().items).toHaveLength(2);
    expect(useConversionStore.getState().selectedItemId).toBe('a');
  });

  it('reads output format and color mode from settings store for document summaries', () => {
    useConversionStore.getState().setItems([readyDocument]);
    getSettingsStore().setState({
      exportSettings: { ...DEFAULT_SETTINGS.exportSettings, outputFormat: 'png', colorMode: 'grayscale' }
    });
    useConversionStore.getState().updateGlobalSettings({ pageRangeMode: 'all', pageRangeText: '' });

    expect(useConversionStore.getState().buildItemSummary('b')).toBe('PNG / 灰度 / 全部页');
  });

  it('supports single-item page-range overrides without changing the batch color mode', () => {
    useConversionStore.getState().setItems([readyDocument]);
    getSettingsStore().setState({ exportSettings: { ...DEFAULT_SETTINGS.exportSettings, colorMode: 'cmyk' } });
    useConversionStore.getState().updateItemOverride('b', { pageRangeMode: 'custom', pageRangeText: '2-4' });

    expect(useConversionStore.getState().buildEffectiveDocumentPages('b')).toEqual([2, 3, 4]);
    expect(getSettingsStore().getState().exportSettings.colorMode).toBe('cmyk');
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
