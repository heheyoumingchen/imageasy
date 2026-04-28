import { create } from 'zustand';
import {
  defaultAdjustmentParams,
  type AdjustmentKey,
  type AdjustmentParams,
  type CropRect,
  type EditorDirectoryImage,
  type EditorImageSummary,
  type FilterType,
  type PendingSwitchTarget,
  type Rotation
} from '../types/editor';

type OpenImagesPayload = {
  currentImage: EditorImageSummary;
  directoryImages: EditorDirectoryImage[];
  currentIndex: number;
};

type EditorStore = {
  currentImage: EditorImageSummary | null;
  directoryImages: EditorDirectoryImage[];
  currentIndex: number;
  adjustments: AdjustmentParams;
  past: AdjustmentParams[];
  future: AdjustmentParams[];
  hasUnsavedChanges: boolean;
  pendingSwitchTarget: PendingSwitchTarget | null;
  openImages: (payload: OpenImagesPayload) => void;
  commitAdjustments: (next: AdjustmentParams) => void;
  updateAdjustment: (key: AdjustmentKey, value: number) => void;
  updateFilter: (filterType: FilterType) => void;
  updateFilterIntensity: (value: number) => void;
  resetFilters: () => void;
  rotateLeft: () => void;
  rotateRight: () => void;
  applyCrop: (crop: CropRect | null) => void;
  clearCrop: () => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
  requestSwitch: (target: PendingSwitchTarget) => void;
  confirmSwitch: () => void;
  cancelSwitch: () => void;
  switchToIndex: (index: number) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  reset: () => void;
};

const clampAdjustment = (key: AdjustmentKey, value: number) => {
  if (key === 'quality') {
    return Math.max(1, Math.min(100, value));
  }

  return Math.max(-100, Math.min(100, value));
};

const clampFilterIntensity = (value: number) => Math.max(0, Math.min(100, value));

const rotateBy = (rotation: Rotation, delta: 90 | -90): Rotation => {
  const normalized = (rotation + delta + 360) % 360;
  return normalized as Rotation;
};

const buildImageFromIndex = (images: EditorDirectoryImage[], index: number) => {
  const target = images[index];

  if (!target) {
    return null;
  }

  const { path, name, extension, width, height, sizeBytes } = target;
  return { path, name, extension, width, height, sizeBytes } satisfies EditorImageSummary;
};

const initialState = {
  currentImage: null,
  directoryImages: [],
  currentIndex: -1,
  adjustments: defaultAdjustmentParams,
  past: [] as AdjustmentParams[],
  future: [] as AdjustmentParams[],
  hasUnsavedChanges: false,
  pendingSwitchTarget: null
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...initialState,
  openImages: ({ currentImage, directoryImages, currentIndex }) =>
    set({
      currentImage,
      directoryImages,
      currentIndex,
      adjustments: defaultAdjustmentParams,
      past: [],
      future: [],
      hasUnsavedChanges: false,
      pendingSwitchTarget: null
    }),
  commitAdjustments: (next) =>
    set((state) => {
      if (JSON.stringify(state.adjustments) === JSON.stringify(next)) {
        return state;
      }

      return {
        adjustments: next,
        past: [...state.past, state.adjustments],
        future: [],
        hasUnsavedChanges: true
      };
    }),
  updateAdjustment: (key, value) => {
    const next = { ...get().adjustments, [key]: clampAdjustment(key, value) };
    get().commitAdjustments(next);
  },
  updateFilter: (filterType) => {
    const state = get();
    const next = {
      ...state.adjustments,
      filterType,
      filterIntensity: filterType === 'none' ? 0 : 100
    };
    state.commitAdjustments(next);
  },
  updateFilterIntensity: (value) => {
    const state = get();
    const next = { ...state.adjustments, filterIntensity: clampFilterIntensity(value) };
    state.commitAdjustments(next);
  },
  resetFilters: () => {
    const state = get();
    const next = { ...state.adjustments, filterType: 'none' as const, filterIntensity: 0 };
    state.commitAdjustments(next);
  },
  rotateLeft: () => {
    const state = get();
    state.commitAdjustments({ ...state.adjustments, rotation: rotateBy(state.adjustments.rotation, -90) });
  },
  rotateRight: () => {
    const state = get();
    state.commitAdjustments({ ...state.adjustments, rotation: rotateBy(state.adjustments.rotation, 90) });
  },
  applyCrop: (crop) => {
    const state = get();
    state.commitAdjustments({ ...state.adjustments, crop });
  },
  clearCrop: () => {
    const state = get();
    state.commitAdjustments({ ...state.adjustments, crop: null });
  },
  undo: () => {
    const state = get();
    const previous = state.past[state.past.length - 1];

    if (!previous) {
      return;
    }

    set({
      adjustments: previous,
      past: state.past.slice(0, -1),
      future: [state.adjustments, ...state.future],
      hasUnsavedChanges: true
    });
  },
  redo: () => {
    const state = get();
    const [next, ...rest] = state.future;

    if (!next) {
      return;
    }

    set({
      adjustments: next,
      past: [...state.past, state.adjustments],
      future: rest,
      hasUnsavedChanges: true
    });
  },
  markSaved: () => set({ hasUnsavedChanges: false, pendingSwitchTarget: null }),
  requestSwitch: (target) => {
    if (get().hasUnsavedChanges) {
      set({ pendingSwitchTarget: target });
      return;
    }

    get().switchToIndex(target.index);
  },
  confirmSwitch: () => {
    const pendingSwitchTarget = get().pendingSwitchTarget;

    if (!pendingSwitchTarget) {
      return;
    }

    get().switchToIndex(pendingSwitchTarget.index);
    set({ pendingSwitchTarget: null, hasUnsavedChanges: false });
  },
  cancelSwitch: () => set({ pendingSwitchTarget: null }),
  switchToIndex: (index) => {
    const images = get().directoryImages;
    const currentImage = buildImageFromIndex(images, index);

    if (!currentImage) {
      return;
    }

    set({
      currentImage,
      currentIndex: index,
      adjustments: defaultAdjustmentParams,
      past: [],
      future: [],
      hasUnsavedChanges: false,
      pendingSwitchTarget: null
    });
  },
  goToPrevious: () => {
    const { currentIndex } = get();
    if (currentIndex <= 0) {
      return;
    }

    get().requestSwitch({ index: currentIndex - 1, reason: 'previous' });
  },
  goToNext: () => {
    const { currentIndex, directoryImages } = get();
    if (currentIndex < 0 || currentIndex >= directoryImages.length - 1) {
      return;
    }

    get().requestSwitch({ index: currentIndex + 1, reason: 'next' });
  },
  reset: () => set(initialState)
}));
