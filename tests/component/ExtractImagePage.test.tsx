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
    getSettingsStore().setState({
      language: 'zh-CN',
      outputDirectoryStrategy: 'same-as-source',
      exportSettings: { namingPattern: 'source-name-index', outputFormat: 'jpg', colorMode: 'rgb', quality: 90 }
    });
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

    expect(screen.queryByText('文件列表')).not.toBeInTheDocument();
    expect(screen.queryByText('提取设置')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加文件' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清空列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始提取' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '打开输出目录' })).toBeDisabled();
    // 批量状态栏、进度面板、错误详情、重试失败项、底部状态栏已按需求移除
    expect(screen.queryByText('全局进度')).not.toBeInTheDocument();
    expect(screen.queryByText('总数')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '错误详情' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试失败项' })).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo', { name: '提取任务页状态栏' })).not.toBeInTheDocument();
  });

  it('renders revised extraction output settings', () => {
    const { container } = render(<ExtractImagePage />);

    const importButton = screen.getByRole('button', { name: '添加文件' });

    // 新布局为上下结构：功能区在上、文件列表在下，不再使用两栏网格。
    expect(
      Array.from(container.querySelectorAll('div')).some((element) => element.className.includes('xl:grid-cols-[1fr_380px]'))
    ).toBe(false);
    expect(importButton.className).not.toContain('shadow');
    expect(screen.queryByLabelText('导出格式')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('输出色彩模式')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('命名规则')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('输出目录')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '选择路径' })).not.toBeInTheDocument();
    const startButton = screen.getByRole('button', { name: '开始提取' });
    expect(startButton.className).not.toContain('shadow');
    expect(importButton.className).toContain('h-10');
    expect(startButton.className).toContain('h-10');
    expect(startButton.className).not.toContain('h-14');
    expect(screen.getByRole('button', { name: '打开输出目录' })).toBeInTheDocument();

    const emptyState = screen.getByText('支持word、pdf、ppt文件，拖拽文件夹即可打开。').closest('div');
    expect(emptyState?.className).toContain('justify-center');
    expect(emptyState?.className).toContain('min-h-[320px]');

    // 批量进度面板、错误详情、重试失败项、底部状态栏已移除
    expect(screen.queryByTestId('batch-progress-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '错误详情' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试失败项' })).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo', { name: '提取任务页状态栏' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: '打开输出目录' })).toBeInTheDocument();

    act(() => {
      getSettingsStore().setState({ language: 'en-US' });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start extraction' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '开始提取' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open output directory' })).toBeInTheDocument();
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

  it('extracts images using the global extraction settings and inferred output directory', async () => {
    const user = userEvent.setup();
    vi.mocked(openExtractionDocuments).mockResolvedValue(['F:/Demo/产品手册.docx']);
    getSettingsStore().setState({
      exportSettings: { outputFormat: 'jpg', colorMode: 'gray-cmyk', namingPattern: 'source-name-date', quality: 90 }
    });

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

    await user.click(screen.getByRole('button', { name: '开始提取' }));

    await waitFor(() => {
      expect(extractDocumentImages).toHaveBeenCalledWith({
        sourcePath: 'F:/Demo/产品手册.docx',
        outputDirectory: 'F:/Demo',
        outputFormat: 'jpg',
        colorMode: 'gray-cmyk',
        quality: 90,
        namingPattern: 'source-name-date',
        includeOutputPaths: false
      });
    });

    expect((await screen.findAllByText('完成 2 张')).length).toBeGreaterThan(0);
  });

  it('opens the extraction output directory inferred from imported sources', async () => {
    const user = userEvent.setup();
    vi.mocked(openExtractionDocuments).mockResolvedValue(['F:/Demo/产品手册.docx']);
    vi.mocked(openDirectoryInSystem).mockResolvedValue(undefined);

    render(<ExtractImagePage />);

    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.click(await screen.findByRole('button', { name: '打开输出目录' }));

    expect(openDirectoryInSystem).toHaveBeenCalledWith('F:/Demo');
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

  it('surfaces a failed extraction in the document list row', async () => {
    const user = userEvent.setup();
    vi.mocked(openExtractionDocuments).mockResolvedValue(['F:/Demo/产品手册.docx']);
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/Demo/out');
    vi.mocked(extractDocumentImages).mockRejectedValueOnce(new Error('DOCX_IMAGE_EXTRACT_FAILED'));

    render(<ExtractImagePage />);

    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await user.click(screen.getByRole('button', { name: '开始提取' }));

    await waitFor(() => {
      expect(extractDocumentImages).toHaveBeenCalledTimes(1);
      expect(screen.getByText('失败')).toBeInTheDocument();
    });
  });
});
