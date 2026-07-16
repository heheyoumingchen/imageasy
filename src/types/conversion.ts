export type ConversionSourceKind = 'image' | 'document' | 'unsupported';
export type ConversionOutputFormat = 'jpg' | 'png' | 'webp';
export type ConversionColorMode = 'rgb' | 'cmyk' | 'grayscale';
export type ConversionNamingPattern = 'source-name-index' | 'source-name-date' | 'source-name-original';
export type ConversionStatus = 'ready' | 'running' | 'success' | 'failed' | 'unsupported';
export type PageRangeMode = 'all' | 'custom';

export type ConversionImageMetadata = {
  width: number;
  height: number;
  extension: string;
};

export type ConversionDocumentMetadata = {
  // Office 文档（doc/docx/wps）导入时不启动 Office 探测页数，pageCount 为 null 表示未知。
  pageCount: number | null;
  extension: string;
};

// Tauri 边界返回的结构化渲染错误；service 层把对象化拒绝规整成它，页面按 code 映射本地文案。
export type ConversionCommandError = {
  code: string;
  message: string;
  diagnostic?: string;
  stage?: string;
  rendererKind?: 'word' | 'wps' | 'pdfium';
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
  // 仅当输出会替换源文件、且用户已通过批次覆盖确认时为 true。
  allowSourceOverwrite: boolean;
};

export type RenderDocumentToImagesRequest = {
  sourcePath: string;
  outputDirectory: string;
  outputFormat: ConversionOutputFormat;
  colorMode: ConversionColorMode;
  quality: number;
  pageNumbers: number[];
  renderDensity: 'standard' | 'high';
  namingPattern: ConversionNamingPattern;
};
