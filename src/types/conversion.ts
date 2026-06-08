export type ConversionSourceKind = 'image' | 'document' | 'unsupported';
export type ConversionOutputFormat = 'jpg' | 'png' | 'webp';
export type ConversionColorMode = 'rgb' | 'cmyk' | 'gray-cmyk';
export type ConversionStatus = 'ready' | 'running' | 'success' | 'failed' | 'unsupported';
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
  pageRangeMode: PageRangeMode;
  pageRangeText: string;
  renderDensity: 'standard' | 'high';
  outputDirectory: string;
};

export type ConversionItem = {
  id: string;
  sourcePath: string;
  sourceName: string;
  sourceStem: string;
  kind: ConversionSourceKind;
  status: ConversionStatus;
  errorMessage: string | null;
  outputSettingsOverride: {
    pageRangeMode?: PageRangeMode;
    pageRangeText?: string;
  };
  imageMetadata: ConversionImageMetadata | null;
  documentMetadata: ConversionDocumentMetadata | null;
  selected: boolean;
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
  namingPattern: 'source-name-index' | 'source-name-date';
};
