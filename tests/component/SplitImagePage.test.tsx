import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SplitImagePage from '../../src/pages/SplitImagePage';
import { getSettingsStore } from '../../src/hooks/useSettingsStore';

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: vi.fn(() => ({
    onDragDropEvent: vi.fn(async () => vi.fn())
  }))
}));

vi.mock('../../src/services/fileDialog', () => ({
  openSplittingSources: vi.fn(),
  chooseOutputDirectory: vi.fn(),
  openDirectoryInSystem: vi.fn()
}));

vi.mock('../../src/services/splittingCommands', () => ({
  inspectSplittingFile: vi.fn(),
  inspectSplittingDirectory: vi.fn(),
  splitImageFile: vi.fn()
}));

const { openSplittingSources, chooseOutputDirectory, openDirectoryInSystem } = await import('../../src/services/fileDialog');
const { inspectSplittingFile, inspectSplittingDirectory, splitImageFile } = await import('../../src/services/splittingCommands');

const imageInfo = {
  kind: 'image' as const,
  sourcePath: 'F:/demo/a.jpg',
  sourceName: 'a.jpg',
  imageMetadata: { width: 800, height: 600, extension: 'jpg' },
  pdfMetadata: null,
  errorMessage: null
};

const pdfInfo = {
  kind: 'pdf' as const,
  sourcePath: 'F:/demo/manual.pdf',
  sourceName: 'manual.pdf',
  imageMetadata: null,
  pdfMetadata: { pageCount: 2, extension: 'pdf' },
  errorMessage: null
};

describe('SplitImagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(openSplittingSources).mockResolvedValue({ files: [], directories: [], cancelled: false });
    vi.mocked(splitImageFile).mockResolvedValue({ outputPaths: ['F:/demo/a-001-left.jpg', 'F:/demo/a-001-right.jpg'], splitCount: 2, skippedCount: 0 });
    getSettingsStore().setState({ language: 'zh-CN', maxConcurrency: 2 });
  });

  it('renders splitting workspace layout', () => {
    render(<SplitImagePage />);

    expect(screen.getByText('文件列表')).toBeInTheDocument();
    expect(screen.getByText('分割设置')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加文件' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清空列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始分割' })).toBeDisabled();
    expect(screen.getByLabelText('导出格式')).toBeInTheDocument();
    expect(screen.getByLabelText('命名规则')).toBeInTheDocument();
    expect(screen.getByLabelText('分割方向')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '分割比例' })).toBeInTheDocument();
    expect(screen.getByText('全局进度')).toBeInTheDocument();
  });

  it('imports files and folders and defaults output directory', async () => {
    const user = userEvent.setup();
    vi.mocked(openSplittingSources).mockResolvedValue({ files: ['F:/demo/a.jpg'], directories: ['F:/demo/docs'], cancelled: false });
    vi.mocked(inspectSplittingFile).mockResolvedValue(imageInfo);
    vi.mocked(inspectSplittingDirectory).mockResolvedValue([pdfInfo]);

    render(<SplitImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));

    expect(openSplittingSources).toHaveBeenCalledTimes(1);
    expect(inspectSplittingFile).toHaveBeenCalledWith('F:/demo/a.jpg');
    expect(inspectSplittingDirectory).toHaveBeenCalledWith('F:/demo/docs');
    expect(await screen.findByText('a.jpg')).toBeInTheDocument();
    expect(screen.getByText('manual.pdf')).toBeInTheDocument();
    expect(screen.getByDisplayValue('F:/demo/docs')).toBeInTheDocument();
  });

  it('starts splitting with selected settings', async () => {
    const user = userEvent.setup();
    vi.mocked(openSplittingSources).mockResolvedValue({ files: ['F:/demo/a.jpg'], directories: [], cancelled: false });
    vi.mocked(inspectSplittingFile).mockResolvedValue(imageInfo);
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');

    render(<SplitImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.selectOptions(screen.getByLabelText('导出格式'), 'webp');
    await user.selectOptions(screen.getByLabelText('命名规则'), 'source-name-date');
    await user.selectOptions(screen.getByLabelText('分割方向'), 'horizontal');
    await user.clear(screen.getByLabelText('分割比例数值'));
    await user.type(screen.getByLabelText('分割比例数值'), '30');
    await user.click(screen.getByRole('button', { name: '开始分割' }));

    await waitFor(() => expect(splitImageFile).toHaveBeenCalledWith({
      sourcePath: 'F:/demo/a.jpg',
      outputDirectory: 'F:/out',
      outputFormat: 'webp',
      splitDirection: 'horizontal',
      ratio: 30,
      namingPattern: 'source-name-date'
    }));
    expect(await screen.findByText('完成 2 张')).toBeInTheDocument();
  });

  it('shows failed details and retries failed items', async () => {
    const user = userEvent.setup();
    vi.mocked(openSplittingSources).mockResolvedValue({ files: ['F:/demo/a.jpg'], directories: [], cancelled: false });
    vi.mocked(inspectSplittingFile).mockResolvedValue(imageInfo);
    vi.mocked(splitImageFile)
      .mockRejectedValueOnce(new Error('图片尺寸过小'))
      .mockResolvedValueOnce({ outputPaths: ['F:/demo/a-001-left.jpg', 'F:/demo/a-001-right.jpg'], splitCount: 2, skippedCount: 0 });

    render(<SplitImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(screen.getByRole('button', { name: '开始分割' }));

    await waitFor(() => expect(screen.getAllByText('失败').length).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: '错误详情' }));
    expect((await screen.findAllByText('图片尺寸过小')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: '关闭' }));
    await user.click(screen.getByRole('button', { name: '重试失败项' }));
    await user.click(screen.getByRole('button', { name: '开始分割' }));

    await waitFor(() => expect(splitImageFile).toHaveBeenCalledTimes(2));
  });

  it('re-renders splitting copy when language changes', async () => {
    render(<SplitImagePage />);

    expect(screen.getByRole('button', { name: '开始分割' })).toBeInTheDocument();
    act(() => {
      getSettingsStore().setState({ language: 'en-US' });
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Start splitting' })).toBeInTheDocument());
    expect(screen.getByText('Splitting settings')).toBeInTheDocument();
    const footer = screen.getByRole('contentinfo', { name: 'Splitting task footer' });
    expect(within(footer).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === 'Current task: Image splitting')).toBeInTheDocument();
  });

  it('opens the selected output directory', async () => {
    const user = userEvent.setup();
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/out');
    vi.mocked(openDirectoryInSystem).mockResolvedValue(undefined);

    render(<SplitImagePage />);
    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.click(await screen.findByRole('button', { name: '打开输出目录' }));

    expect(openDirectoryInSystem).toHaveBeenCalledWith('F:/out');
  });
});
