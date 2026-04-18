export type AdjustmentKey = 'brightness' | 'contrast' | 'saturation';

export type AdjustmentParams = {
  brightness: number;
  contrast: number;
  saturation: number;
};

export type EditorImageSummary = {
  path: string;
  name: string;
  extension: string;
  width: number;
  height: number;
  sizeBytes: number;
};

export type EditorDirectoryImage = EditorImageSummary & {
  index: number;
  thumbnailDataUrl: string;
};

export type OpenImageSessionResult = {
  currentImage: EditorImageSummary;
  directoryImages: EditorDirectoryImage[];
  currentIndex: number;
};

export type GenerateImagePreviewRequest = {
  path: string;
  adjustments: AdjustmentParams;
  maxWidth?: number;
  maxHeight?: number;
};

export type GenerateImagePreviewResult = {
  dataUrl: string;
  width: number;
  height: number;
};

export type SaveImageAsJpgRequest = {
  sourcePath: string;
  targetPath: string;
  adjustments: AdjustmentParams;
  quality?: number;
};

export type SaveImageAsJpgResult = {
  savedPath: string;
  sizeBytes: number;
};

export type PendingSwitchTarget = {
  index: number;
  reason: 'thumbnail' | 'previous' | 'next';
};

export type EditorSessionState = {
  currentImage: EditorImageSummary | null;
  directoryImages: EditorDirectoryImage[];
  currentIndex: number;
  adjustments: AdjustmentParams;
  copiedAdjustments: AdjustmentParams | null;
  hasUnsavedChanges: boolean;
  pendingSwitchTarget: PendingSwitchTarget | null;
};

export const defaultAdjustmentParams: AdjustmentParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0
};
