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
    getSettingsStore().setState({ language: 'zh-CN' });
  });

  it('renders stitching workspace layout', () => {
    render(<StitchImagePage />);

    expect(screen.getByText('拼接设置')).toBeInTheDocument();
    expect(screen.getByText('开始拼接')).toBeInTheDocument();
    expect(screen.getByText('图片拼接')).toBeInTheDocument();
  });

  it('imports files and folders and defaults output directory', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.png'],
      directories: ['/test/folder'],
      cancelled: false,
    });

    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path === '/test/a.jpg') {
        return createMockInspection({ sourcePath: '/test/a.jpg', sourceName: 'a.jpg' });
      }
      if (path === '/test/b.png') {
        return createMockInspection({ sourcePath: '/test/b.png', sourceName: 'b.png' });
      }
      throw new Error('unknown file');
    });

    vi.mocked(stitchingCommands.inspectStitchingDirectory).mockResolvedValue([
      createMockInspection({ sourcePath: '/test/folder/c.webp', sourceName: 'c.webp' }),
    ]);

    vi.mocked(fileDialog.chooseOutputDirectory).mockResolvedValue('/test/output');

    render(<StitchImagePage />);

    await user.click(screen.getByText('添加文件'));

    await waitFor(() => {
      expect(screen.getByText('a.jpg')).toBeInTheDocument();
      expect(screen.getByText('b.png')).toBeInTheDocument();
      expect(screen.getByText('c.webp')).toBeInTheDocument();
    });

    // Output directory is auto-inferred from first directory
    await waitFor(() => {
      const outputInput = screen.getByLabelText('输出目录') as HTMLInputElement;
      expect(outputInput.value).toBe('/test/folder');
    });
  });

  it('starts stitching with selected settings', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.jpg'],
      directories: [],
      cancelled: false,
    });

    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path === '/test/a.jpg') {
        return createMockInspection({ sourcePath: '/test/a.jpg', sourceName: 'a.jpg' });
      }
      if (path === '/test/b.jpg') {
        return createMockInspection({ sourcePath: '/test/b.jpg', sourceName: 'b.jpg' });
      }
      throw new Error('unknown');
    });

    vi.mocked(stitchingCommands.stitchImageFiles).mockResolvedValue({
      outputPath: '/test/a-stitch-001.jpg',
      stitchedCount: 2,
    });

    render(<StitchImagePage />);

    await user.click(screen.getByText('添加文件'));

    await waitFor(() => {
      expect(screen.getByText('a.jpg')).toBeInTheDocument();
    });

    const startButton = screen.getByText('开始拼接');
    await user.click(startButton);

    await waitFor(() => {
      expect(stitchingCommands.stitchImageFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          sourcePaths: ['/test/a.jpg', '/test/b.jpg'],
          outputDirectory: '/test',
          outputFormat: 'jpg',
          columns: 2,
          backgroundColor: '#FFFFFF',
          namingPattern: 'source-name-index',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText('成功').length).toBeGreaterThan(0);
    });
  });

  it('shows failed details and retries failed items', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg', '/test/b.jpg'],
      directories: [],
      cancelled: false,
    });

    vi.mocked(stitchingCommands.inspectStitchingFile).mockImplementation(async (path: string) => {
      if (path === '/test/a.jpg') {
        return createMockInspection({ sourcePath: '/test/a.jpg', sourceName: 'a.jpg' });
      }
      if (path === '/test/b.jpg') {
        return createMockInspection({ sourcePath: '/test/b.jpg', sourceName: 'b.jpg' });
      }
      throw new Error('unknown');
    });

    let callCount = 0;
    vi.mocked(stitchingCommands.stitchImageFiles).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('列数必须在 1-12 之间');
      }
      return {
        outputPath: '/test/a-stitch-001.jpg',
        stitchedCount: 2,
      };
    });

    render(<StitchImagePage />);

    await user.click(screen.getByText('添加文件'));

    await waitFor(() => {
      expect(screen.getByText('a.jpg')).toBeInTheDocument();
    });

    await user.click(screen.getByText('开始拼接'));

    await waitFor(() => expect(screen.getAllByText('失败').length).toBeGreaterThan(0));

    const failedDetailsButton = screen.getByText('查看失败详情');
    await user.click(failedDetailsButton);

    expect((await screen.findAllByText('列数必须在 1-12 之间')).length).toBeGreaterThan(0);

    const closeButton = screen.getByRole('button', { name: '关闭' });
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    const retryButton = screen.getByText('重试失败');
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getAllByText('成功').length).toBeGreaterThan(0);
    });
  });

  it('re-renders stitching copy when language changes', async () => {
    render(<StitchImagePage />);

    expect(screen.getByText('拼接设置')).toBeInTheDocument();
    expect(screen.getByText('开始拼接')).toBeInTheDocument();

    act(() => {
      getSettingsStore().setState({ language: 'en-US' });
    });

    await waitFor(() => {
      expect(screen.getByText('Stitching settings')).toBeInTheDocument();
      expect(screen.getByText('Start stitching')).toBeInTheDocument();
    });
  });

  it('opens the selected output directory', async () => {
    vi.mocked(fileDialog.openStitchingSources).mockResolvedValue({
      files: ['/test/a.jpg'],
      directories: [],
      cancelled: false,
    });

    vi.mocked(stitchingCommands.inspectStitchingFile).mockResolvedValue(
      createMockInspection({ sourcePath: '/test/a.jpg', sourceName: 'a.jpg' })
    );

    const mockOpen = vi.fn().mockResolvedValue(undefined);
    vi.mocked(fileDialog.openDirectoryInSystem).mockImplementation(mockOpen);

    render(<StitchImagePage />);

    await user.click(screen.getByText('添加文件'));

    await waitFor(() => {
      expect(screen.getByText('a.jpg')).toBeInTheDocument();
    });

    const outputText = screen.getByText('/test');
    await user.click(outputText);

    expect(mockOpen).toHaveBeenCalledWith('/test');
  });
});
