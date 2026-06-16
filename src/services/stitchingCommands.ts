import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { InspectStitchingFileResult, StitchImageFilesRequest, StitchImageFilesResult } from '../types/stitching';

export const inspectStitchingFile = async (path: string) => {
  const result = await invoke<InspectStitchingFileResult>('inspect_stitching_file', { path });
  return {
    ...result,
    thumbnail: result.thumbnail && !result.thumbnail.startsWith('data:')
      ? convertFileSrc(result.thumbnail)
      : result.thumbnail
  };
};

export const inspectStitchingDirectory = async (path: string) => {
  const results = await invoke<InspectStitchingFileResult[]>('inspect_stitching_directory', { path });
  return results.map(result => ({
    ...result,
    thumbnail: result.thumbnail && !result.thumbnail.startsWith('data:')
      ? convertFileSrc(result.thumbnail)
      : result.thumbnail
  }));
};

export const stitchImageFiles = (request: StitchImageFilesRequest) =>
  invoke<StitchImageFilesResult>('stitch_image_files', { request });
