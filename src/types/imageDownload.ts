export type ImageDownloadMode = 'webpage' | 'wechat-article';

export type DownloadableImageItem = {
  id: string;
  sourceUrl: string;
  name: string;
  title: string;
  sizeInBytes: number;
  format: string | null;
  width: number | null;
  height: number | null;
  previewUrl: string;
};

export type ImageDownloadMetadataEvent = {
  id: string;
  sizeInBytes: number;
  format: string | null;
};

export type InspectDownloadSourceRequest = {
  mode: ImageDownloadMode;
  url: string;
};

export type InspectDownloadSourceResult = {
  pageTitle: string;
  images: DownloadableImageItem[];
};

export type SaveDownloadImagesRequest = {
  mode: ImageDownloadMode;
  pageUrl: string;
  outputDirectory: string;
  imageIds: string[];
};

export type SaveDownloadImagesResult = {
  savedCount: number;
  skippedCount: number;
  outputPaths: string[];
};
