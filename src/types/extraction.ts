export type ExtractionDocumentInfo = {
  sourcePath: string;
  sourceName: string;
  extension: string;
  embeddedImageCount: number;
  pageCount: number;
};

export type ExtractionOutputFormat = 'png' | 'jpg';
export type ExtractionColorMode = 'rgb' | 'cmyk' | 'grayscale';
export type ExtractionNamingPattern = 'source-name-index' | 'source-name-date' | 'source-name-original';

export type ExtractDocumentImagesRequest = {
  sourcePath: string;
  outputDirectory: string;
  outputFormat: ExtractionOutputFormat;
  colorMode: ExtractionColorMode;
  quality: number;
  namingPattern: ExtractionNamingPattern;
  includeOutputPaths?: boolean;
};

export type ExtractDocumentImagesResult = {
  outputPaths: string[];
  extractedCount: number;
  skippedCount: number;
};
