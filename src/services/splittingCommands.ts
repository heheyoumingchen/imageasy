import { invoke } from '@tauri-apps/api/core';
import type { InspectSplittingFileResult, SplitImageFileRequest, SplitImageFileResult } from '../types/splitting';

export const inspectSplittingFile = (path: string) =>
  invoke<InspectSplittingFileResult>('inspect_splitting_file', { path });

export const inspectSplittingDirectory = (path: string) =>
  invoke<InspectSplittingFileResult[]>('inspect_splitting_directory', { path });

export const splitImageFile = (request: SplitImageFileRequest) =>
  invoke<SplitImageFileResult>('split_image_file', { request });
