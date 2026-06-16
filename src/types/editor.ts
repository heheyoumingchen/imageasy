export type AdjustmentKey = 'brightness' | 'contrast' | 'saturation' | 'temperature' | 'tint' | 'sharpen' | 'clarity' | 'quality';
export type FilterType =
  | 'none'
  | 'grayscale'
  | 'warm'
  | 'cool'
  | 'vintage'
  | 'sepia'
  | 'vivid'
  | 'fade'
  | 'cinematic'
  | 'noir'
  | 'polaroid'
  | 'dreamy'
  | 'summer'
  | 'forest';
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
  temperature: number;
  tint: number;
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

export type WorkingImageSummary = EditorImageSummary;

export type EditorDirectoryImage = EditorImageSummary & {
  index: number;
  thumbnailDataUrl: string;
};

export type EditorSnapshot = {
  originalImage: EditorImageSummary | null;
  currentImage: WorkingImageSummary | null;
  currentIndex: number;
  adjustments: AdjustmentParams;
  hasUnsavedChanges: boolean;
};

export type OpenImageSessionResult = {
  currentImage: WorkingImageSummary;
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
  previewPath: string | null;
  dataUrl: string | null;
  width: number;
  height: number;
};

export type PrefetchImagePreviewRequest = {
  path: string;
  maxWidth?: number;
  maxHeight?: number;
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

export type CommitCropRequest = {
  sourcePath: string;
  rotation: Rotation;
  crop: CropRect;
};

export type CommitCropResult = {
  workingImage: WorkingImageSummary;
};

export type PendingSwitchTarget = {
  index: number;
  reason: 'thumbnail' | 'previous' | 'next';
};


export const defaultAdjustmentParams: AdjustmentParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  sharpen: 0,
  clarity: 0,
  quality: 100,
  filterType: 'none',
  filterIntensity: 0,
  rotation: 0,
  crop: null
};
