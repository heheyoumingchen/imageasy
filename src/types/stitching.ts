import type { CanvasRatio } from './stitchingLayout';

export type StitchingOutputFormat = 'jpg' | 'png' | 'webp';
export type StitchingNamingPattern = 'source-name-index' | 'source-name-date';
export type StitchingStatus = 'ready' | 'running' | 'success' | 'failed';
export type StitchingResolution = 768 | 1080 | 1536 | 2160;
export type StitchingQuality = number; // 0-100

export type StitchingImageMetadata = {
  width: number;
  height: number;
  extension: string;
};

export type InspectStitchingFileResult = {
  kind: 'image' | 'unsupported';
  sourcePath: string;
  sourceName: string;
  imageMetadata: StitchingImageMetadata | null;
  errorMessage: string | null;
};

export type StitchLayoutCell = {
  sourcePath: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
};

export type StitchImageFilesRequest = {
  cells: StitchLayoutCell[];
  rows: number;
  cols: number;
  canvasRatio: CanvasRatio;
  resolution: StitchingResolution;
  padding: number;
  spacing: number;
  borderRadius: number;
  backgroundColor: string;
  quality: StitchingQuality;
  outputDirectory: string;
  outputFormat: StitchingOutputFormat;
  namingPattern: StitchingNamingPattern;
};

export type StitchImageFilesResult = {
  outputPath: string;
  stitchedCount: number;
};

export type StitchingItem = InspectStitchingFileResult & {
  status: StitchingStatus;
  selected: boolean;
  outputPath: string | null;
};

export type StitchingCanvasImage = {
  path: string;
  name: string;
  preview?: string;
  metadata: StitchingImageMetadata | null;
};
