import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageDownloadPage from '../../src/pages/ImageDownloadPage';
import { getSettingsStore } from '../../src/hooks/useSettingsStore';

const { subscribeDownloadMetadata } = vi.hoisted(() => ({
  subscribeDownloadMetadata: vi.fn(),
}));

vi.mock('../../src/services/imageDownloadCommands', () => ({
  inspectDownloadSource: vi.fn(),
  saveDownloadImages: vi.fn(),
  fetchDownloadThumbnail: vi.fn(),
  subscribeDownloadMetadata,
}));

vi.mock('../../src/services/fileDialog', () => ({
  chooseOutputDirectory: vi.fn(),
  openDirectoryInSystem: vi.fn(),
}));

const { inspectDownloadSource, saveDownloadImages, fetchDownloadThumbnail } = await import('../../src/services/imageDownloadCommands');
const { chooseOutputDirectory } = await import('../../src/services/fileDialog');

const inspectedImage = {
  id: 'img-1',
  sourceUrl: 'https://example.com/a.jpg',
  name: 'a.jpg',
  title: '示例图片',
  sizeInBytes: 2048,
  format: 'jpg',
  width: 100,
  height: 100,
  previewUrl: 'https://example.com/a.jpg',
};

describe('ImageDownloadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeDownloadMetadata.mockResolvedValue(vi.fn());
    vi.mocked(fetchDownloadThumbnail).mockResolvedValue('C:/cache/download-thumbnails/thumb-1.jpg');
    getSettingsStore().setState({ language: 'zh-CN' });
  });

  it('renders one content card without hero title status overview or mode tabs', () => {
    const { container } = render(<ImageDownloadPage />);

    expect(screen.queryByRole('heading', { name: '图片下载' })).not.toBeInTheDocument();
    expect(screen.queryByText('状态概览')).not.toBeInTheDocument();
    expect(screen.queryByText('导出格式')).not.toBeInTheDocument();
    expect(screen.queryByText('图片总数')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '网页图片下载' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '微信公众号图片下载' })).not.toBeInTheDocument();

    expect(container.querySelectorAll('section')).toHaveLength(1);
    expect(screen.getByPlaceholderText('请输入网页或公众号文章链接')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始提取' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '提取结果' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '全选' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '批量下载' })).toBeInTheDocument();
  });

  it('places output directory controls above URL extraction controls', () => {
    render(<ImageDownloadPage />);

    const outputLabel = screen.getByText('输出目录');
    const urlInput = screen.getByPlaceholderText('请输入网页或公众号文章链接');
    expect(outputLabel.compareDocumentPosition(urlInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('infers WeChat article mode from the URL', async () => {
    vi.mocked(inspectDownloadSource).mockResolvedValue({ pageTitle: '公众号文章', images: [] });
    vi.mocked(chooseOutputDirectory).mockResolvedValue('C:/output');

    const user = userEvent.setup();
    render(<ImageDownloadPage />);

    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.type(screen.getByPlaceholderText('请输入网页或公众号文章链接'), 'https://mp.weixin.qq.com/s/demo');
    await user.click(screen.getByRole('button', { name: '开始提取' }));

    await waitFor(() => {
      expect(inspectDownloadSource).toHaveBeenCalledWith({
        mode: 'wechat-article',
        url: 'https://mp.weixin.qq.com/s/demo',
      });
    });
  });

  it('inspects a source and downloads selected images', async () => {
    vi.mocked(inspectDownloadSource).mockResolvedValue({
      pageTitle: '示例文章',
      images: [inspectedImage],
    });
    vi.mocked(chooseOutputDirectory).mockResolvedValue('C:/output');
    vi.mocked(saveDownloadImages).mockResolvedValue({
      savedCount: 1,
      skippedCount: 0,
      outputPaths: ['C:/output/a.jpg'],
    });

    const user = userEvent.setup();
    render(<ImageDownloadPage />);

    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.type(screen.getByPlaceholderText('请输入网页或公众号文章链接'), 'https://example.com/post');
    await user.click(screen.getByRole('button', { name: '开始提取' }));

    await waitFor(() => {
      expect(inspectDownloadSource).toHaveBeenCalledWith({
        mode: 'webpage',
        url: 'https://example.com/post',
      });
    });

    expect(await screen.findByText('示例图片')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText('JPG')).toBeInTheDocument();
    expect(screen.queryAllByText('a.jpg')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '批量下载' }));

    await waitFor(() => {
      expect(saveDownloadImages).toHaveBeenCalledWith({
        mode: 'webpage',
        pageUrl: 'https://example.com/post',
        outputDirectory: 'C:/output',
        imageIds: ['img-1'],
      });
    });
  });

  it('downloads a single image from the list', async () => {
    vi.mocked(inspectDownloadSource).mockResolvedValue({
      pageTitle: '示例文章',
      images: [inspectedImage],
    });
    vi.mocked(chooseOutputDirectory).mockResolvedValue('C:/output');
    vi.mocked(saveDownloadImages).mockResolvedValue({ savedCount: 1, skippedCount: 0, outputPaths: ['C:/output/a.jpg'] });

    const user = userEvent.setup();
    render(<ImageDownloadPage />);

    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.type(screen.getByPlaceholderText('请输入网页或公众号文章链接'), 'https://example.com/post');
    await user.click(screen.getByRole('button', { name: '开始提取' }));
    await screen.findByText('示例图片');
    await user.click(screen.getByRole('button', { name: '下载 示例图片' }));

    await waitFor(() => {
      expect(saveDownloadImages).toHaveBeenCalledWith({
        mode: 'webpage',
        pageUrl: 'https://example.com/post',
        outputDirectory: 'C:/output',
        imageIds: ['img-1'],
      });
    });
  });

  it('renders results as a square product grid without selected red borders', async () => {
    vi.mocked(inspectDownloadSource).mockResolvedValue({
      pageTitle: '示例文章',
      images: [inspectedImage],
    });
    vi.mocked(chooseOutputDirectory).mockResolvedValue('C:/output');

    const user = userEvent.setup();
    const { container } = render(<ImageDownloadPage />);

    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.type(screen.getByPlaceholderText('请输入网页或公众号文章链接'), 'https://example.com/post');
    await user.click(screen.getByRole('button', { name: '开始提取' }));

    expect(await screen.findByText('示例图片')).toBeInTheDocument();
    expect(screen.getByText('提取结果')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '全选' })).toBeInTheDocument();
    expect(screen.queryByText('示例文章')).not.toBeInTheDocument();
    expect(screen.queryByText('1/1')).not.toBeInTheDocument();
    // 预览经后端缩略图代理，img 在缩略图解析完成后才渲染。
    expect(await screen.findByRole('img', { name: '示例图片' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载 示例图片' })).toBeInTheDocument();

    const itemCard = container.querySelector('[data-testid="download-image-card"]');
    expect(itemCard?.className).toContain('rounded-lg');
    expect(itemCard?.className).not.toContain('border-meitu');
    expect(screen.getByRole('img', { name: '示例图片' }).className).toContain('rounded-md');
    expect(fetchDownloadThumbnail).toHaveBeenCalledWith('https://example.com/post', 'https://example.com/a.jpg');
  });

  it('shows loading metadata first and updates size and format from metadata events', async () => {
    let metadataHandler: ((payload: { id: string; sizeInBytes: number; format: string | null }) => void) | null = null;
    subscribeDownloadMetadata.mockImplementation(async (handler) => {
      metadataHandler = handler;
      return vi.fn();
    });
    vi.mocked(inspectDownloadSource).mockResolvedValue({
      pageTitle: '示例文章',
      images: [{ ...inspectedImage, sizeInBytes: 0, format: null }],
    });
    vi.mocked(chooseOutputDirectory).mockResolvedValue('C:/output');

    const user = userEvent.setup();
    render(<ImageDownloadPage />);

    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.type(screen.getByPlaceholderText('请输入网页或公众号文章链接'), 'https://example.com/post');
    await user.click(screen.getByRole('button', { name: '开始提取' }));

    expect(await screen.findByText('示例图片')).toBeInTheDocument();
    expect(screen.getAllByText('加载中')).toHaveLength(2);

    act(() => {
      metadataHandler?.({ id: 'img-1', sizeInBytes: 4096, format: 'png' });
    });

    expect(await screen.findByText('4.0 KB')).toBeInTheDocument();
    expect(screen.getByText('PNG')).toBeInTheDocument();
  });

  it('shows an empty result message when no images are found', async () => {
    vi.mocked(inspectDownloadSource).mockResolvedValue({ pageTitle: '空页面', images: [] });
    vi.mocked(chooseOutputDirectory).mockResolvedValue('C:/output');

    const user = userEvent.setup();
    render(<ImageDownloadPage />);

    await user.click(screen.getByRole('button', { name: '选择路径' }));
    await user.type(screen.getByPlaceholderText('请输入网页或公众号文章链接'), 'https://example.com/empty');
    await user.click(screen.getByRole('button', { name: '开始提取' }));

    expect(await screen.findByText('未找到可下载图片')).toBeInTheDocument();
  });

  it('blocks inspect before choosing an output directory', async () => {
    const user = userEvent.setup();
    render(<ImageDownloadPage />);

    await user.type(screen.getByPlaceholderText('请输入网页或公众号文章链接'), 'https://example.com/post');
    const inspectButton = screen.getByRole('button', { name: '开始提取' });
    expect(inspectButton).toBeDisabled();
  });
});
