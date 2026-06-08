import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConvertImagePage from '../../src/pages/ConvertImagePage';
import { getSettingsStore } from '../../src/hooks/useSettingsStore';
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

describe('ConvertImagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(openConversionSources).mockResolvedValue({ files: [], directories: [], cancelled: false });
    getSettingsStore().setState({ language: 'zh-CN' });
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
    expect(screen.getByDisplayValue('F:/demo/folder')).toBeInTheDocument();
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
    expect(screen.getByDisplayValue('F:/drop')).toBeInTheDocument();
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

  it('imports a file and defaults output directory to its folder', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg']);
    vi.mocked(inspectConversionFile).mockResolvedValue(inspectedJpgFile);
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');

    render(<ConvertImagePage />);

    const startButton = screen.getByRole('button', { name: '开始转换' });
    expect(startButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '添加文件' }));

    expect(await screen.findByText('a.jpg')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('F:/demo')).toBeInTheDocument();
    expect(startButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '选择路径' }));

    expect(await screen.findByDisplayValue('F:/out')).toBeInTheDocument();
    expect(startButton).toBeEnabled();
  });

  it('lets users choose an output directory from the parameter area', async () => {
    const user = userEvent.setup();
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');

    render(<ConvertImagePage />);

    const outputDirectoryInput = screen.getByLabelText('输出目录');
    const choosePathButton = screen.getByRole('button', { name: '选择路径' });

    expect(choosePathButton.className).not.toContain('w-full');
    expect(outputDirectoryInput.className).toContain('flex-1');

    await user.click(choosePathButton);

    expect(await screen.findByDisplayValue('F:/out')).toBeInTheDocument();
  });

  it('opens the selected output directory from the parameter area', async () => {
    const user = userEvent.setup();
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');
    vi.mocked(openDirectoryInSystem).mockResolvedValue(undefined);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.click(await screen.findByRole('button', { name: '打开输出目录' }));

    expect(openDirectoryInSystem).toHaveBeenCalledWith('F:/out');
  });

  it('renders the revised parameter area and status footer', async () => {
    const { container } = render(<ConvertImagePage />);

    expect(screen.queryByRole('heading', { name: '格式转换' })).not.toBeInTheDocument();
    expect(screen.queryByText('导入图片或文档，按统一输出策略执行批量转换任务')).not.toBeInTheDocument();
    expect(screen.queryByText('导入文件后可开始批量转换任务。')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '导入文件夹' })).not.toBeInTheDocument();
    expect(screen.queryByText('请先导入要转换的文件。')).not.toBeInTheDocument();
    const importButton = screen.getByRole('button', { name: '添加文件' });
    const clearButton = screen.getByRole('button', { name: '清空列表' });
    const startButton = screen.getByRole('button', { name: '开始转换' });
    expect(importButton).toBeInTheDocument();
    expect(importButton.className).not.toContain('shadow');
    expect(clearButton).toBeInTheDocument();
    expect(startButton.className).not.toContain('shadow');
    expect(startButton.className).toContain('h-10');
    expect(startButton.className).not.toContain('h-14');
    expect(startButton).toBeInTheDocument();
    expect(clearButton.querySelector('svg')).not.toBeNull();
    expect(startButton.className).toContain('w-full');
    const startIcon = startButton.querySelector('svg');
    expect(startIcon).not.toBeNull();
    expect(startIcon?.className.baseVal ?? '').toContain('lucide-play');
    expect(startIcon?.getAttribute('width')).toBe('24');
    expect(startIcon?.getAttribute('height')).toBe('24');
    expect(
      Array.from(container.querySelectorAll('div')).some((element) => element.className.includes('xl:grid-cols-[1fr_380px]'))
    ).toBe(true);
    expect(screen.getByText('文件列表')).toBeInTheDocument();
    expect(screen.getByText('转换设置')).toBeInTheDocument();
    expect(screen.getByText('全局进度')).toBeInTheDocument();
    expect(screen.getByLabelText('输出格式')).toBeInTheDocument();
    expect(screen.getByLabelText('输出色彩模式')).toBeInTheDocument();
    expect(screen.getByLabelText('输出目录')).toBeInTheDocument();
    expect(screen.getByLabelText('命名规则')).toBeInTheDocument();
    expect(screen.queryByLabelText('最大并发任务数')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('重名处理')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('渲染精度')).not.toBeInTheDocument();
    expect(screen.getByText('输出质量')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '输出质量' })).toBeInTheDocument();
    expect(screen.queryByLabelText('DPI')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '原文件名-序号' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '原文件名-日期-序号' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全选页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '页码范围' })).toBeInTheDocument();
    expect(screen.getByLabelText('页码范围输入')).toBeDisabled();
    expect(screen.getByRole('complementary', { name: '转换设置区' }).className).toContain('p-5');

    const qualitySlider = screen.getByRole('slider', { name: '输出质量' });
    expect(qualitySlider.style.background).toContain('linear-gradient');

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
    const batchProgressActionsScroll = screen.getByTestId('batch-progress-actions-scroll');

    expect(batchProgressActionsScroll.className).toContain('min-w-0');
    expect(batchProgressActionsScroll.className).toContain('overflow-x-auto');

    expect(openOutputButton).toBeDisabled();
    expect(retryFailedButton).toBeDisabled();
    expect(failedDetailsButton).toBeEnabled();
    expect(openOutputButton.className).toContain('border');
    expect(retryFailedButton.className).toContain('border');
    expect(failedDetailsButton.className).toContain('border');

    expect(openOutputButton).toBeInTheDocument();
    expect(retryFailedButton).toBeInTheDocument();
    expect(failedDetailsButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '查看失败明细' })).not.toBeInTheDocument();

    const footer = screen.getByRole('contentinfo', { name: '转换任务页状态栏' });
    expect(
      within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '当前任务: 格式转换')
    ).toBeInTheDocument();
    expect(
      within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '队列文件: 0')
    ).toBeInTheDocument();
    expect(
      within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '输出目录: --')
    ).toBeInTheDocument();
    expect(
      within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '已完成: 0')
    ).toBeInTheDocument();
    expect(
      within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '失败: 0')
    ).toBeInTheDocument();
    expect(
      within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '版本号: V1.0')
    ).toBeInTheDocument();
  });


  it('imports mixed files and renders unified list entries', async () => {
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
    expect(screen.getByRole('button', { name: '选择 a.jpg 文件类型 JPG a.jpg JPG / RGB 待处理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择 b.pdf 文件类型 PDF b.pdf JPG / RGB / 全部页 待处理' })).toBeInTheDocument();
    expect(screen.getByLabelText('文件类型 JPG')).toBeInTheDocument();
    expect(screen.getByLabelText('文件类型 PDF')).toBeInTheDocument();
  });

  it('applies global output settings to document summaries', async () => {
    const user = userEvent.setup();
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
    await user.selectOptions(screen.getByLabelText('输出格式'), 'png');
    await user.selectOptions(screen.getByLabelText('输出色彩模式'), 'gray-cmyk');

    expect(await screen.findByText('PNG / 灰度 CMYK / 全部页')).toBeInTheDocument();
  });

  it('uses a stem-based output name for image conversion', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg']);
    vi.mocked(inspectConversionFile).mockResolvedValue(inspectedJpgFile);
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');
    vi.mocked(convertImageFile).mockResolvedValue(['F:/out/a.png']);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.selectOptions(await screen.findByLabelText('输出格式'), 'png');
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledWith({
        sourcePath: 'F:/demo/a.jpg',
        outputPath: 'F:/out/a-001.png',
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
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');
    vi.mocked(convertImageFile).mockResolvedValue(['F:/out/a.jpg']);
    vi.mocked(renderDocumentToImages).mockResolvedValue(['F:/out/b_001.jpg', 'F:/out/b_002.jpg', 'F:/out/b_003.jpg']);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await screen.findByDisplayValue('F:/out');
    await user.click(await screen.findByRole('button', { name: '开始转换' }));

    const progressCard = screen.getByText('全局进度').closest('div[class*="bg-white"]');
    expect(within(progressCard as HTMLElement).getByText('100%')).toBeInTheDocument();
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
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await screen.findByDisplayValue('F:/out');
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
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');
    vi.mocked(convertImageFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseConversion = () => resolve(['F:/out/a.jpg']);
        })
    );

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await screen.findByDisplayValue('F:/out');

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
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');
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
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await screen.findByDisplayValue('F:/out');
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
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');
    vi.mocked(convertImageFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          inFlight += 1;
          peakConcurrency = Math.max(peakConcurrency, inFlight);
          waitForRelease.push(() => {
            inFlight -= 1;
            resolve(['F:/out/done.jpg']);
          });
        })
    );

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await screen.findByDisplayValue('F:/out');

    const maxConcurrencyInput = screen.queryByLabelText('最大并发任务数');
    expect(maxConcurrencyInput).not.toBeInTheDocument();
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
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');
    vi.mocked(convertImageFile)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirstConversion = () => resolve(['F:/out/a.png']);
          })
      )
      .mockResolvedValueOnce(['F:/out/b.png']);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.selectOptions(screen.getByLabelText('输出格式'), 'png');
    await user.selectOptions(screen.getByLabelText('输出色彩模式'), 'cmyk');
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await screen.findByDisplayValue('F:/out');
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(1);
    });

    act(() => {
      useConversionStore.getState().updateGlobalSettings({
        outputDirectory: 'F:/changed',
        outputFormat: 'webp',
        colorMode: 'gray-cmyk',
        quality: 42
      });
    });

    await act(async () => {
      releaseFirstConversion?.();
    });

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(2);
    });

    expect(convertImageFile).toHaveBeenNthCalledWith(2, {
      sourcePath: 'F:/demo/b.jpg',
      outputPath: 'F:/out/b-001.png',
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
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');
    vi.mocked(convertImageFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseFirstConversion = () => resolve(['F:/out/a.jpg']);
        })
    );
    vi.mocked(renderDocumentToImages).mockResolvedValue(['F:/out/b_001.jpg', 'F:/out/b_003.jpg']);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.click(screen.getByRole('button', { name: '页码范围' }));
    await user.type(screen.getByLabelText('页码范围输入'), '1,3');
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await screen.findByDisplayValue('F:/out');
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(1);
    });

    act(() => {
      useConversionStore.getState().updateGlobalSettings({
        outputDirectory: 'F:/changed',
        pageRangeMode: 'custom',
        pageRangeText: '2-5',
        outputFormat: 'png',
        colorMode: 'gray-cmyk'
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
      outputDirectory: 'F:/out',
      outputFormat: 'jpg',
      colorMode: 'rgb',
      pageNumbers: [1, 3],
      renderDensity: 'standard',
      namingPattern: 'source-name-index'
    });
  });

  it('disables conversion settings controls while a batch is running', async () => {
    const user = userEvent.setup();
    let releaseConversion: (() => void) | undefined;

    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg']);
    vi.mocked(inspectConversionFile).mockResolvedValue(inspectedJpgFile);
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');
    vi.mocked(convertImageFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseConversion = () => resolve(['F:/out/a.jpg']);
        })
    );

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.click(screen.getByRole('button', { name: '页码范围' }));
    await user.type(screen.getByLabelText('页码范围输入'), '1-2');
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await screen.findByDisplayValue('F:/out');
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(convertImageFile).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByLabelText('命名规则')).toBeDisabled();
    expect(screen.getByLabelText('输出格式')).toBeDisabled();
    expect(screen.getByLabelText('输出色彩模式')).toBeDisabled();
    expect(screen.getByRole('slider', { name: '输出质量' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '全选页' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '页码范围' })).toBeDisabled();
    expect(screen.getByLabelText('页码范围输入')).toBeDisabled();
    expect(screen.getByRole('button', { name: '选择路径' })).toBeDisabled();

    await act(async () => {
      releaseConversion?.();
    });

    await waitFor(() => {
      expect(screen.getByLabelText('命名规则')).toBeEnabled();
    });
  });
});

describe('ConvertImagePage design polish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingsStore().setState({ language: 'zh-CN' });
    useConversionStore.getState().reset();
  });

  it('defaults output quality to 100 and keeps page range inline like the design', () => {
    render(<ConvertImagePage />);

    const pageRangeRow = screen.getByTestId('page-range-row');
    const allPagesButton = screen.getByRole('button', { name: '全选页' });
    const customPagesButton = screen.getByRole('button', { name: '页码范围' });
    const pageRangeInput = screen.getByLabelText('页码范围输入');

    expect((screen.getByRole('slider', { name: '输出质量' }) as HTMLInputElement).value).toBe('100');
    expect(within(pageRangeRow).queryByText('页范围')).not.toBeInTheDocument();
    expect(pageRangeRow.className).toContain('grid-cols-[96px_96px_minmax(0,1fr)]');
    expect(allPagesButton.className).not.toContain('border-border-light');
    expect(allPagesButton.className).not.toContain('border-meitu');
    expect(customPagesButton.className).not.toContain('border-border-light');
    expect(customPagesButton.className).not.toContain('border-meitu');
    expect(pageRangeInput.className).toContain('min-w-0');
    expect(pageRangeInput.className).toContain('w-full');

    const batchProgressPanel = screen.getByTestId('batch-progress-panel');
    expect(batchProgressPanel.className).toContain('lg:w-[560px]');

    const batchProgressFooter = screen.getByTestId('batch-progress-footer');
    const batchProgressActionsScroll = screen.getByTestId('batch-progress-actions-scroll');
    expect(batchProgressActionsScroll.className).toContain('min-w-0');
    expect(batchProgressActionsScroll.className).toContain('overflow-x-auto');
    expect(within(batchProgressFooter).getByText('全局进度')).toBeInTheDocument();
    expect(within(batchProgressFooter).getByText('0%')).toBeInTheDocument();
    expect(within(batchProgressFooter).getByRole('button', { name: '打开输出目录' })).toBeDisabled();
    expect(within(batchProgressFooter).getByRole('button', { name: '错误详情' })).toBeEnabled();
    expect(within(batchProgressFooter).getByRole('button', { name: '重试失败项' })).toBeDisabled();
  });
});
