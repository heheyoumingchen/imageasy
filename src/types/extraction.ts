export type ExtractionDocumentInfo = {
  sourcePath: string;
  sourceName: string;
  extension: string;
  embeddedImageCount: number;
  pageCount: number;
};

export type ExtractionOutputFormat = 'png' | 'jpg';
export type ExtractionNamingPattern = 'source-name-index';

export type ExtractDocumentImagesRequest = {
  sourcePath: string;
  outputDirectory: string;
  outputFormat: ExtractionOutputFormat;
  namingPattern: ExtractionNamingPattern;
};

export type ExtractDocumentImagesResult = {
  outputPaths: string[];
  extractedCount: number;
  skippedCount: number;
};
