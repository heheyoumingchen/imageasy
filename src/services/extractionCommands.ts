import { invoke } from '@tauri-apps/api/core';
import type { ExtractDocumentImagesRequest, ExtractDocumentImagesResult, ExtractionDocumentInfo } from '../types/extraction';

export const inspectExtractionDocument = (path: string) =>
  invoke<ExtractionDocumentInfo>('inspect_extraction_document', { path });

export const extractDocumentImages = (request: ExtractDocumentImagesRequest) =>
  invoke<ExtractDocumentImagesResult>('extract_document_images', { request });
