import { invoke } from '@tauri-apps/api/core';
import type {
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
