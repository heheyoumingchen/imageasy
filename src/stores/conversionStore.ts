import { create } from 'zustand';
import { buildConversionSummary } from '../utils/conversionFormats';
import { expandPageRange } from '../utils/pageRange';
import { getSettingsStore } from '../hooks/useSettingsStore';
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
  toggleItemSelected: (id: string) => void;
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
  pageRangeMode: 'all',
  pageRangeText: '',
  renderDensity: 'standard',
  outputDirectory: ''
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

const buildImageSummary = () => {
  const exportSettings = getSettingsStore().getState().exportSettings;
  return buildConversionSummary({
    outputFormat: exportSettings.outputFormat,
    colorMode: exportSettings.colorMode
  });
};

const buildDocumentSummary = (settings: ConversionOutputSettings, item: ConversionItem) => {
  const exportSettings = getSettingsStore().getState().exportSettings;
  return buildConversionSummary({
    outputFormat: exportSettings.outputFormat,
    colorMode: exportSettings.colorMode,
    pageRangeMode: item.outputSettingsOverride.pageRangeMode ?? settings.pageRangeMode,
    pageRangeText: item.outputSettingsOverride.pageRangeText ?? settings.pageRangeText,
    pageCount: item.documentMetadata?.pageCount ?? null
  });
};

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
  toggleItemSelected: (id) =>
    set((state) => {
      const items = state.items.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item));
      return { items, stats: buildStats(items) };
    }),
  updateGlobalSettings: (partial) =>
    set((state) => {
      const items = state.items.map((item): ConversionItem =>
        item.status === 'success' || item.status === 'failed'
          ? { ...item, status: 'ready', errorMessage: null, outputPaths: [] }
          : item
      );
      return {
        globalSettings: { ...state.globalSettings, ...partial },
        items,
        stats: buildStats(items)
      };
    }),
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

    // all 交给后端展开（空列表 = 全部页），未知页数时也无从枚举。
    if (pageRangeMode === 'all') {
      return [];
    }

    // 页数已知时才用上界校验；未知（Office 文档）仅做语法解析。
    return expandPageRange(pageRangeText, item.documentMetadata.pageCount ?? undefined);
  },
  buildItemSummary: (id) => {
    const item = get().items.find((entry) => entry.id === id);

    if (!item) {
      return '';
    }

    return item.kind === 'document' ? buildDocumentSummary(get().globalSettings, item) : buildImageSummary();
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
