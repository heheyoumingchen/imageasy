import { render, screen, waitFor, act } from '@testing-library/react';
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
  convertFileSrc: (path: string) => `asset://${path}`,
}));
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: vi.fn(() => ({
    onDragDropEvent: vi.fn(() => Promise.resolve(() => {})),
  })),
}));

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
      stitching: { namingPattern: 'source-name-index', outputFormat: 'jpg', quality: 100 },
    });
  });

  it('renders stitching workspace layout', () => {
    render(<StitchImagePage />);
    expect(screen.getByText('布局拼接')).toBeInTheDocument();
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
      if (path === '/test/a.jpg') return createMockInspection({ sourcePath: '/test/a.jpg', sourceName: 'a.jpg' });
      if (path === '/test/b.png') return createMockInspection({ sourcePath: '/test/b.png', sourceName: 'b.png' });
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

  it('infers same-as-source output directory from the first image when stitching', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path === '/test/a.jpg') return createMockInspection({ sourcePath: '/test/a.jpg', sourceName: 'a.jpg' });
      if (path === '/test/b.jpg') return createMockInspection({ sourcePath: '/test/b.jpg', sourceName: 'b.jpg' });
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
      stitching: { namingPattern: 'source-name-date', outputFormat: 'png', quality: 80 },
    });
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(fileDialog.chooseOutputDirectory).mockResolvedValue('/test/output');
    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path === '/test/a.jpg') return createMockInspection({ sourcePath: '/test/a.jpg', sourceName: 'a.jpg' });
      if (path === '/test/b.jpg') return createMockInspection({ sourcePath: '/test/b.jpg', sourceName: 'b.jpg' });
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
        borderRadius: 0, backgroundColor: '#FFFFFF', quality: 80, outputDirectory: '/test/output',
        outputFormat: 'png', namingPattern: 'source-name-date',
        cells: [
          { sourcePath: '/test/a.jpg', row: 0, col: 0, rowSpan: 1, colSpan: 1 },
          { sourcePath: '/test/b.jpg', row: 0, col: 1, rowSpan: 1, colSpan: 1 },
          { sourcePath: '', row: 1, col: 0, rowSpan: 1, colSpan: 1 },
          { sourcePath: '', row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        ],
      }));
    });
    expect(fileDialog.chooseOutputDirectory).toHaveBeenCalled();
    expect(await screen.findByText('已导出：/test/output/a-stitch-001.jpg')).toBeInTheDocument();
  });

  it('shows an error when stitching fails', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.jpg'], directories: [], cancelled: false,
    });
    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path === '/test/a.jpg') return createMockInspection({ sourcePath: '/test/a.jpg', sourceName: 'a.jpg' });
      if (path === '/test/b.jpg') return createMockInspection({ sourcePath: '/test/b.jpg', sourceName: 'b.jpg' });
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
    expect(screen.getByText('布局拼接')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载' })).toBeInTheDocument();
    act(() => { getSettingsStore().setState({ language: 'en-US' }); });
    await waitFor(() => {
      expect(screen.getByText('Layout Stitching')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    });
  });
});
