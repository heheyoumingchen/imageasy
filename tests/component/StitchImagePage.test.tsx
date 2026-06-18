import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import StitchImagePage from '../../src/pages/StitchImagePage';
import * as fileDialog from '../../src/services/fileDialog';
import * as stitchingCommands from '../../src/services/stitchingCommands';
import type { InspectStitchingFileResult } from '../../src/types/stitching';
import { getSettingsStore } from '../../src/hooks/useSettingsStore';

vi.mock('../../src/services/fileDialog');
vi.mock('../../src/services/stitchingCommands');
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: vi.fn(() => ({
    onDragDropEvent: vi.fn(() => Promise.resolve(() => {})),
  })),
}));

const { convertFileSrc } = await import('@tauri-apps/api/core');

const createMockInspection = (
  overrides: Partial<InspectStitchingFileResult> = {}
): InspectStitchingFileResult => ({
  kind: 'image',
  sourcePath: '/test/image.jpg',
  sourceName: 'image.jpg',
  imageMetadata: {
    width: 800,
    height: 600,
    extension: 'jpg',
  },
  thumbnail: 'thumbnail' in overrides ? overrides.thumbnail ?? null : `data:image/jpeg;base64,${overrides.sourcePath ?? '/test/image.jpg'}`,
  errorMessage: null,
  ...overrides,
});

describe('StitchImagePage', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    getSettingsStore().setState({
      language: 'zh-CN',
      outputDirectoryStrategy: 'same-as-source',
      defaultOutputDirectory: '',
      exportSettings: { namingPattern: 'source-name-index', outputFormat: 'jpg', colorMode: 'rgb', quality: 100 },
    });
  });

  it('renders stitching workspace layout', () => {
    render(<StitchImagePage />);
    expect(screen.getByText('布局模板')).toBeInTheDocument();
    expect(screen.getByText('拼接设置')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加图片' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清空' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下载' })).toBeDisabled();
  });

  it('imports images and fills layout cells', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.png'], directories: ['/test/folder'], cancelled: false,
    });
    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path.endsWith('a.jpg')) return createMockInspection({ sourcePath: path, sourceName: 'a.jpg' });
      if (path.endsWith('b.png')) return createMockInspection({ sourcePath: path, sourceName: 'b.png' });
      console.error('StitchImagePage test: inspectStitchingFile called with unexpected path:', path);
      throw new Error('unknown file');
    });
    vi.mocked(stitchingCommands.inspectStitchingDirectory).mockResolvedValue([
      createMockInspection({ sourcePath: '/test/folder/c.webp', sourceName: 'c.webp' }),
    ]);
    render(<StitchImagePage />);
    await user.click(screen.getByRole('button', { name: '添加图片' }));
    expect(await screen.findByAltText('a.jpg')).toHaveAttribute('src', 'asset:///test/a.jpg');
    expect(screen.getByAltText('b.png')).toHaveAttribute('src', 'asset:///test/b.png');
    expect(screen.getByAltText('c.webp')).toHaveAttribute('src', 'asset:///test/folder/c.webp');
  });

  it('uses Tauri asset URLs for local previews', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(stitchingCommands.inspectStitchingFile).mockResolvedValue(
      createMockInspection({ sourcePath: '/test/a.jpg', sourceName: 'a.jpg', thumbnail: 'data:image/jpeg;base64,thumb-a' })
    );

    render(<StitchImagePage />);
    await user.click(screen.getByRole('button', { name: '添加图片' }));

    expect(await screen.findByAltText('a.jpg')).toHaveAttribute('src', 'asset:///test/a.jpg');
    expect(convertFileSrc).toHaveBeenCalledWith('/test/a.jpg');
  });

  it('previews imported stitching images with cover fit inside each cell', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/tall.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(stitchingCommands.inspectStitchingFile).mockResolvedValue(
      createMockInspection({
        sourcePath: '/test/tall.jpg',
        sourceName: 'tall.jpg',
        imageMetadata: { width: 400, height: 1200, extension: 'jpg' },
        thumbnail: 'data:image/jpeg;base64,tall-thumb',
      })
    );

    render(<StitchImagePage />);
    await user.click(screen.getByRole('button', { name: '添加图片' }));

    const preview = await screen.findByAltText('tall.jpg');
    expect(preview).toHaveClass('object-cover');
    expect(preview).not.toHaveClass('object-contain');
  });

  it('shows the complete image while editing a stitching cell', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/tall.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(stitchingCommands.inspectStitchingFile).mockResolvedValue(
      createMockInspection({
        sourcePath: '/test/tall.jpg',
        sourceName: 'tall.jpg',
        imageMetadata: { width: 400, height: 1200, extension: 'jpg' },
        thumbnail: 'data:image/jpeg;base64,tall-thumb',
      })
    );

    render(<StitchImagePage />);
    await user.click(screen.getByRole('button', { name: '添加图片' }));

    const preview = await screen.findByAltText('tall.jpg');
    expect(preview).toHaveClass('object-cover');

    await user.click(screen.getByRole('button', { name: '编辑' }));

    expect(preview).toHaveClass('object-contain');
    expect(preview).not.toHaveClass('object-cover');
  });

  it('fills layout cells after selected file inspections finish', async () => {
    let resolveA!: (value: InspectStitchingFileResult) => void;
    let resolveB!: (value: InspectStitchingFileResult) => void;
    const inspectionA = new Promise<InspectStitchingFileResult>((resolve) => { resolveA = resolve; });
    const inspectionB = new Promise<InspectStitchingFileResult>((resolve) => { resolveB = resolve; });

    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation((path: string) => {
      if (path.endsWith('a.jpg')) return inspectionA;
      if (path.endsWith('b.jpg')) return inspectionB;
      throw new Error('unknown');
    });

    render(<StitchImagePage />);
    await user.click(screen.getByRole('button', { name: '添加图片' }));

    resolveA(createMockInspection({ sourcePath: '/test/a.jpg', sourceName: 'a.jpg', thumbnail: 'data:image/jpeg;base64,thumb-a' }));
    expect(screen.queryByAltText('a.jpg')).not.toBeInTheDocument();

    resolveB(createMockInspection({ sourcePath: '/test/b.jpg', sourceName: 'b.jpg', thumbnail: 'data:image/jpeg;base64,thumb-b' }));
    expect(await screen.findByAltText('a.jpg')).toHaveAttribute('src', 'asset:///test/a.jpg');
    expect(await screen.findByAltText('b.jpg')).toHaveAttribute('src', 'asset:///test/b.jpg');
    expect(convertFileSrc).toHaveBeenCalledWith('/test/a.jpg');
    expect(convertFileSrc).toHaveBeenCalledWith('/test/b.jpg');
  });

  it('infers same-as-source output directory from the first image when stitching', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path.endsWith('a.jpg')) return createMockInspection({ sourcePath: path, sourceName: 'a.jpg' });
      if (path.endsWith('b.jpg')) return createMockInspection({ sourcePath: path, sourceName: 'b.jpg' });
      throw new Error('unknown');
    });
    vi.mocked(stitchingCommands.stitchImageFiles).mockResolvedValue({
      outputPath: '/test/a-stitch-001.jpg', stitchedCount: 2,
    });
    render(<StitchImagePage />);
    await user.click(screen.getByRole('button', { name: '添加图片' }));
    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '下载' }));
    await waitFor(() => {
      expect(stitchingCommands.stitchImageFiles).toHaveBeenCalledWith(expect.objectContaining({
        outputDirectory: '/test',
      }));
    });
    expect(fileDialog.chooseOutputDirectory).not.toHaveBeenCalled();
  });

  it('starts stitching with custom output directory and global export settings', async () => {
    getSettingsStore().setState({
      outputDirectoryStrategy: 'custom',
      defaultOutputDirectory: '/test/output',
      exportSettings: { namingPattern: 'source-name-date', outputFormat: 'png', colorMode: 'rgb', quality: 80 },
    });
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(fileDialog.chooseOutputDirectory).mockResolvedValue('/test/output');
    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path.endsWith('a.jpg')) return createMockInspection({ sourcePath: path, sourceName: 'a.jpg' });
      if (path.endsWith('b.jpg')) return createMockInspection({ sourcePath: path, sourceName: 'b.jpg' });
      throw new Error('unknown');
    });
    vi.mocked(stitchingCommands.stitchImageFiles).mockResolvedValue({
      outputPath: '/test/output/a-stitch-001.jpg', stitchedCount: 2,
    });
    render(<StitchImagePage />);
    await user.click(screen.getByRole('button', { name: '添加图片' }));
    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '下载' }));
    await waitFor(() => {
      expect(stitchingCommands.stitchImageFiles).toHaveBeenCalledWith(expect.objectContaining({
        rows: 2, cols: 2, canvasRatio: '1:1', resolution: 1080, padding: 0, spacing: 0,
        borderRadius: 0, backgroundColor: '#FFFFFF', quality: 80, colorMode: 'rgb', outputDirectory: '/test/output',
        outputFormat: 'png', namingPattern: 'source-name-date',
        cells: [
          { sourcePath: '/test/a.jpg', row: 0, col: 0, rowSpan: 1, colSpan: 1, scale: 1, offsetX: 0, offsetY: 0 },
          { sourcePath: '/test/b.jpg', row: 0, col: 1, rowSpan: 1, colSpan: 1, scale: 1, offsetX: 0, offsetY: 0 },
          { sourcePath: '', row: 1, col: 0, rowSpan: 1, colSpan: 1, scale: 1, offsetX: 0, offsetY: 0 },
          { sourcePath: '', row: 1, col: 1, rowSpan: 1, colSpan: 1, scale: 1, offsetX: 0, offsetY: 0 },
        ],
      }));
    });
    expect(fileDialog.chooseOutputDirectory).not.toHaveBeenCalled();
    expect(await screen.findByText('已导出：/test/output/a-stitch-001.jpg')).toBeInTheDocument();
  });

  it('swaps images between layout cells by dragging one cell onto another', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path.endsWith('a.jpg')) return createMockInspection({ sourcePath: path, sourceName: 'a.jpg' });
      if (path.endsWith('b.jpg')) return createMockInspection({ sourcePath: path, sourceName: 'b.jpg' });
      throw new Error('unknown');
    });
    vi.mocked(stitchingCommands.stitchImageFiles).mockResolvedValue({
      outputPath: '/test/a-stitch-001.jpg', stitchedCount: 2,
    });

    render(<StitchImagePage />);
    await user.click(screen.getByRole('button', { name: '添加图片' }));
    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument();

    const firstCell = screen.getByTestId('stitching-cell-0');
    const secondCell = screen.getByTestId('stitching-cell-1');
    fireEvent.pointerDown(firstCell, { pointerId: 1 });
    fireEvent.pointerUp(secondCell, { pointerId: 1 });

    await user.click(screen.getByRole('button', { name: '下载' }));
    await waitFor(() => {
      expect(stitchingCommands.stitchImageFiles).toHaveBeenCalledWith(expect.objectContaining({
        cells: expect.arrayContaining([
          expect.objectContaining({ sourcePath: '/test/b.jpg', row: 0, col: 0 }),
          expect.objectContaining({ sourcePath: '/test/a.jpg', row: 0, col: 1 }),
        ]),
      }));
    });
  });

  it('allows editing image scale up to 6x and exports that scale', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path.endsWith('a.jpg')) return createMockInspection({ sourcePath: path, sourceName: 'a.jpg' });
      if (path.endsWith('b.jpg')) return createMockInspection({ sourcePath: path, sourceName: 'b.jpg' });
      throw new Error('unknown');
    });
    vi.mocked(stitchingCommands.stitchImageFiles).mockResolvedValue({
      outputPath: '/test/a-stitch-001.jpg', stitchedCount: 2,
    });

    render(<StitchImagePage />);
    await user.click(screen.getByRole('button', { name: '添加图片' }));
    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: '编辑' })[0]);

    const zoomIn = screen.getByRole('button', { name: '放大' });
    for (let i = 0; i < 25; i += 1) {
      await user.click(zoomIn);
    }

    expect(zoomIn).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '下载' }));
    await waitFor(() => {
      expect(stitchingCommands.stitchImageFiles).toHaveBeenCalledWith(expect.objectContaining({
        cells: expect.arrayContaining([
          expect.objectContaining({ sourcePath: '/test/a.jpg', scale: 6 }),
        ]),
      }));
    });
  });

  it('shows an error when stitching fails', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path.endsWith('a.jpg')) return createMockInspection({ sourcePath: path, sourceName: 'a.jpg' });
      if (path.endsWith('b.jpg')) return createMockInspection({ sourcePath: path, sourceName: 'b.jpg' });
      throw new Error('unknown');
    });
    vi.mocked(stitchingCommands.stitchImageFiles).mockRejectedValue(new Error('输出尺寸过大'));
    render(<StitchImagePage />);
    await user.click(screen.getByRole('button', { name: '添加图片' }));
    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '下载' }));
    expect(await screen.findByText('输出尺寸过大')).toBeInTheDocument();
  });

  it('re-renders stitching copy when language changes', async () => {
    render(<StitchImagePage />);
    expect(screen.getByRole('button', { name: '添加图片' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载' })).toBeInTheDocument();
    act(() => { getSettingsStore().setState({ language: 'en-US' }); });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add images' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    });
  });
});
