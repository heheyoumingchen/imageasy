import { invoke } from '@tauri-apps/api/core';
import type { InspectStitchingFileResult, StitchImageFilesRequest, StitchImageFilesResult } from '../types/stitching';

export const inspectStitchingFile = (path: string) =>
  invoke<InspectStitchingFileResult>('inspect_stitching_file', { path });

export const inspectStitchingDirectory = (path: string) =>
  invoke<InspectStitchingFileResult[]>('inspect_stitching_directory', { path });

export const stitchImageFiles = (request: StitchImageFilesRequest) =>
  invoke<StitchImageFilesResult>('stitch_image_files', { request });
