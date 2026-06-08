export type ExtractionDocumentInfo = {
  sourcePath: string;
  sourceName: string;
  extension: string;
  embeddedImageCount: number;
  pageCount: number;
};

export type ExtractionOutputFormat = 'png' | 'jpg';
export type ExtractionColorMode = 'rgb' | 'cmyk' | 'gray-cmyk';
export type ExtractionNamingPattern = 'source-name-index' | 'source-name-date';

export type ExtractDocumentImagesRequest = {
  sourcePath: string;
  outputDirectory: string;
  outputFormat: ExtractionOutputFormat;
  colorMode: ExtractionColorMode;
  namingPattern: ExtractionNamingPattern;
};

export type ExtractDocumentImagesResult = {
  outputPaths: string[];
  extractedCount: number;
  skippedCount: number;
};
