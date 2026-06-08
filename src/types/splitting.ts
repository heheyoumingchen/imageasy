export type SplittingSourceKind = 'image' | 'pdf' | 'unsupported';
export type SplittingOutputFormat = 'jpg' | 'png' | 'webp';
export type SplittingMode = 'horizontal' | 'vertical' | 'grid';
export type SplittingNamingPattern = 'source-name-index' | 'source-name-date';
export type SplittingStatus = 'ready' | 'running' | 'success' | 'failed';

export type SplittingImageMetadata = {
  width: number;
  height: number;
  extension: string;
};

export type SplittingPdfMetadata = {
  pageCount: number;
  extension: string;
};

export type InspectSplittingFileResult = {
  kind: SplittingSourceKind;
  sourcePath: string;
  sourceName: string;
  imageMetadata: SplittingImageMetadata | null;
  pdfMetadata: SplittingPdfMetadata | null;
  errorMessage: string | null;
};

export type SplitImageFileRequest = {
  sourcePath: string;
  outputDirectory: string;
  outputFormat: SplittingOutputFormat;
  columns: number;
  rows: number;
  quality: number;
  namingPattern: SplittingNamingPattern;
};

export type SplitImageFileResult = {
  outputPaths: string[];
  splitCount: number;
  skippedCount: number;
};

export type SplittingItem = InspectSplittingFileResult & {
  status: SplittingStatus;
  selected: boolean;
  outputPaths: string[];
  splitCount: number;
};
