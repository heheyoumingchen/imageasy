export type AdjustmentKey = 'brightness' | 'contrast' | 'saturation' | 'sharpen' | 'clarity' | 'quality';
export type FilterType = 'none' | 'grayscale' | 'warm' | 'cool' | 'vintage';
export type Rotation = 0 | 90 | 180 | 270;

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AdjustmentParams = {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: number;
  clarity: number;
  quality: number;
  filterType: FilterType;
  filterIntensity: number;
  rotation: Rotation;
  crop: CropRect | null;
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
  hasUnsavedChanges: boolean;
  pendingSwitchTarget: PendingSwitchTarget | null;
};

export const defaultAdjustmentParams: AdjustmentParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpen: 0,
  clarity: 0,
  quality: 90,
  filterType: 'none',
  filterIntensity: 0,
  rotation: 0,
  crop: null
};
