import { describe, expect, it, vi } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  convertFileSrc: (path: string) => `asset://${path}`,
}));

import { getAppCacheUsage, clearAppCache } from '../../src/services/cacheCommands';
import { openImageSession, generateEditorThumbnail, generateImagePreview, prefetchImagePreview, saveImageAsJpg, commitCropToWorkingImage } from '../../src/services/editorCommands';
import { inspectConversionFile, inspectConversionDirectory, convertImageFile, renderDocumentToImages } from '../../src/services/conversionCommands';
import { inspectExtractionDocument, inspectExtractionDirectory, extractDocumentImages } from '../../src/services/extractionCommands';
import { inspectDownloadSource, saveDownloadImages } from '../../src/services/imageDownloadCommands';
import { inspectSplittingFile, inspectSplittingDirectory, splitImageFile } from '../../src/services/splittingCommands';
import { inspectStitchingFile, inspectStitchingDirectory, stitchImageFiles } from '../../src/services/stitchingCommands';

describe('service layer invoke contracts', () => {
  it('cacheCommands calls correct command names', async () => {
    mockInvoke.mockResolvedValue({ totalBytes: 0 });
    await getAppCacheUsage();
    expect(mockInvoke).toHaveBeenCalledWith('get_app_cache_usage');

    await clearAppCache();
    expect(mockInvoke).toHaveBeenCalledWith('clear_app_cache');
  });

  it('editorCommands passes path and request objects correctly', async () => {
    mockInvoke.mockResolvedValue({});

    await openImageSession('/test/img.png');
    expect(mockInvoke).toHaveBeenCalledWith('open_image_session', { path: '/test/img.png' });

    await generateEditorThumbnail('/test/img.png');
    expect(mockInvoke).toHaveBeenCalledWith('generate_editor_thumbnail', { path: '/test/img.png' });

    const previewReq = { path: '/test/img.png', adjustments: {} as never };
    await generateImagePreview(previewReq);
    expect(mockInvoke).toHaveBeenCalledWith('generate_image_preview', { request: previewReq });

    const prefetchReq = { path: '/test/next.png', maxWidth: 760, maxHeight: 560 };
    await prefetchImagePreview(prefetchReq);
    expect(mockInvoke).toHaveBeenCalledWith('prefetch_image_preview', { request: prefetchReq });

    const saveReq = { sourcePath: '/a.png', targetPath: '/b.jpg', adjustments: {} as never };
    await saveImageAsJpg(saveReq);
    expect(mockInvoke).toHaveBeenCalledWith('save_image_as_jpg', { request: saveReq });

    const cropReq = { sourcePath: '/a.png', rotation: 0 as const, crop: { x: 0, y: 0, width: 100, height: 100 } };
    await commitCropToWorkingImage(cropReq);
    expect(mockInvoke).toHaveBeenCalledWith('commit_crop_to_working_image', { request: cropReq });
  });

  it('conversionCommands passes path and request correctly', async () => {
    mockInvoke.mockResolvedValue([]);

    await inspectConversionFile('F:/demo/a.jpg');
    expect(mockInvoke).toHaveBeenCalledWith('inspect_conversion_file', { path: 'F:/demo/a.jpg' });

    await inspectConversionDirectory('F:/demo');
    expect(mockInvoke).toHaveBeenCalledWith('inspect_conversion_directory', { path: 'F:/demo' });

    const convertReq = {
      sourcePath: 'F:/demo/a.jpg',
      outputPath: 'F:/out/a-001.png',
      outputFormat: 'png' as const,
      colorMode: 'rgb' as const,
      quality: 90,
      allowSourceOverwrite: false
    };
    await convertImageFile(convertReq);
    expect(mockInvoke).toHaveBeenCalledWith('convert_image_file', { request: convertReq });

    const renderReq = {
      sourcePath: 'F:/demo/b.pdf',
      outputDirectory: 'F:/out',
      outputFormat: 'jpg' as const,
      colorMode: 'rgb' as const,
      quality: 90,
      pageNumbers: [1, 2],
      renderDensity: 'standard' as const,
      namingPattern: 'source-name-index' as const
    };
    await renderDocumentToImages(renderReq);
    expect(mockInvoke).toHaveBeenCalledWith('render_document_to_images', { request: renderReq });
  });

  it('conversionCommands normalizes object-shaped Tauri rejections without [object Object]', async () => {
    mockInvoke.mockRejectedValueOnce({
      code: 'WORD_RENDERER_NOT_AVAILABLE',
      message: '未检测到 Word',
      diagnostic: 'CoCreateInstance 失败',
      stage: 'applicationStart',
      rendererKind: 'word'
    });

    const error = await renderDocumentToImages({
      sourcePath: 'F:/demo/report.docx',
      outputDirectory: 'F:/out',
      outputFormat: 'jpg',
      colorMode: 'rgb',
      quality: 90,
      pageNumbers: [],
      renderDensity: 'standard',
      namingPattern: 'source-name-index'
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    const normalized = error as Error & { code?: string; diagnostic?: string; rendererKind?: string };
    expect(normalized.message).toBe('未检测到 Word');
    expect(normalized.message).not.toContain('[object Object]');
    expect(normalized.code).toBe('WORD_RENDERER_NOT_AVAILABLE');
    expect(normalized.rendererKind).toBe('word');
    // diagnostic 由后端保证有界且不含源路径；前端仅透传。
    expect(normalized.diagnostic).toBe('CoCreateInstance 失败');
  });

  it('extractionCommands passes path and request correctly', async () => {
    mockInvoke.mockResolvedValue({});

    await inspectExtractionDocument('/doc.pdf');
    expect(mockInvoke).toHaveBeenCalledWith('inspect_extraction_document', { path: '/doc.pdf' });

    await inspectExtractionDirectory('/docs/');
    expect(mockInvoke).toHaveBeenCalledWith('inspect_extraction_directory', { path: '/docs/' });

    const req = { sourcePath: '/doc.pdf', outputDirectory: '/out', outputFormat: 'png' as const, colorMode: 'rgb' as const, quality: 90, namingPattern: 'source-name-index' as const };
    await extractDocumentImages(req);
    expect(mockInvoke).toHaveBeenCalledWith('extract_document_images', { request: req });
  });

  it('imageDownloadCommands passes request objects correctly', async () => {
    mockInvoke.mockResolvedValue({ images: [] });

    const inspectReq = { mode: 'webpage' as const, url: 'https://example.com' };
    await inspectDownloadSource(inspectReq);
    expect(mockInvoke).toHaveBeenCalledWith('inspect_download_source', { request: inspectReq });

    const saveReq = { mode: 'webpage' as const, pageUrl: 'https://example.com', outputDirectory: '/out', imageIds: ['1'] };
    await saveDownloadImages(saveReq);
    expect(mockInvoke).toHaveBeenCalledWith('save_download_images', { request: saveReq });
  });

  it('splittingCommands passes path and request correctly', async () => {
    mockInvoke.mockResolvedValue({ outputPaths: [], splitCount: 0, skippedCount: 0 });

    await inspectSplittingFile('/demo/a.pdf');
    expect(mockInvoke).toHaveBeenCalledWith('inspect_splitting_file', { path: '/demo/a.pdf' });

    await inspectSplittingDirectory('/demo');
    expect(mockInvoke).toHaveBeenCalledWith('inspect_splitting_directory', { path: '/demo' });

    const req = {
      sourcePath: '/demo/a.jpg',
      outputDirectory: '/out',
      outputFormat: 'jpg' as const,
      colorMode: 'rgb' as const,
      columns: 3,
      rows: 2,
      quality: 88,
      namingPattern: 'source-name-index' as const
    };
    await splitImageFile(req);
    expect(mockInvoke).toHaveBeenCalledWith('split_image_file', { request: req });
  });

  it('stitchingCommands passes path and request correctly', async () => {
    const fileResult = {
      kind: 'image' as const,
      sourcePath: '/demo/a.png',
      sourceName: 'a.png',
      imageMetadata: { width: 10, height: 10, extension: 'png' },
      thumbnail: null,
      errorMessage: null
    };
    const directoryResults = [
      {
        kind: 'image' as const,
        sourcePath: '/demo/b.png',
        sourceName: 'b.png',
        imageMetadata: { width: 20, height: 20, extension: 'png' },
        thumbnail: null,
        errorMessage: null
      }
    ];
    const stitchResult = { outputPath: '/out/a-stitch-001.jpg', stitchedCount: 2 };
    mockInvoke
      .mockResolvedValueOnce(fileResult)
      .mockResolvedValueOnce(directoryResults)
      .mockResolvedValueOnce(stitchResult);

    await inspectStitchingFile('/demo/a.png');
    expect(mockInvoke).toHaveBeenCalledWith('inspect_stitching_file', { path: '/demo/a.png' });

    await inspectStitchingDirectory('/demo');
    expect(mockInvoke).toHaveBeenCalledWith('inspect_stitching_directory', { path: '/demo' });

    const req = {
      cells: [
        { sourcePath: '/demo/a.png', row: 0, col: 0, rowSpan: 1, colSpan: 1, scale: 1, offsetX: 0, offsetY: 0 },
        { sourcePath: '/demo/b.png', row: 0, col: 1, rowSpan: 1, colSpan: 1, scale: 1, offsetX: 0, offsetY: 0 },
        { sourcePath: '', row: 1, col: 0, rowSpan: 1, colSpan: 2, scale: 1, offsetX: 0, offsetY: 0 }
      ],
      rows: 2,
      cols: 2,
      canvasRatio: '1:1' as const,
      resolution: 1080 as const,
      padding: 16,
      spacing: 8,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      quality: 90,
      colorMode: 'rgb' as const,
      outputDirectory: '/out',
      outputFormat: 'png' as const,
      namingPattern: 'source-name-date' as const
    };
    await stitchImageFiles(req);
    expect(mockInvoke).toHaveBeenCalledWith('stitch_image_files', { request: req });
  });
});
