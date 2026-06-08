import { create } from 'zustand';
import {
  defaultAdjustmentParams,
  type AdjustmentKey,
  type AdjustmentParams,
  type CropRect,
  type EditorDirectoryImage,
  type EditorImageSummary,
  type EditorSnapshot,
  type FilterType,
  type PendingSwitchTarget,
  type Rotation,
  type WorkingImageSummary
} from '../types/editor';

type OpenImagesPayload = {
  currentImage: WorkingImageSummary;
  directoryImages: EditorDirectoryImage[];
  currentIndex: number;
};

type CommitDestructiveCropPayload = {
  workingImage: WorkingImageSummary;
  preservedAdjustments: AdjustmentParams;
};

type EditorStore = {
  originalImage: EditorImageSummary | null;
  currentImage: WorkingImageSummary | null;
  directoryImages: EditorDirectoryImage[];
  currentIndex: number;
  adjustments: AdjustmentParams;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  hasUnsavedChanges: boolean;
  pendingSwitchTarget: PendingSwitchTarget | null;
  openImages: (payload: OpenImagesPayload) => void;
  commitAdjustments: (next: AdjustmentParams) => void;
  commitDestructiveCrop: (payload: CommitDestructiveCropPayload) => void;
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

type EditorCheckpoint = {
  originalImage: EditorImageSummary | null;
  currentImage: WorkingImageSummary | null;
  currentIndex: number;
  adjustments: AdjustmentParams;
};

const createCheckpoint = (state: EditorCheckpoint): EditorCheckpoint => ({
  originalImage: state.originalImage,
  currentImage: state.currentImage,
  currentIndex: state.currentIndex,
  adjustments: state.adjustments
});

const hasCheckpointChanges = (state: EditorCheckpoint, savedCheckpoint: EditorCheckpoint) =>
  JSON.stringify(createCheckpoint(state)) !== JSON.stringify(savedCheckpoint);

const createSnapshot = (state: EditorCheckpoint & { hasUnsavedChanges: boolean }): EditorSnapshot => ({
  ...createCheckpoint(state),
  hasUnsavedChanges: state.hasUnsavedChanges
});

const initialState = {
  originalImage: null,
  currentImage: null,
  directoryImages: [],
  currentIndex: -1,
  adjustments: defaultAdjustmentParams,
  past: [] as EditorSnapshot[],
  future: [] as EditorSnapshot[],
  hasUnsavedChanges: false,
  pendingSwitchTarget: null
};

const initialCheckpoint = createCheckpoint(initialState);

export const useEditorStore = create<EditorStore>((set, get) => {
  let savedCheckpoint = initialCheckpoint;

  return {
    ...initialState,
  openImages: ({ currentImage, directoryImages, currentIndex }) => {
    savedCheckpoint = {
      originalImage: currentImage,
      currentImage,
      currentIndex,
      adjustments: defaultAdjustmentParams
    };

    set({
      originalImage: currentImage,
      currentImage,
      directoryImages,
      currentIndex,
      adjustments: defaultAdjustmentParams,
      past: [],
      future: [],
      hasUnsavedChanges: false,
      pendingSwitchTarget: null
    });
  },
  commitAdjustments: (next) =>
    set((state) => {
      if (JSON.stringify(state.adjustments) === JSON.stringify(next)) {
        return state;
      }

      const nextState = {
        originalImage: state.originalImage,
        currentImage: state.currentImage,
        currentIndex: state.currentIndex,
        adjustments: next
      };

      return {
        adjustments: next,
        past: [...state.past, createSnapshot(state)],
        future: [],
        hasUnsavedChanges: hasCheckpointChanges(nextState, savedCheckpoint)
      };
    }),
  commitDestructiveCrop: ({ workingImage, preservedAdjustments }) =>
    set((state) => {
      const normalizedAdjustments = {
        ...preservedAdjustments,
        rotation: 0 as Rotation,
        crop: null
      };

      const nextState = {
        originalImage: state.originalImage,
        currentImage: workingImage,
        currentIndex: state.currentIndex,
        adjustments: normalizedAdjustments
      };

      return {
        currentImage: workingImage,
        adjustments: normalizedAdjustments,
        past: [...state.past, createSnapshot(state)],
        future: [],
        hasUnsavedChanges: hasCheckpointChanges(nextState, savedCheckpoint)
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

    const previousCheckpoint = createCheckpoint(previous);

    set({
      originalImage: previous.originalImage,
      currentImage: previous.currentImage,
      currentIndex: previous.currentIndex,
      adjustments: previous.adjustments,
      past: state.past.slice(0, -1),
      future: [createSnapshot(state), ...state.future],
      hasUnsavedChanges: hasCheckpointChanges(previousCheckpoint, savedCheckpoint)
    });
  },
  redo: () => {
    const state = get();
    const [next, ...rest] = state.future;

    if (!next) {
      return;
    }

    const nextCheckpoint = createCheckpoint(next);

    set({
      originalImage: next.originalImage,
      currentImage: next.currentImage,
      currentIndex: next.currentIndex,
      adjustments: next.adjustments,
      past: [...state.past, createSnapshot(state)],
      future: rest,
      hasUnsavedChanges: hasCheckpointChanges(nextCheckpoint, savedCheckpoint)
    });
  },
  markSaved: () => {
    const state = get();
    savedCheckpoint = createCheckpoint(state);
    set({ hasUnsavedChanges: false, pendingSwitchTarget: null });
  },
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

    savedCheckpoint = {
      originalImage: currentImage,
      currentImage,
      currentIndex: index,
      adjustments: defaultAdjustmentParams
    };

    set({
      originalImage: currentImage,
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
  reset: () => {
    savedCheckpoint = initialCheckpoint;
    set(initialState);
  }
  };
});
