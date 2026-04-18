import { create } from 'zustand';
import {
  defaultAdjustmentParams,
  type AdjustmentKey,
  type AdjustmentParams,
  type EditorDirectoryImage,
  type EditorImageSummary,
  type PendingSwitchTarget
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
  copiedAdjustments: AdjustmentParams | null;
  hasUnsavedChanges: boolean;
  pendingSwitchTarget: PendingSwitchTarget | null;
  openImages: (payload: OpenImagesPayload) => void;
  updateAdjustment: (key: AdjustmentKey, value: number) => void;
  copyAdjustments: () => void;
  pasteAdjustments: () => void;
  markSaved: () => void;
  requestSwitch: (target: PendingSwitchTarget) => void;
  confirmSwitch: () => void;
  cancelSwitch: () => void;
  switchToIndex: (index: number) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  reset: () => void;
};

const clampAdjustment = (value: number) => Math.max(-100, Math.min(100, value));

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
  copiedAdjustments: null,
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
      hasUnsavedChanges: false,
      pendingSwitchTarget: null
    }),
  updateAdjustment: (key, value) =>
    set((state) => ({
      adjustments: { ...state.adjustments, [key]: clampAdjustment(value) },
      hasUnsavedChanges: true
    })),
  copyAdjustments: () => set((state) => ({ copiedAdjustments: state.adjustments })),
  pasteAdjustments: () => {
    const copiedAdjustments = get().copiedAdjustments;

    if (!copiedAdjustments) {
      return;
    }

    set({
      adjustments: copiedAdjustments,
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
    set({ pendingSwitchTarget: null, hasUnsavedChanges: false, adjustments: defaultAdjustmentParams });
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

