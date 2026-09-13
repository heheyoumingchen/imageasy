import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  ImageDownloadMetadataEvent,
  InspectDownloadSourceRequest,
  InspectDownloadSourceResult,
  SaveDownloadImagesRequest,
  SaveDownloadImagesResult,
} from '../types/imageDownload';

export const inspectDownloadSource = (request: InspectDownloadSourceRequest) =>
  invoke<InspectDownloadSourceResult>('inspect_download_source', { request });

export const saveDownloadImages = (request: SaveDownloadImagesRequest) =>
  invoke<SaveDownloadImagesResult>('save_download_images', { request });

/** 经后端代理获取图片缩略图的本地缓存路径（绕过防盗链），失败返回 null。 */
export const fetchDownloadThumbnail = async (
  pageUrl: string,
  sourceUrl: string
): Promise<string | null> => {
  try {
    return await invoke<string>('download_image_thumbnail', { pageUrl, sourceUrl });
  } catch {
    return null;
  }
};

export const subscribeDownloadMetadata = (
  handler: (payload: ImageDownloadMetadataEvent) => void
): Promise<() => void> =>
  listen<ImageDownloadMetadataEvent>('image-download-metadata', (event) => {
    handler(event.payload);
  });
