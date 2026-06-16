import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import type {
  CommitCropRequest,
  CommitCropResult,
  GenerateImagePreviewRequest,
  GenerateImagePreviewResult,
  OpenImageSessionResult,
  PrefetchImagePreviewRequest,
  SaveImageAsJpgRequest,
  SaveImageAsJpgResult
} from '../types/editor';

export const openImageSession = (path: string) =>
  invoke<OpenImageSessionResult>('open_image_session', { path });

export const generateEditorThumbnail = (path: string) =>
  invoke<string>('generate_editor_thumbnail', { path });

export const generateImagePreview = async (request: GenerateImagePreviewRequest) => {
  const result = await invoke<GenerateImagePreviewResult>('generate_image_preview', { request });
  return {
    ...result,
    previewUrl: convertFileSrc(result.previewPath)
  };
};

export const prefetchImagePreview = (request: PrefetchImagePreviewRequest) =>
  invoke<void>('prefetch_image_preview', { request });

export const saveImageAsJpg = (request: SaveImageAsJpgRequest) =>
  invoke<SaveImageAsJpgResult>('save_image_as_jpg', { request });

export const commitCropToWorkingImage = (request: CommitCropRequest) =>
  invoke<CommitCropResult>('commit_crop_to_working_image', { request });
