export type ConversionSourceKind = 'image' | 'document' | 'unsupported';
export type ConversionOutputFormat = 'jpg' | 'png' | 'webp';
export type ConversionColorMode = 'rgb' | 'cmyk' | 'gray-cmyk';
export type ConversionStatus = 'inspecting' | 'ready' | 'running' | 'success' | 'failed' | 'unsupported';
export type PageRangeMode = 'all' | 'custom';

export type ConversionImageMetadata = {
  width: number;
  height: number;
  extension: string;
};

export type ConversionDocumentMetadata = {
  pageCount: number;
  extension: string;
};

export type ConversionOutputSettings = {
  outputFormat: ConversionOutputFormat;
  colorMode: ConversionColorMode;
  quality: number;
  pageRangeMode: PageRangeMode;
  pageRangeText: string;
  renderDensity: 'standard' | 'high';
  outputDirectory: string;
  namingPattern: 'source-name' | 'source-name-page';
  collisionStrategy: 'overwrite' | 'rename' | 'skip';
};

export type ConversionItem = {
  id: string;
  sourcePath: string;
  sourceName: string;
  kind: ConversionSourceKind;
  status: ConversionStatus;
  errorMessage: string | null;
  outputSuffix: string;
  outputSettingsOverride: {
    pageRangeMode?: PageRangeMode;
    pageRangeText?: string;
    outputSuffix?: string;
  };
  imageMetadata: ConversionImageMetadata | null;
  documentMetadata: ConversionDocumentMetadata | null;
  outputPaths: string[];
};

export type InspectConversionFileResult = {
  kind: ConversionSourceKind;
  sourcePath: string;
  sourceName: string;
  imageMetadata: ConversionImageMetadata | null;
  documentMetadata: ConversionDocumentMetadata | null;
  errorMessage: string | null;
};

export type ConvertImageFileRequest = {
  sourcePath: string;
  outputPath: string;
  outputFormat: ConversionOutputFormat;
  colorMode: ConversionColorMode;
  quality?: number;
};

export type RenderDocumentToImagesRequest = {
  sourcePath: string;
  outputDirectory: string;
  outputFormat: ConversionOutputFormat;
  colorMode: ConversionColorMode;
  pageNumbers: number[];
  renderDensity: 'standard' | 'high';
  namingPattern: 'source-name' | 'source-name-page';
};
