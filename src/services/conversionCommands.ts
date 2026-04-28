import { invoke } from '@tauri-apps/api/core';
import type { ConvertImageFileRequest, InspectConversionFileResult, RenderDocumentToImagesRequest } from '../types/conversion';

export const inspectConversionFile = (path: string) => invoke<InspectConversionFileResult>('inspect_conversion_file', { path });
export const inspectConversionDirectory = (path: string) => invoke<InspectConversionFileResult[]>('inspect_conversion_directory', { path });
export const convertImageFile = (request: ConvertImageFileRequest) => invoke<string[]>('convert_image_file', { request });
export const renderDocumentToImages = (request: RenderDocumentToImagesRequest) =>
  invoke<string[]>('render_document_to_images', { request });
