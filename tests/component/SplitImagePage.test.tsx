import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('../../src/services/batchTaskCommands', () => ({
  createBatchTaskId: vi.fn(() => 'split-test-task'),
  registerBatchTask: vi.fn(async () => undefined),
  cancelBatchTask: vi.fn(async () => undefined),
  completeBatchTask: vi.fn(async () => undefined),
  isCancelledError: vi.fn(() => false)
}));

const { openSplittingSources } = await import('../../src/services/fileDialog');
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
    vi.mocked(splitImageFile).mockResolvedValue({ outputPaths: ['F:/demo/a-001.jpg', 'F:/demo/a-002.jpg'], splitCount: 2, skippedCount: 0 });
    getSettingsStore().setState({
      language: 'zh-CN',
      maxConcurrency: 2,
      outputDirectoryStrategy: 'same-as-source',
      exportSettings: { namingPattern: 'source-name-index', outputFormat: 'png', colorMode: 'rgb', quality: 100 }
    });
  });

  it('renders splitting workspace layout', () => {
    render(<SplitImagePage />);

    // "文件列表"标题已按需求移除。
    expect(screen.queryByText('文件列表')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '图片分割' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加文件' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清空列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '分割图片' })).toBeDisabled();
    expect(screen.getByText('模式')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '横向分割' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '竖向分割' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '网格分割' })).toBeInTheDocument();
    expect(screen.queryByLabelText('导出格式')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: /图片质量/ })).not.toBeInTheDocument();
    // 底部状态栏（总数/成功/失败/进行中/全局进度/错误详情/重试）已按需求移除。
    expect(screen.queryByText('全局进度')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开输出目录' })).toBeDisabled();
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
    // 输出目录不再展示在底部状态栏；以「打开输出目录」按钮变为可用来体现已推断目录。
    await waitFor(() => expect(screen.getByRole('button', { name: '打开输出目录' })).toBeEnabled());
  });

  it('starts horizontal splitting with selected grid settings', async () => {
    const user = userEvent.setup();
    vi.mocked(openSplittingSources).mockResolvedValue({ files: ['F:/demo/a.jpg'], directories: [], cancelled: false });
    vi.mocked(inspectSplittingFile).mockResolvedValue(imageInfo);
    vi.mocked(splitImageFile).mockResolvedValue({ outputPaths: ['F:/demo/a-001.webp', 'F:/demo/a-002.webp', 'F:/demo/a-003.webp'], splitCount: 3, skippedCount: 0 });
    getSettingsStore().setState({ exportSettings: { namingPattern: 'source-name-index', outputFormat: 'webp', colorMode: 'rgb', quality: 80 } });

    render(<SplitImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(screen.getByRole('button', { name: '横向分割' }));
    fireEvent.change(screen.getByRole('slider', { name: /横向分割份数/ }), { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: '分割图片' }));

    await waitFor(() => expect(splitImageFile).toHaveBeenCalledWith({
      sourcePath: 'F:/demo/a.jpg',
      outputDirectory: 'F:/demo',
      outputFormat: 'webp',
      colorMode: 'rgb',
      columns: 3,
      rows: 1,
      quality: 80,
      namingPattern: 'source-name-index',
      includeOutputPaths: false,
      taskId: 'split-test-task'
    }));
    expect(await screen.findByText('完成 3 张')).toBeInTheDocument();
  });

  it('starts vertical splitting with selected grid settings', async () => {
    const user = userEvent.setup();
    vi.mocked(openSplittingSources).mockResolvedValue({ files: ['F:/demo/a.jpg'], directories: [], cancelled: false });
    vi.mocked(inspectSplittingFile).mockResolvedValue(imageInfo);
    vi.mocked(splitImageFile).mockResolvedValue({ outputPaths: ['F:/demo/a-001.jpg', 'F:/demo/a-002.jpg', 'F:/demo/a-003.jpg', 'F:/demo/a-004.jpg'], splitCount: 4, skippedCount: 0 });

    render(<SplitImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(screen.getByRole('button', { name: '竖向分割' }));
    fireEvent.change(screen.getByRole('slider', { name: /竖向分割份数/ }), { target: { value: '4' } });
    await user.click(screen.getByRole('button', { name: '分割图片' }));

    await waitFor(() => expect(splitImageFile).toHaveBeenCalledWith({
      sourcePath: 'F:/demo/a.jpg',
      outputDirectory: 'F:/demo',
      outputFormat: 'png',
      colorMode: 'rgb',
      columns: 1,
      rows: 4,
      quality: 100,
      namingPattern: 'source-name-index',
      includeOutputPaths: false,
      taskId: 'split-test-task'
    }));
    expect(await screen.findByText('完成 4 张')).toBeInTheDocument();
  });

  it('starts grid splitting with selected grid settings', async () => {
    const user = userEvent.setup();
    vi.mocked(openSplittingSources).mockResolvedValue({ files: ['F:/demo/a.jpg'], directories: [], cancelled: false });
    vi.mocked(inspectSplittingFile).mockResolvedValue(imageInfo);
    vi.mocked(splitImageFile).mockResolvedValue({ outputPaths: ['F:/demo/a-001.jpg', 'F:/demo/a-002.jpg', 'F:/demo/a-003.jpg', 'F:/demo/a-004.jpg', 'F:/demo/a-005.jpg', 'F:/demo/a-006.jpg'], splitCount: 6, skippedCount: 0 });

    render(<SplitImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(screen.getByRole('button', { name: '网格分割' }));
    fireEvent.change(screen.getByRole('slider', { name: /横向分割份数/ }), { target: { value: '3' } });
    fireEvent.change(screen.getByRole('slider', { name: /竖向分割份数/ }), { target: { value: '2' } });
    await user.click(screen.getByRole('button', { name: '分割图片' }));

    await waitFor(() => expect(splitImageFile).toHaveBeenCalledWith({
      sourcePath: 'F:/demo/a.jpg',
      outputDirectory: 'F:/demo',
      outputFormat: 'png',
      colorMode: 'rgb',
      columns: 3,
      rows: 2,
      quality: 100,
      namingPattern: 'source-name-index',
      includeOutputPaths: false,
      taskId: 'split-test-task'
    }));
    expect(await screen.findByText('完成 6 张')).toBeInTheDocument();
  });

  it('surfaces the failure message inline on the list row', async () => {
    const user = userEvent.setup();
    vi.mocked(openSplittingSources).mockResolvedValue({ files: ['F:/demo/a.jpg'], directories: [], cancelled: false });
    vi.mocked(inspectSplittingFile).mockResolvedValue(imageInfo);
    vi.mocked(splitImageFile).mockRejectedValueOnce(new Error('图片尺寸过小'));

    render(<SplitImagePage />);
    await user.click(screen.getByRole('button', { name: '添加文件' }));
    await screen.findByText('a.jpg');
    await user.click(screen.getByRole('button', { name: '分割图片' }));

    // 失败状态与错误信息直接呈现在列表行内，不再有错误详情弹窗与重试按钮。
    await waitFor(() => expect(screen.getAllByText('失败').length).toBeGreaterThan(0));
    expect((await screen.findAllByText('图片尺寸过小')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '错误详情' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试失败项' })).not.toBeInTheDocument();
  });

  it('re-renders splitting copy when language changes', async () => {
    render(<SplitImagePage />);

    expect(screen.getByRole('button', { name: '分割图片' })).toBeInTheDocument();
    act(() => {
      getSettingsStore().setState({ language: 'en-US' });
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Split Image' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '分割图片' })).not.toBeInTheDocument();
  });
});
