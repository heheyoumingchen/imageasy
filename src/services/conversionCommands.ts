import { invoke } from '@tauri-apps/api/core';
import type { ConvertImageFileRequest, InspectConversionFileResult, RenderDocumentToImagesRequest } from '../types/conversion';
import { normalizeConversionError } from '../utils/errors';

// 归一化 Tauri 边界错误：结构化对象错误（CommandError）不应变成 [object Object]。
const invokeConversion = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw normalizeConversionError(error);
  }
};

export const inspectConversionFile = (path: string) =>
  invokeConversion<InspectConversionFileResult>('inspect_conversion_file', { path });
export const inspectConversionDirectory = (path: string) =>
  invokeConversion<InspectConversionFileResult[]>('inspect_conversion_directory', { path });
export const convertImageFile = (request: ConvertImageFileRequest) =>
  invokeConversion<string[]>('convert_image_file', { request });
export const renderDocumentToImages = (request: RenderDocumentToImagesRequest) =>
  invokeConversion<string[]>('render_document_to_images', { request });
