import { create } from 'zustand';
import { buildConversionSummary } from '../utils/conversionFormats';
import { expandPageRange } from '../utils/pageRange';
import type { ConversionItem, ConversionOutputSettings, ConversionStatus } from '../types/conversion';

type ConversionStats = {
  total: number;
  ready: number;
  running: number;
  success: number;
  failed: number;
  unsupported: number;
};

type ConversionStore = {
  items: ConversionItem[];
  selectedItemId: string | null;
  globalSettings: ConversionOutputSettings;
  stats: ConversionStats;
  setItems: (items: ConversionItem[]) => void;
  selectItem: (id: string) => void;
  updateGlobalSettings: (partial: Partial<ConversionOutputSettings>) => void;
  updateItemOverride: (id: string, partial: ConversionItem['outputSettingsOverride']) => void;
  buildEffectiveDocumentPages: (id: string) => number[];
  buildItemSummary: (id: string) => string;
  markItemRunning: (id: string) => void;
  markItemSucceeded: (id: string, outputPaths: string[]) => void;
  markItemFailed: (id: string, errorMessage: string) => void;
  reset: () => void;
};

const defaultGlobalSettings: ConversionOutputSettings = {
  outputFormat: 'jpg',
  colorMode: 'rgb',
  quality: 90,
  pageRangeMode: 'all',
  pageRangeText: '',
  renderDensity: 'standard',
  outputDirectory: '',
  namingPattern: 'source-name-page',
  collisionStrategy: 'rename'
};

const buildStats = (items: ConversionItem[]): ConversionStats => ({
  total: items.length,
  ready: items.filter((item) => item.status === 'ready').length,
  running: items.filter((item) => item.status === 'running').length,
  success: items.filter((item) => item.status === 'success').length,
  failed: items.filter((item) => item.status === 'failed').length,
  unsupported: items.filter((item) => item.status === 'unsupported').length
});

const setItemStatus = (items: ConversionItem[], id: string, status: ConversionStatus, extra: Partial<ConversionItem> = {}) =>
  items.map((item): ConversionItem => (item.id === id ? { ...item, ...extra, status } : item));

const buildImageSummary = (settings: ConversionOutputSettings) =>
  buildConversionSummary({
    outputFormat: settings.outputFormat,
    colorMode: settings.colorMode
  });

const buildDocumentSummary = (settings: ConversionOutputSettings, item: ConversionItem) =>
  buildConversionSummary({
    outputFormat: settings.outputFormat,
    colorMode: settings.colorMode,
    pageRangeMode: item.outputSettingsOverride.pageRangeMode ?? settings.pageRangeMode,
    pageRangeText: item.outputSettingsOverride.pageRangeText ?? settings.pageRangeText
  });

export const useConversionStore = create<ConversionStore>((set, get) => ({
  items: [],
  selectedItemId: null,
  globalSettings: defaultGlobalSettings,
  stats: buildStats([]),
  setItems: (items) =>
    set({
      items,
      selectedItemId: items.find((item) => item.kind !== 'unsupported')?.id ?? items[0]?.id ?? null,
      stats: buildStats(items)
    }),
  selectItem: (id) => set({ selectedItemId: id }),
  updateGlobalSettings: (partial) =>
    set((state) => ({
      globalSettings: { ...state.globalSettings, ...partial }
    })),
  updateItemOverride: (id, partial) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              outputSettingsOverride: {
                ...item.outputSettingsOverride,
                ...partial
              }
            }
          : item
      )
    })),
  buildEffectiveDocumentPages: (id) => {
    const item = get().items.find((entry) => entry.id === id);

    if (!item?.documentMetadata) {
      return [];
    }

    const pageRangeMode = item.outputSettingsOverride.pageRangeMode ?? get().globalSettings.pageRangeMode;
    const pageRangeText = item.outputSettingsOverride.pageRangeText ?? get().globalSettings.pageRangeText;

    if (pageRangeMode === 'all') {
      return Array.from({ length: item.documentMetadata.pageCount }, (_, index) => index + 1);
    }

    return expandPageRange(pageRangeText, item.documentMetadata.pageCount);
  },
  buildItemSummary: (id) => {
    const item = get().items.find((entry) => entry.id === id);

    if (!item) {
      return '';
    }

    return item.kind === 'document' ? buildDocumentSummary(get().globalSettings, item) : buildImageSummary(get().globalSettings);
  },
  markItemRunning: (id) =>
    set((state) => {
      const items = setItemStatus(state.items, id, 'running', { errorMessage: null });
      return { items, stats: buildStats(items) };
    }),
  markItemSucceeded: (id, outputPaths) =>
    set((state) => {
      const items = setItemStatus(state.items, id, 'success', { outputPaths });
      return { items, stats: buildStats(items) };
    }),
  markItemFailed: (id, errorMessage) =>
    set((state) => {
      const items = setItemStatus(state.items, id, 'failed', { errorMessage });
      return { items, stats: buildStats(items) };
    }),
  reset: () =>
    set({
      items: [],
      selectedItemId: null,
      globalSettings: defaultGlobalSettings,
      stats: buildStats([])
    })
}));
