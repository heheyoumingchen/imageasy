import { invoke } from '@tauri-apps/api/core';
import type {
  CommitCropRequest,
  CommitCropResult,
  GenerateImagePreviewRequest,
  GenerateImagePreviewResult,
  OpenImageSessionResult,
  SaveImageAsJpgRequest,
  SaveImageAsJpgResult
} from '../types/editor';

export const openImageSession = (path: string) =>
  invoke<OpenImageSessionResult>('open_image_session', { path });

export const generateImagePreview = (request: GenerateImagePreviewRequest) =>
  invoke<GenerateImagePreviewResult>('generate_image_preview', { request });

export const saveImageAsJpg = (request: SaveImageAsJpgRequest) =>
  invoke<SaveImageAsJpgResult>('save_image_as_jpg', { request });

export const commitCropToWorkingImage = (request: CommitCropRequest) =>
  invoke<CommitCropResult>('commit_crop_to_working_image', { request });
