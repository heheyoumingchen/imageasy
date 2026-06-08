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

export const subscribeDownloadMetadata = (
  handler: (payload: ImageDownloadMetadataEvent) => void
): Promise<() => void> =>
  listen<ImageDownloadMetadataEvent>('image-download-metadata', (event) => {
    handler(event.payload);
  });
