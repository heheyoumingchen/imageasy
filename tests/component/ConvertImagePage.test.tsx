import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConvertImagePage from '../../src/pages/ConvertImagePage';
import { getSettingsStore } from '../../src/hooks/useSettingsStore';
import { DEFAULT_SETTINGS } from '../../src/stores/settingsStore';
import { useConversionStore } from '../../src/stores/conversionStore';

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: vi.fn(() => ({
    onDragDropEvent: vi.fn(async () => vi.fn())
  }))
}));

const { getCurrentWebview } = await import('@tauri-apps/api/webview');

vi.mock('../../src/services/fileDialog', () => ({
  openConversionSources: vi.fn(),
  openConversionFiles: vi.fn(),
  chooseOutputDirectory: vi.fn(),
  openDirectoryInSystem: vi.fn()
}));

vi.mock('../../src/services/conversionCommands', () => ({
  inspectConversionFile: vi.fn(),
  inspectConversionDirectory: vi.fn(),
  convertImageFile: vi.fn(),
  renderDocumentToImages: vi.fn()
}));

const { openConversionSources, openConversionFiles, chooseOutputDirectory, openDirectoryInSystem } = await import('../../src/services/fileDialog');
const { inspectConversionFile, inspectConversionDirectory, convertImageFile, renderDocumentToImages } = await import('../../src/services/conversionCommands');

const inspectedJpgFile = {
  kind: 'image' as const,
  sourcePath: 'F:/demo/a.jpg',
  sourceName: 'a.jpg',
  imageMetadata: { width: 800, height: 600, extension: 'jpg' },
  documentMetadata: null,
  errorMessage: null
};

// 公共任务设置（命名规则/导出格式/色彩模式/输出质量）现在统一来自 settings store。
const setConversionSettings = (partial: Partial<typeof DEFAULT_SETTINGS.conversion>) => {
  getSettingsStore().setState({ conversion: { ...DEFAULT_SETTINGS.conversion, ...partial } });
};

describe('ConvertImagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(openConversionSources).mockResolvedValue({ files: [], directories: [], cancelled: false });
    getSettingsStore().setState({
      language: 'zh-CN',
      outputDirectoryStrategy: 'same-as-source',
      maxConcurrency: 2,
      conversion: { ...DEFAULT_SETTINGS.conversion }
    });
    useConversionStore.getState().reset();
  });

  it('renders the conversion workbench without crashing', () => {
    render(<ConvertImagePage />);

    expect(screen.getByText('文件列表')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加文件' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始转换' })).toBeDisabled();
  });

  it('re-renders page copy when the settings language changes after render', async () => {
    render(<ConvertImagePage />);

    expect(screen.getByRole('button', { name: '开始转换' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start conversion' })).not.toBeInTheDocument();

    act(() => {
      getSettingsStore().setState({ language: 'en-US' });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start conversion' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '开始转换' })).not.toBeInTheDocument();
  });

  it('imports files and folders from the single add-file button', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionSources).mockResolvedValue({ files: ['F:/demo/a.jpg'], directories: ['F:/demo/folder'], cancelled: false });
    vi.mocked(inspectConversionFile).mockResolvedValue(inspectedJpgFile);
    vi.mocked(inspectConversionDirectory).mockResolvedValue([
      {
        kind: 'document',
        sourcePath: 'F:/demo/folder/b.pdf',
        sourceName: 'b.pdf',
        imageMetadata: null,
        documentMetadata: { pageCount: 1, extension: 'pdf' },
        errorMessage: null
      }
    ]);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));

    expect(openConversionSources).toHaveBeenCalledTimes(1);
    expect(inspectConversionFile).toHaveBeenCalledWith('F:/demo/a.jpg');
    expect(inspectConversionDirectory).toHaveBeenCalledWith('F:/demo/folder');
    expect(await screen.findByText('a.jpg')).toBeInTheDocument();
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(2);
    // 输出目录不再有面板输入框，改为在底部状态栏展示从源推断的目录。
    expect(screen.getByText('F:/demo/folder')).toBeInTheDocument();
  });

  it('imports dropped folders through the empty conversion area', async () => {
    const dragDropHandler = vi.fn();
    vi.mocked(getCurrentWebview).mockReturnValue({
      onDragDropEvent: vi.fn(async (handler) => {
        dragDropHandler.mockImplementation(handler);
        return vi.fn();
      })
    } as never);
    vi.mocked(inspectConversionDirectory).mockResolvedValue([
      {
        kind: 'image',
        sourcePath: 'F:/drop/a.jpg',
        sourceName: 'a.jpg',
        imageMetadata: { width: 800, height: 600, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      }
    ]);

    render(<ConvertImagePage />);
    await waitFor(() => expect(dragDropHandler).toHaveBeenCalledTimes(0));
    dragDropHandler({ payload: { type: 'drop', paths: ['F:/drop'] } });

    expect(await screen.findByText('a.jpg')).toBeInTheDocument();
    expect(screen.getByText('F:/drop')).toBeInTheDocument();
  });

  it('skips unsupported conversion files during add-file import', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionSources).mockResolvedValue({ files: ['F:/demo/a.txt'], directories: [], cancelled: false });
    vi.mocked(inspectConversionFile).mockResolvedValue({
      kind: 'unsupported',
      sourcePath: 'F:/demo/a.txt',
      sourceName: 'a.txt',
      imageMetadata: null,
      documentMetadata: null,
      errorMessage: '不支持的文件类型'
    });

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));

    expect(screen.queryByText('a.txt')).not.toBeInTheDocument();
    expect(screen.getByText('暂无待处理文件')).toBeInTheDocument();
  });

  it('imports a file and defaults output directory to its folder under same-as-source', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg']);
    vi.mocked(inspectConversionFile).mockResolvedValue(inspectedJpgFile);

    render(<ConvertImagePage />);

    const startButton = screen.getByRole('button', { name: '开始转换' });
    expect(startButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '添加文件' }));

    expect(await screen.findByText('a.jpg')).toBeInTheDocument();
    expect(await screen.findByText('F:/demo')).toBeInTheDocument();
    expect(startButton).toBeEnabled();
  });

  it('prompts for an output directory at start under the custom strategy when empty', async () => {
    const user = userEvent.setup();
    getSettingsStore().setState({ outputDirectoryStrategy: 'custom' });
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/picked');
    vi.mocked(convertImageFile).mockResolvedValue(['F:/picked/a-001.jpg']);

    render(<ConvertImagePage />);

    act(() => {
      useConversionStore.getState().setItems([
        {
          id: 'a',
          sourcePath: 'F:/demo/a.jpg',
          sourceName: 'a.jpg',
          sourceStem: 'a',
          kind: 'image',
          status: 'ready',
          errorMessage: null,
          outputSettingsOverride: {},
          imageMetadata: { width: 800, height: 600, extension: 'jpg' },
          documentMetadata: null,
          selected: true,
          outputPaths: []
        }
      ]);
    });

    // custom 策略下即便输出目录为空，开始按钮也可用（开始时再弹框）。
    const startButton = screen.getByRole('button', { name: '开始转换' });
    expect(startButton).toBeEnabled();

    await user.click(startButton);

    await waitFor(() => {
      expect(chooseOutputDirectory).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledWith(
        expect.objectContaining({ outputPath: 'F:/picked/a-001.jpg' })
      );
    });
  });

  it('opens the output directory inferred from the imported source', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg']);
    vi.mocked(inspectConversionFile).mockResolvedValue(inspectedJpgFile);
    vi.mocked(openDirectoryInSystem).mockResolvedValue(undefined);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(await screen.findByRole('button', { name: '打开输出目录' }));

    expect(openDirectoryInSystem).toHaveBeenCalledWith('F:/demo');
  });

  it('renders only the page-range control in the settings panel and the status footer', async () => {
    const { container } = render(<ConvertImagePage />);

    expect(screen.queryByRole('heading', { name: '格式转换' })).not.toBeInTheDocument();
    const importButton = screen.getByRole('button', { name: '添加文件' });
    const clearButton = screen.getByRole('button', { name: '清空列表' });
    const startButton = screen.getByRole('button', { name: '开始转换' });
    expect(importButton).toBeInTheDocument();
    expect(clearButton).toBeInTheDocument();
    expect(startButton.className).toContain('h-10');
    expect(startButton.className).toContain('w-full');
    const startIcon = startButton.querySelector('svg');
    expect(startIcon).not.toBeNull();
    expect(startIcon?.className.baseVal ?? '').toContain('lucide-play');
    expect(
      Array.from(container.querySelectorAll('div')).some((element) => element.className.includes('xl:grid-cols-[1fr_380px]'))
    ).toBe(true);
    expect(screen.getByText('文件列表')).toBeInTheDocument();
    expect(screen.getByText('转换设置')).toBeInTheDocument();
    expect(screen.getByText('全局进度')).toBeInTheDocument();

    // 已迁移到设置页的公共参数不再出现在转换设置面板中。
    expect(screen.queryByLabelText('输出格式')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('输出色彩模式')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('输出目录')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('命名规则')).not.toBeInTheDocument();
    expect(screen.queryByText('输出质量')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: '输出质量' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '选择路径' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('DPI')).not.toBeInTheDocument();

    // 页范围仍是转换专属参数，保留在面板中。
    expect(screen.getByRole('button', { name: '全选页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '页码范围' })).toBeInTheDocument();
    expect(screen.getByLabelText('页码范围输入')).toBeDisabled();
    expect(screen.getByRole('complementary', { name: '转换设置区' }).className).toContain('p-5');

    const pageRangeRow = screen.getByTestId('page-range-row');
    const pageRangeInput = screen.getByLabelText('页码范围输入');
    expect(pageRangeRow.className).toContain('grid-cols-[96px_96px_minmax(0,1fr)]');
    expect(pageRangeInput.className).toContain('min-w-0');
    expect(pageRangeInput.className).toContain('w-full');

    const batchProgressPanel = screen.getByTestId('batch-progress-panel');
    expect(batchProgressPanel.className).toContain('lg:w-[560px]');

    const batchProgressFooter = screen.getByTestId('batch-progress-footer');
    const openOutputButton = within(batchProgressFooter).getByRole('button', { name: '打开输出目录' });
    const retryFailedButton = within(batchProgressFooter).getByRole('button', { name: '重试失败项' });
    const failedDetailsButton = within(batchProgressFooter).getByRole('button', { name: '错误详情' });

    expect(openOutputButton).toBeDisabled();
    expect(retryFailedButton).toBeDisabled();
    expect(failedDetailsButton).toBeEnabled();

    const footer = screen.getByRole('contentinfo', { name: '转换任务页状态栏' });
    expect(
      within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '当前任务: 格式转换')
    ).toBeInTheDocument();
    expect(
      within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '输出目录: --')
    ).toBeInTheDocument();
  });

  it('imports mixed files and renders unified list entries from settings-store defaults', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg', 'F:/demo/b.pdf']);
    vi.mocked(inspectConversionFile)
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/a.jpg',
        sourceName: 'a.jpg',
        imageMetadata: { width: 800, height: 600, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        kind: 'document',
        sourcePath: 'F:/demo/b.pdf',
        sourceName: 'b.pdf',
        imageMetadata: null,
        documentMetadata: { pageCount: 12, extension: 'pdf' },
        errorMessage: null
      });

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));

    expect(await screen.findByText('a.jpg')).toBeInTheDocument();
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
    expect(screen.getByText('JPG / RGB')).toBeInTheDocument();
    expect(screen.getByText('JPG / RGB / 全部页')).toBeInTheDocument();
    expect(screen.getByLabelText('文件类型 JPG')).toBeInTheDocument();
    expect(screen.getByLabelText('文件类型 PDF')).toBeInTheDocument();
  });

  it('applies settings-store output settings to document summaries', async () => {
    const user = userEvent.setup();
    setConversionSettings({ outputFormat: 'png', colorMode: 'gray-cmyk' });
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/b.pdf']);
    vi.mocked(inspectConversionFile).mockResolvedValue({
      kind: 'document',
      sourcePath: 'F:/demo/b.pdf',
      sourceName: 'b.pdf',
      imageMetadata: null,
      documentMetadata: { pageCount: 12, extension: 'pdf' },
      errorMessage: null
    });

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));

    expect(await screen.findByText('PNG / 灰度 CMYK / 全部页')).toBeInTheDocument();
  });

  it('uses a stem-based output name and settings-store format for image conversion', async () => {
    const user = userEvent.setup();
    setConversionSettings({ outputFormat: 'png' });
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg']);
    vi.mocked(inspectConversionFile).mockResolvedValue(inspectedJpgFile);
    vi.mocked(convertImageFile).mockResolvedValue(['F:/demo/a-001.png']);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledWith({
        sourcePath: 'F:/demo/a.jpg',
        outputPath: 'F:/demo/a-001.png',
        outputFormat: 'png',
        colorMode: 'rgb',
        quality: 100
      });
    });
  });

  it('skips unchecked conversion items when starting', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg', 'F:/demo/b.jpg']);
    vi.mocked(inspectConversionFile)
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/a.jpg',
        sourceName: 'a.jpg',
        imageMetadata: { width: 800, height: 600, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/b.jpg',
        sourceName: 'b.jpg',
        imageMetadata: { width: 800, height: 600, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      });
    vi.mocked(convertImageFile).mockResolvedValue(['F:/demo/a.jpg']);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.click(await screen.findByRole('checkbox', { name: '选择 b.jpg' }));
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => expect(convertImageFile).toHaveBeenCalledTimes(1));
    expect(convertImageFile).toHaveBeenCalledWith(expect.objectContaining({ sourcePath: 'F:/demo/a.jpg' }));
  });

  it('starts mixed conversion and updates the batch status', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg', 'F:/demo/b.pdf']);
    vi.mocked(inspectConversionFile)
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/a.jpg',
        sourceName: 'a.jpg',
        imageMetadata: { width: 800, height: 600, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        kind: 'document',
        sourcePath: 'F:/demo/b.pdf',
        sourceName: 'b.pdf',
        imageMetadata: null,
        documentMetadata: { pageCount: 3, extension: 'pdf' },
        errorMessage: null
      });
    vi.mocked(convertImageFile).mockResolvedValue(['F:/demo/a.jpg']);
    vi.mocked(renderDocumentToImages).mockResolvedValue(['F:/demo/b_001.jpg', 'F:/demo/b_002.jpg', 'F:/demo/b_003.jpg']);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(await screen.findByRole('button', { name: '开始转换' }));

    const progressCard = screen.getByText('全局进度').closest('div[class*="bg-white"]');
    await waitFor(() => {
      expect(within(progressCard as HTMLElement).getByText('100%')).toBeInTheDocument();
    });
  });

  it('blocks document conversion when the custom page range is invalid', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/b.pdf']);
    vi.mocked(inspectConversionFile).mockResolvedValue({
      kind: 'document',
      sourcePath: 'F:/demo/b.pdf',
      sourceName: 'b.pdf',
      imageMetadata: null,
      documentMetadata: { pageCount: 3, extension: 'pdf' },
      errorMessage: null
    });

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('b.pdf');
    await user.click(screen.getByRole('button', { name: '页码范围' }));
    await user.type(screen.getByLabelText('页码范围输入'), '5');
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    expect(await screen.findByText('页码超出文档总页数')).toBeInTheDocument();
  });

  it('disables clearing the list while conversion is running', async () => {
    const user = userEvent.setup();
    let releaseConversion: (() => void) | undefined;

    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg']);
    vi.mocked(inspectConversionFile).mockResolvedValue(inspectedJpgFile);
    vi.mocked(convertImageFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseConversion = () => resolve(['F:/demo/a.jpg']);
        })
    );

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');

    const clearButton = screen.getByRole('button', { name: '清空列表' });
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(1);
    });
    expect(clearButton).toBeDisabled();

    await user.click(clearButton);
    expect(screen.getByText('a.jpg')).toBeInTheDocument();

    await act(async () => {
      releaseConversion?.();
    });

    await waitFor(() => {
      expect(clearButton).toBeEnabled();
    });
  });

  it('expands error details and shows empty state or failed item messages', async () => {
    const user = userEvent.setup();
    let rejectConversion: ((reason?: unknown) => void) | undefined;

    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg']);
    vi.mocked(inspectConversionFile).mockResolvedValue(inspectedJpgFile);
    vi.mocked(convertImageFile).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectConversion = reject;
        })
    );

    render(<ConvertImagePage />);

    await user.click(screen.getByRole('button', { name: '错误详情' }));
    expect(screen.getByText('当前没有失败项。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      rejectConversion?.(new Error('磁盘空间不足'));
    });

    const failedDetailsDialog = await screen.findByRole('dialog', { name: '错误详情' });
    expect(within(failedDetailsDialog).getByText('a.jpg')).toBeInTheDocument();
    expect(within(failedDetailsDialog).getByText('磁盘空间不足')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '错误详情' })).not.toBeInTheDocument();
  });

  it('runs ready items with the configured batch concurrency', async () => {
    const user = userEvent.setup();
    let inFlight = 0;
    let peakConcurrency = 0;
    const waitForRelease: Array<() => void> = [];

    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg', 'F:/demo/b.jpg', 'F:/demo/c.jpg']);
    vi.mocked(inspectConversionFile)
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/a.jpg',
        sourceName: 'a.jpg',
        imageMetadata: { width: 800, height: 600, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/b.jpg',
        sourceName: 'b.jpg',
        imageMetadata: { width: 640, height: 480, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/c.jpg',
        sourceName: 'c.jpg',
        imageMetadata: { width: 320, height: 240, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      });
    vi.mocked(convertImageFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          inFlight += 1;
          peakConcurrency = Math.max(peakConcurrency, inFlight);
          waitForRelease.push(() => {
            inFlight -= 1;
            resolve(['F:/demo/done.jpg']);
          });
        })
    );

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');

    getSettingsStore().setState({ maxConcurrency: 2 });
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(2);
    });
    expect(peakConcurrency).toBe(2);

    await act(async () => {
      waitForRelease.shift()?.();
    });
    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(3);
    });

    await act(async () => {
      waitForRelease.shift()?.();
    });
    await act(async () => {
      waitForRelease.shift()?.();
    });
  });

  it('keeps the batch output snapshot for later image items after settings change mid-run', async () => {
    const user = userEvent.setup();
    let releaseFirstConversion: (() => void) | undefined;

    getSettingsStore().setState({ maxConcurrency: 1 });
    setConversionSettings({ outputFormat: 'png', colorMode: 'cmyk' });
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg', 'F:/demo/b.jpg']);
    vi.mocked(inspectConversionFile)
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/a.jpg',
        sourceName: 'a.jpg',
        imageMetadata: { width: 800, height: 600, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/b.jpg',
        sourceName: 'b.jpg',
        imageMetadata: { width: 640, height: 480, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      });
    vi.mocked(convertImageFile)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirstConversion = () => resolve(['F:/demo/a.png']);
          })
      )
      .mockResolvedValueOnce(['F:/demo/b.png']);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(1);
    });

    // 批次开始后改动公共设置与输出目录，进行中的批次应沿用启动时的快照。
    act(() => {
      setConversionSettings({ outputFormat: 'webp', colorMode: 'gray-cmyk', quality: 42 });
      useConversionStore.getState().updateGlobalSettings({ outputDirectory: 'F:/changed' });
    });

    await act(async () => {
      releaseFirstConversion?.();
    });

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(2);
    });

    expect(convertImageFile).toHaveBeenNthCalledWith(2, {
      sourcePath: 'F:/demo/b.jpg',
      outputPath: 'F:/demo/b-001.png',
      outputFormat: 'png',
      colorMode: 'cmyk',
      quality: 100
    });
  });

  it('keeps the batch page-range snapshot for later document items after settings change mid-run', async () => {
    const user = userEvent.setup();
    let releaseFirstConversion: (() => void) | undefined;

    getSettingsStore().setState({ maxConcurrency: 1 });
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg', 'F:/demo/b.pdf']);
    vi.mocked(inspectConversionFile)
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/a.jpg',
        sourceName: 'a.jpg',
        imageMetadata: { width: 800, height: 600, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        kind: 'document',
        sourcePath: 'F:/demo/b.pdf',
        sourceName: 'b.pdf',
        imageMetadata: null,
        documentMetadata: { pageCount: 5, extension: 'pdf' },
        errorMessage: null
      });
    vi.mocked(convertImageFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseFirstConversion = () => resolve(['F:/demo/a.jpg']);
        })
    );
    vi.mocked(renderDocumentToImages).mockResolvedValue(['F:/demo/b_001.jpg', 'F:/demo/b_003.jpg']);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('b.pdf');
    await user.click(screen.getByRole('button', { name: '页码范围' }));
    await user.type(screen.getByLabelText('页码范围输入'), '1,3');
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(1);
    });

    act(() => {
      setConversionSettings({ outputFormat: 'png', colorMode: 'gray-cmyk' });
      useConversionStore.getState().updateGlobalSettings({
        outputDirectory: 'F:/changed',
        pageRangeMode: 'custom',
        pageRangeText: '2-5'
      });
    });

    await act(async () => {
      releaseFirstConversion?.();
    });

    await waitFor(() => {
      expect(renderDocumentToImages).toHaveBeenCalledTimes(1);
    });

    expect(renderDocumentToImages).toHaveBeenCalledWith({
      sourcePath: 'F:/demo/b.pdf',
      outputDirectory: 'F:/demo',
      outputFormat: 'jpg',
      colorMode: 'rgb',
      pageNumbers: [1, 3],
      renderDensity: 'standard',
      namingPattern: 'source-name-index'
    });
  });

  it('disables the page-range controls while a batch is running', async () => {
    const user = userEvent.setup();
    let releaseConversion: (() => void) | undefined;

    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg']);
    vi.mocked(inspectConversionFile).mockResolvedValue(inspectedJpgFile);
    vi.mocked(convertImageFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseConversion = () => resolve(['F:/demo/a.jpg']);
        })
    );

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(screen.getByRole('button', { name: '页码范围' }));
    await user.type(screen.getByLabelText('页码范围输入'), '1-2');
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('button', { name: '全选页' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '页码范围' })).toBeDisabled();
    expect(screen.getByLabelText('页码范围输入')).toBeDisabled();

    await act(async () => {
      releaseConversion?.();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '全选页' })).toBeEnabled();
    });
  });
});

describe('ConvertImagePage design polish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingsStore().setState({
      language: 'zh-CN',
      outputDirectoryStrategy: 'same-as-source',
      conversion: { ...DEFAULT_SETTINGS.conversion }
    });
    useConversionStore.getState().reset();
  });

  it('keeps the page range inline like the design and renders the batch progress panel', () => {
    render(<ConvertImagePage />);

    const pageRangeRow = screen.getByTestId('page-range-row');
    const allPagesButton = screen.getByRole('button', { name: '全选页' });
    const customPagesButton = screen.getByRole('button', { name: '页码范围' });
    const pageRangeInput = screen.getByLabelText('页码范围输入');

    expect(within(pageRangeRow).queryByText('页范围')).not.toBeInTheDocument();
    expect(pageRangeRow.className).toContain('grid-cols-[96px_96px_minmax(0,1fr)]');
    expect(allPagesButton.className).not.toContain('border-border-light');
    expect(customPagesButton.className).not.toContain('border-border-light');
    expect(pageRangeInput.className).toContain('min-w-0');
    expect(pageRangeInput.className).toContain('w-full');

    const batchProgressPanel = screen.getByTestId('batch-progress-panel');
    expect(batchProgressPanel.className).toContain('lg:w-[560px]');

    const batchProgressFooter = screen.getByTestId('batch-progress-footer');
    expect(within(batchProgressFooter).getByText('全局进度')).toBeInTheDocument();
    expect(within(batchProgressFooter).getByText('0%')).toBeInTheDocument();
    expect(within(batchProgressFooter).getByRole('button', { name: '打开输出目录' })).toBeDisabled();
    expect(within(batchProgressFooter).getByRole('button', { name: '错误详情' })).toBeEnabled();
    expect(within(batchProgressFooter).getByRole('button', { name: '重试失败项' })).toBeDisabled();
  });
});
