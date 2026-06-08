import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExtractImagePage from '../../src/pages/ExtractImagePage';
import { getSettingsStore } from '../../src/hooks/useSettingsStore';

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: vi.fn(() => ({
    onDragDropEvent: vi.fn(async () => vi.fn())
  }))
}));

const { getCurrentWebview } = await import('@tauri-apps/api/webview');

vi.mock('../../src/services/fileDialog', () => ({
  openExtractionSources: vi.fn(),
  openExtractionDocuments: vi.fn(),
  chooseOutputDirectory: vi.fn(),
  openDirectoryInSystem: vi.fn()
}));

vi.mock('../../src/services/extractionCommands', () => ({
  inspectExtractionDocument: vi.fn(),
  inspectExtractionDirectory: vi.fn(),
  extractDocumentImages: vi.fn()
}));

const { openExtractionSources, openExtractionDocuments, chooseOutputDirectory, openDirectoryInSystem } = await import('../../src/services/fileDialog');
const { inspectExtractionDocument, inspectExtractionDirectory, extractDocumentImages } = await import('../../src/services/extractionCommands');

const pdfDocumentInfo = (path: string) => ({
  sourcePath: path,
  sourceName: path.split('/').pop() ?? path,
  extension: 'pdf',
  embeddedImageCount: 1,
  pageCount: 1
});

describe('ExtractImagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(openExtractionSources).mockResolvedValue({ files: [], directories: [], cancelled: false });
    getSettingsStore().setState({ language: 'zh-CN' });
    vi.mocked(inspectExtractionDocument).mockResolvedValue({
      sourcePath: 'F:/Demo/产品手册.docx',
      sourceName: '产品手册.docx',
      extension: 'docx',
      embeddedImageCount: 3,
      pageCount: 8
    });
    vi.mocked(extractDocumentImages).mockResolvedValue({
      outputPaths: ['F:/Demo/out/产品手册_001.png', 'F:/Demo/out/产品手册_002.png'],
      extractedCount: 2,
      skippedCount: 1
    });
  });

  it('renders the current extraction workspace layout', () => {
    render(<ExtractImagePage />);

    expect(screen.getByText('文件列表')).toBeInTheDocument();
    expect(screen.getByText('提取设置')).toBeInTheDocument();
    expect(screen.getByText('全局进度')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加文件' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清空列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始提取' })).toBeDisabled();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('总数')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '错误详情' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开输出目录' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '重试失败项' })).toBeDisabled();
  });

  it('renders revised extraction output settings', () => {
    const { container } = render(<ExtractImagePage />);

    const outputDirectoryInput = screen.getByLabelText('输出目录');
    const choosePathButton = screen.getByRole('button', { name: '选择路径' });
    const importButton = screen.getByRole('button', { name: '添加文件' });

    expect(
      Array.from(container.querySelectorAll('div')).some((element) => element.className.includes('xl:grid-cols-[1fr_380px]'))
    ).toBe(true);
    expect(importButton.className).not.toContain('shadow');
    expect(screen.getByLabelText('导出格式')).toBeInTheDocument();
    expect((screen.getByLabelText('导出格式') as HTMLSelectElement).value).toBe('jpg');
    expect(screen.getByLabelText('输出色彩模式')).toBeInTheDocument();
    expect(screen.getByLabelText('命名规则')).toBeInTheDocument();
    expect(outputDirectoryInput).toBeInTheDocument();
    expect(outputDirectoryInput.className).toContain('flex-1');
    expect(choosePathButton.className).toContain('shrink-0');
    const startButton = screen.getByRole('button', { name: '开始提取' });
    expect(startButton.className).not.toContain('shadow');
    expect(choosePathButton.className).toContain('h-10');
    expect(importButton.className).toContain('h-10');
    expect(startButton.className).toContain('h-10');
    expect(startButton.className).not.toContain('h-14');
    expect(screen.getByRole('button', { name: '打开输出目录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '错误详情' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试失败项' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '原文件名-序号' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '原文件名-日期-序号' })).toBeInTheDocument();

    const emptyState = screen.getByText('支持word、pdf、ppt文件，拖拽文件夹即可打开。').closest('div');
    expect(emptyState?.className).toContain('justify-center');
    expect(emptyState?.className).toContain('min-h-[320px]');

    const footer = screen.getByRole('contentinfo', { name: '提取任务页状态栏' });
    expect(
      within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '当前任务: 图片提取')
    ).toBeInTheDocument();
    expect(
      within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '队列文件: 0')
    ).toBeInTheDocument();
    expect(
      within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '输出目录: --')
    ).toBeInTheDocument();

    const batchProgressPanel = screen.getByTestId('batch-progress-panel');
    expect(batchProgressPanel.className).toContain('lg:w-[560px]');

    const batchProgressFooter = screen.getByTestId('batch-progress-footer');
    const failedDetailsButton = within(batchProgressFooter).getByRole('button', { name: '错误详情' });
    const batchProgressActionsScroll = screen.getByTestId('batch-progress-actions-scroll');
    expect(batchProgressActionsScroll.className).toContain('min-w-0');
    expect(batchProgressActionsScroll.className).toContain('overflow-x-auto');
    expect(within(batchProgressFooter).getByText('全局进度')).toBeInTheDocument();
    expect(within(batchProgressFooter).getByText('0%')).toBeInTheDocument();
    expect(within(batchProgressFooter).getByRole('button', { name: '打开输出目录' })).toBeDisabled();
    expect(failedDetailsButton).toBeEnabled();
    expect(failedDetailsButton).toHaveAttribute('aria-expanded', 'false');
    expect(failedDetailsButton).toHaveAttribute('aria-controls', 'extraction-failed-details');
    expect(screen.queryByRole('region', { name: '错误详情' })).not.toBeInTheDocument();
    expect(within(batchProgressFooter).getByRole('button', { name: '重试失败项' })).toBeDisabled();
  });

  it('uses 清空列表 as the secondary list action label', () => {
    render(<ExtractImagePage />);

    expect(screen.getByRole('button', { name: '清空列表' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument();
  });

  it('re-renders extraction copy when the settings language changes after render', async () => {
    render(<ExtractImagePage />);

    expect(screen.getByRole('button', { name: '开始提取' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start extraction' })).not.toBeInTheDocument();
    expect(screen.getByText('文件列表')).toBeInTheDocument();
    expect(screen.getByText('全局进度')).toBeInTheDocument();

    act(() => {
      getSettingsStore().setState({ language: 'en-US' });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start extraction' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '开始提取' })).not.toBeInTheDocument();
    expect(screen.getByText('File Name')).toBeInTheDocument();
    expect(screen.getByText('Overall progress')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Error details' })).toBeInTheDocument();
  });

  it('imports documents and folders from the single add-file button', async () => {
    const user = userEvent.setup();
    vi.mocked(openExtractionSources).mockResolvedValue({ files: ['F:/Demo/产品手册.docx'], directories: ['F:/Demo/docs'], cancelled: false });
    vi.mocked(inspectExtractionDirectory).mockResolvedValue([
      {
        sourcePath: 'F:/Demo/docs/价格表.pdf',
        sourceName: '价格表.pdf',
        extension: 'pdf',
        embeddedImageCount: 0,
        pageCount: 1
      }
    ]);

    render(<ExtractImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));

    expect(openExtractionSources).toHaveBeenCalledTimes(1);
    expect(inspectExtractionDocument).toHaveBeenCalledWith('F:/Demo/产品手册.docx');
    expect(inspectExtractionDirectory).toHaveBeenCalledWith('F:/Demo/docs');
    expect(await screen.findByText('产品手册.docx')).toBeInTheDocument();
    expect(screen.getByText('价格表.pdf')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(2);
    expect(screen.getByDisplayValue('F:/Demo/docs')).toBeInTheDocument();
  });

  it('imports dropped folders through the empty extraction area', async () => {
    const dragDropHandler = vi.fn();
    vi.mocked(getCurrentWebview).mockReturnValue({
      onDragDropEvent: vi.fn(async (handler) => {
        dragDropHandler.mockImplementation(handler);
        return vi.fn();
      })
    } as never);
    vi.mocked(inspectExtractionDirectory).mockResolvedValue([pdfDocumentInfo('F:/drop/a.pdf')]);

    render(<ExtractImagePage />);
    await waitFor(() => expect(dragDropHandler).toHaveBeenCalledTimes(0));
    dragDropHandler({ payload: { type: 'drop', paths: ['F:/drop'] } });

    expect(await screen.findByText('a.pdf')).toBeInTheDocument();
    expect(screen.getByDisplayValue('F:/drop')).toBeInTheDocument();
  });

  it('skips unsupported extraction files during add-file import', async () => {
    const user = userEvent.setup();
    vi.mocked(openExtractionSources).mockResolvedValue({ files: ['F:/Demo/notes.txt'], directories: [], cancelled: false });
    vi.mocked(inspectExtractionDocument).mockRejectedValue(new Error('不支持的文档类型: txt'));

    render(<ExtractImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));

    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
    expect(screen.getByText('支持word、pdf、ppt文件，拖拽文件夹即可打开。')).toBeInTheDocument();
  });

  it('filters non-document files before inspecting extraction sources', async () => {
    const user = userEvent.setup();
    vi.mocked(openExtractionSources).mockResolvedValue({
      files: ['F:/Demo/a.jpg', 'F:/Demo/report.pdf', 'F:/Demo/slides.pptx', 'F:/Demo/notes.txt'],
      directories: [],
      cancelled: false
    });

    render(<ExtractImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));

    expect(inspectExtractionDocument).toHaveBeenCalledTimes(2);
    expect(inspectExtractionDocument).toHaveBeenCalledWith('F:/Demo/report.pdf');
    expect(inspectExtractionDocument).toHaveBeenCalledWith('F:/Demo/slides.pptx');
    expect(inspectExtractionDocument).not.toHaveBeenCalledWith('F:/Demo/a.jpg');
    expect(inspectExtractionDocument).not.toHaveBeenCalledWith('F:/Demo/notes.txt');
  });

  it('imports documents and extracts images with selected output settings', async () => {
    const user = userEvent.setup();
    vi.mocked(openExtractionDocuments).mockResolvedValue(['F:/Demo/产品手册.docx']);
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/Demo/out');

    render(<ExtractImagePage />);

    await user.click(screen.getByRole('button', { name: '添加文件' }));

    const fileName = await screen.findByText('产品手册.docx');
    const fileRowSummary = fileName.closest('div')?.nextElementSibling;

    expect(fileName).toBeInTheDocument();
    expect(fileRowSummary).not.toBeNull();
    expect(
      within(fileRowSummary as HTMLElement).getByText(
        (_, element) => element?.tagName === 'SPAN' && (element.textContent?.includes('预计 3 张图片') ?? false)
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText('文件类型 DOCX')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.selectOptions(screen.getByLabelText('导出格式'), 'jpg');
    await user.selectOptions(screen.getByLabelText('输出色彩模式'), 'gray-cmyk');
    await user.selectOptions(screen.getByLabelText('命名规则'), 'source-name-date');
    await user.click(screen.getByRole('button', { name: '开始提取' }));

    await waitFor(() => {
      expect(extractDocumentImages).toHaveBeenCalledWith({
        sourcePath: 'F:/Demo/产品手册.docx',
        outputDirectory: 'F:/Demo/out',
        outputFormat: 'jpg',
        colorMode: 'gray-cmyk',
        namingPattern: 'source-name-date'
      });
    });

    expect((await screen.findAllByText('完成 2 张')).length).toBeGreaterThan(0);
  });

  it('opens the extraction output directory after users choose it', async () => {
    const user = userEvent.setup();
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/Demo/out');
    vi.mocked(openDirectoryInSystem).mockResolvedValue(undefined);

    render(<ExtractImagePage />);

    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.click(await screen.findByRole('button', { name: '打开输出目录' }));

    expect(openDirectoryInSystem).toHaveBeenCalledWith('F:/Demo/out');
  });

  it('skips unchecked extraction documents when starting', async () => {
    const user = userEvent.setup();
    vi.mocked(openExtractionDocuments).mockResolvedValue(['F:/Demo/a.pdf', 'F:/Demo/b.pdf']);
    vi.mocked(inspectExtractionDocument)
      .mockResolvedValueOnce(pdfDocumentInfo('F:/Demo/a.pdf'))
      .mockResolvedValueOnce(pdfDocumentInfo('F:/Demo/b.pdf'));
    vi.mocked(extractDocumentImages).mockResolvedValue({ outputPaths: ['F:/Demo/a-001.jpg'], extractedCount: 1, skippedCount: 0 });

    render(<ExtractImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.click(await screen.findByRole('checkbox', { name: '选择 b.pdf' }));
    await user.click(screen.getByRole('button', { name: '开始提取' }));

    await waitFor(() => expect(extractDocumentImages).toHaveBeenCalledTimes(1));
    expect(extractDocumentImages).toHaveBeenCalledWith(expect.objectContaining({ sourcePath: 'F:/Demo/a.pdf' }));
  });

  it('shows failed extraction details in an accessible region and retries failed documents', async () => {
    const user = userEvent.setup();
    vi.mocked(openExtractionDocuments).mockResolvedValue(['F:/Demo/产品手册.docx']);
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/Demo/out');
    vi.mocked(extractDocumentImages)
      .mockRejectedValueOnce(new Error('DOCX_IMAGE_EXTRACT_FAILED'))
      .mockResolvedValueOnce({
        outputPaths: ['F:/Demo/out/产品手册_001.png'],
        extractedCount: 1,
        skippedCount: 0
      });

    render(<ExtractImagePage />);

    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.click(screen.getByRole('button', { name: '开始提取' }));

    const failedDetailsButton = screen.getByRole('button', { name: '错误详情' });
    await user.click(failedDetailsButton);

    const failedDetailsDialog = await screen.findByRole('dialog', { name: '错误详情' });
    expect(failedDetailsButton).toHaveAttribute('aria-expanded', 'true');
    expect(within(failedDetailsDialog).getByText('产品手册.docx')).toBeInTheDocument();
    expect(within(failedDetailsDialog).getByText('DOCX_IMAGE_EXTRACT_FAILED')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '错误详情' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重试失败项' }));
    await user.click(screen.getByRole('button', { name: '开始提取' }));

    await waitFor(() => {
      expect(extractDocumentImages).toHaveBeenCalledTimes(2);
      expect(screen.getByText('完成 1 张')).toBeInTheDocument();
    });
  });
});
