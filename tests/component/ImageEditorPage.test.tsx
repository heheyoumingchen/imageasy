import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageEditorPage from '../../src/pages/ImageEditorPage';
import { getSettingsStore } from '../../src/hooks/useSettingsStore';
import { useEditorStore } from '../../src/stores/editorStore';
import type { OpenImageSessionResult } from '../../src/types/editor';

const thumbnailPlaceholder =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" rx="16" fill="%230f172a"/><rect x="16" y="16" width="128" height="88" rx="12" fill="%231e293b"/><circle cx="54" cy="48" r="12" fill="%2322d3ee"/><path d="M24 92l32-28 20 16 26-22 34 34H24z" fill="%2364748b"/></svg>';

const editorSessionFixture: OpenImageSessionResult = {
  currentImage: {
    path: 'F:/Demo/示例图片_A.jpg',
    name: '示例图片_A.jpg',
    extension: 'jpg',
    width: 1920,
    height: 1080,
    sizeBytes: 428512
  },
  directoryImages: [
    {
      index: 0,
      path: 'F:/Demo/示例图片_A.jpg',
      name: '示例图片_A.jpg',
      extension: 'jpg',
      width: 1920,
      height: 1080,
      sizeBytes: 428512,
      thumbnailDataUrl: thumbnailPlaceholder
    },
    {
      index: 1,
      path: 'F:/Demo/示例图片_B.png',
      name: '示例图片_B.png',
      extension: 'png',
      width: 1280,
      height: 720,
      sizeBytes: 285104,
      thumbnailDataUrl: thumbnailPlaceholder
    },
    {
      index: 2,
      path: 'F:/Demo/示例图片_C.webp',
      name: '示例图片_C.webp',
      extension: 'webp',
      width: 1600,
      height: 900,
      sizeBytes: 319872,
      thumbnailDataUrl: thumbnailPlaceholder
    }
  ],
  currentIndex: 0
};

vi.mock('../../src/services/fileDialog', () => ({
  openImageFile: vi.fn(),
  chooseJpgSavePath: vi.fn()
}));

vi.mock('../../src/services/editorCommands', () => ({
  openImageSession: vi.fn(),
  generateImagePreview: vi.fn(),
  prefetchImagePreview: vi.fn().mockResolvedValue(undefined),
  saveImageAsJpg: vi.fn(),
  commitCropToWorkingImage: vi.fn()
}));

const { openImageFile, chooseJpgSavePath } = await import('../../src/services/fileDialog');
const { openImageSession, generateImagePreview, saveImageAsJpg, commitCropToWorkingImage } = await import('../../src/services/editorCommands');

const destructiveCropFixture = {
  workingImage: {
    path: 'F:/Demo/.editor-work/示例图片_A__crop_1.jpg',
    name: '示例图片_A__crop_1.jpg',
    extension: 'jpg',
    width: 640,
    height: 360,
    sizeBytes: 86543
  }
};

const previewFixture = {
  previewPath: 'C:/temp/imageasy/editor-previews/preview_a.jpg',
  previewUrl: 'asset://localhost/C:/temp/imageasy/editor-previews/preview_a.jpg',
  width: 720,
  height: 540
};

const savedJpgFixture = {
  savedPath: 'F:/Demo/示例图片_A_001.jpg',
  sizeBytes: 123456
};

describe('ImageEditorPage redesign layout', () => {
  beforeEach(() => {
    getSettingsStore().setState({ language: 'zh-CN' });
    useEditorStore.getState().reset();
    vi.clearAllMocks();
    vi.mocked(generateImagePreview).mockResolvedValue(previewFixture);
    vi.mocked(openImageSession).mockResolvedValue(editorSessionFixture);
    vi.mocked(saveImageAsJpg).mockResolvedValue(savedJpgFixture);
    vi.mocked(commitCropToWorkingImage).mockResolvedValue(destructiveCropFixture);
  });

  it('requests the main preview immediately after opening an image', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));

    await waitFor(() => {
      expect(openImageSession).toHaveBeenCalledTimes(1);
    });
    expect(generateImagePreview).toHaveBeenCalledTimes(1);
    expect(generateImagePreview).toHaveBeenCalledWith({
      path: 'F:/Demo/示例图片_A.jpg',
      adjustments: expect.objectContaining({ brightness: 0, filterType: 'none' }),
      maxWidth: 760,
      maxHeight: 560
    });
  });

  it('renders a streamlined filmstrip and status bar after opening an image', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));

    const filmstrip = await screen.findByRole('region', { name: '底部胶片带' });
    expect(within(filmstrip).getByRole('button', { name: '上一张' })).toBeInTheDocument();
    expect(within(filmstrip).getByRole('button', { name: '下一张' })).toBeInTheDocument();
    expect(within(filmstrip).queryByText('缩略图序列')).not.toBeInTheDocument();
    expect(within(filmstrip).queryByText('示例图片_A.jpg')).not.toBeInTheDocument();
    expect(within(filmstrip).queryByText('1.0')).not.toBeInTheDocument();
    expect(within(filmstrip).queryByText('2.0')).not.toBeInTheDocument();
    expect(within(filmstrip).getAllByRole('img')).toHaveLength(3);

    const bottomBar = screen.getByRole('contentinfo');
    expect(
      within(bottomBar).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '当前文件:')
    ).toBeInTheDocument();
    expect(within(bottomBar).getByText('示例图片_A.jpg · 尺寸：1920 × 1080 · 大小：418.5 KB')).toBeInTheDocument();
    expect(within(bottomBar).getByText('1 / 3')).toBeInTheDocument();
    expect(within(bottomBar).queryByText('F:/Demo/示例图片_A.jpg')).not.toBeInTheDocument();
  });

  it('removes redundant editor copy from the page and preview area', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);

    expect(screen.queryByRole('heading', { level: 1, name: '图片编辑' })).not.toBeInTheDocument();
    expect(screen.queryByText('调整基础参数、滤镜与裁剪，并实时预览输出效果')).not.toBeInTheDocument();
    expect(screen.queryByText('预览窗口')).not.toBeInTheDocument();
    expect(screen.queryByText('旋转、裁剪与缩放都在这里完成。')).not.toBeInTheDocument();
    expect(screen.queryByText('正在打开图片')).not.toBeInTheDocument();
    expect(screen.queryByText('正在保存 JPG')).not.toBeInTheDocument();
    expect(screen.queryByText('正在更新预览')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开' }));

    expect(await screen.findByRole('img', { name: 'preview' })).toBeInTheDocument();
    expect(screen.queryByText('亮度 0')).not.toBeInTheDocument();
    expect(screen.queryByText('对比度 0')).not.toBeInTheDocument();
    expect(screen.queryByText('饱和度 0')).not.toBeInTheDocument();
    expect(screen.queryByText('正在更新预览')).not.toBeInTheDocument();
  });

  it('keeps preview actions only in the top toolbar and still shows the zoom slider', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));

    expect(await screen.findByRole('img', { name: 'preview' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '左旋转' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '右旋转' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '裁剪' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '缩放' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '缩放' }));
    expect(screen.getByRole('slider', { name: '缩放倍率' })).toBeInTheDocument();
  });

  it('defaults quality to 100 and uses a flatter preview with taller thumbnails', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);

    expect((screen.getByLabelText('压缩质量') as HTMLInputElement).value).toBe('100');

    await user.click(screen.getByRole('button', { name: '打开' }));

    const previewImage = await screen.findByRole('img', { name: 'preview' });
    const firstThumbnail = screen.getByRole('img', { name: '示例图片_A.jpg 缩略图' });

    expect(previewImage.className).not.toContain('shadow-');
    expect(firstThumbnail.parentElement?.className).toContain('h-[74px]');
  });

  it('switches between basic adjustments and filters and shows temperature and tint sliders', async () => {
    const user = userEvent.setup();

    render(<ImageEditorPage />);

    expect(screen.getByRole('button', { name: '基础功能' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '滤镜' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('亮度')).toBeInTheDocument();
    expect(screen.getByLabelText('色温')).toBeInTheDocument();
    expect(screen.getByLabelText('色调')).toBeInTheDocument();
    expect(screen.queryByLabelText('选择滤镜')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '滤镜' }));

    expect(screen.getByRole('button', { name: '基础功能' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '滤镜' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '无滤镜' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '无滤镜' }).className).toContain('h-10');
    expect(screen.getByRole('button', { name: '无滤镜' }).className).not.toContain('min-h-12');
    expect(screen.getByRole('button', { name: '经典黑白' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暖阳气息' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清冷海洋' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复古胶片' })).toBeInTheDocument();
    expect(screen.getByLabelText('滤镜强度')).toBeInTheDocument();
    expect(screen.queryByLabelText('亮度')).not.toBeInTheDocument();
  });

  it('passes temperature and tint through the save flow', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');
    vi.mocked(chooseJpgSavePath).mockResolvedValue('F:/Demo/示例图片_A_001.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage?.name).toBe('示例图片_A.jpg');
    });

    fireEvent.change(screen.getByLabelText('色温'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('色调'), { target: { value: '-10' } });

    await user.click(screen.getByRole('button', { name: '导出' }));

    await waitFor(() => {
      expect(saveImageAsJpg).toHaveBeenCalledWith({
        sourcePath: 'F:/Demo/示例图片_A.jpg',
        targetPath: 'F:/Demo/示例图片_A_001.jpg',
        adjustments: expect.objectContaining({ quality: 100, temperature: 20, tint: -10 }),
        quality: 100
      });
    });
  });

  it('commits destructive crop into a new working canvas and shows the original file name in the status bar', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));
    await screen.findByRole('img', { name: 'preview' });

    await user.click(screen.getByRole('button', { name: '裁剪' }));
    await user.click(screen.getByRole('button', { name: '确认裁剪' }));

    await waitFor(() => {
      expect(commitCropToWorkingImage).toHaveBeenCalledWith({
        sourcePath: 'F:/Demo/示例图片_A.jpg',
        rotation: 0,
        crop: expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) })
      });
    });

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage).toEqual(destructiveCropFixture.workingImage);
    });

    expect(useEditorStore.getState().adjustments.rotation).toBe(0);
    expect(useEditorStore.getState().adjustments.crop).toBeNull();

    const bottomBar = screen.getByRole('contentinfo');
    expect(within(bottomBar).getByText('示例图片_A.jpg · 尺寸：640 × 360 · 大小：84.5 KB')).toBeInTheDocument();
    expect(within(bottomBar).queryByText('示例图片_A__crop_1.jpg')).not.toBeInTheDocument();
  });

  it('restores the original working canvas path after undoing a destructive crop', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));
    await screen.findByRole('img', { name: 'preview' });

    await user.click(screen.getByRole('button', { name: '裁剪' }));
    await user.click(screen.getByRole('button', { name: '确认裁剪' }));

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage?.path).toBe('F:/Demo/.editor-work/示例图片_A__crop_1.jpg');
    });

    await user.click(screen.getByRole('button', { name: '撤销' }));

    expect(useEditorStore.getState().currentImage?.path).toBe('F:/Demo/示例图片_A.jpg');
    expect(useEditorStore.getState().currentImage?.width).toBe(1920);
    expect(useEditorStore.getState().currentImage?.height).toBe(1080);
  });

  it('saves from the working canvas path while keeping the default save target based on the original image path', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');
    vi.mocked(chooseJpgSavePath).mockResolvedValue('F:/Demo/示例图片_A_001.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));
    await screen.findByRole('img', { name: 'preview' });

    await user.click(screen.getByRole('button', { name: '裁剪' }));
    await user.click(screen.getByRole('button', { name: '确认裁剪' }));

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage?.path).toBe('F:/Demo/.editor-work/示例图片_A__crop_1.jpg');
    });

    await user.click(screen.getByRole('button', { name: '导出' }));

    await waitFor(() => {
      expect(chooseJpgSavePath).toHaveBeenCalledWith('F:/Demo/示例图片_A_001.jpg');
      expect(saveImageAsJpg).toHaveBeenCalledWith({
        sourcePath: 'F:/Demo/.editor-work/示例图片_A__crop_1.jpg',
        targetPath: 'F:/Demo/示例图片_A_001.jpg',
        adjustments: expect.objectContaining({ quality: 100, crop: null, rotation: 0 }),
        quality: 100
      });
    });
  });

  it('ignores a late crop result after switching to another image during crop commit', async () => {
    const user = userEvent.setup();
    let resolveCrop!: (value: typeof destructiveCropFixture) => void;
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');
    vi.mocked(commitCropToWorkingImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCrop = resolve;
        })
    );

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));
    await screen.findByRole('img', { name: 'preview' });

    await user.click(screen.getByRole('button', { name: '裁剪' }));
    await user.click(screen.getByRole('button', { name: '确认裁剪' }));

    await waitFor(() => {
      expect(commitCropToWorkingImage).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('button', { name: '下一张' })).toBeDisabled();
    expect(screen.getByTitle('示例图片_B.png')).toBeDisabled();

    act(() => {
      useEditorStore.getState().switchToIndex(1);
    });

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage?.path).toBe('F:/Demo/示例图片_B.png');
      expect(useEditorStore.getState().originalImage?.path).toBe('F:/Demo/示例图片_B.png');
    });

    resolveCrop(destructiveCropFixture);

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage?.path).toBe('F:/Demo/示例图片_B.png');
      expect(useEditorStore.getState().originalImage?.path).toBe('F:/Demo/示例图片_B.png');
    });

    expect(useEditorStore.getState().currentImage?.name).toBe('示例图片_B.png');
  });

  it('prevents repeated crop submission and disables crop actions while commit is in flight', async () => {
    const user = userEvent.setup();
    let resolveCrop!: (value: typeof destructiveCropFixture) => void;
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');
    vi.mocked(commitCropToWorkingImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCrop = resolve;
        })
    );

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));
    await screen.findByRole('img', { name: 'preview' });

    await user.click(screen.getByRole('button', { name: '裁剪' }));

    const confirmButton = screen.getByRole('button', { name: '确认裁剪' });
    const cancelButton = screen.getByRole('button', { name: '取消裁剪' });

    await user.click(confirmButton);

    await waitFor(() => {
      expect(commitCropToWorkingImage).toHaveBeenCalledTimes(1);
      expect(confirmButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    await user.click(confirmButton);
    await user.click(cancelButton);

    expect(commitCropToWorkingImage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '上一张' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下一张' })).toBeDisabled();

    resolveCrop(destructiveCropFixture);

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage?.path).toBe(destructiveCropFixture.workingImage.path);
    });
  });

  it('still supports undo and redo after the redesign', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage?.name).toBe('示例图片_A.jpg');
    });

    act(() => {
      useEditorStore.getState().updateAdjustment('quality', 72);
    });

    await user.click(screen.getByRole('button', { name: '撤销' }));
    expect(useEditorStore.getState().adjustments.quality).toBe(100);

    await user.click(screen.getByRole('button', { name: '重做' }));
    expect(useEditorStore.getState().adjustments.quality).toBe(72);
  });

  it('requests a larger preview and keeps the crop box in the same transformed stage as the image', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));

    await waitFor(() => {
      expect(generateImagePreview).toHaveBeenCalledWith(
        expect.objectContaining({
          maxWidth: 760,
          maxHeight: 560
        })
      );
    });

    await user.click(screen.getByRole('button', { name: '裁剪' }));

    const stageContent = screen.getByTestId('preview-stage-content');
    expect(within(stageContent).getByRole('img', { name: 'preview' })).toBeInTheDocument();
    expect(within(stageContent).getByTestId('crop-box')).toBeInTheDocument();
    expect(screen.getByTestId('editor-preview-stage').className).not.toContain('p-8');
  });

  it('keeps the inspector full-width after opening an image by allowing the workspace to shrink', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开' }));
    await screen.findByRole('img', { name: 'preview' });

    expect(screen.getByTestId('editor-workspace-column').className).toContain('min-w-0');
    expect(screen.getByTestId('editor-top-action-bar').className).toContain('min-w-0');
    expect(screen.getByTestId('editor-toolbar-groups').className).toContain('min-w-0');
    expect(screen.getByTestId('editor-filmstrip-scroller').className).toContain('min-w-0');
    expect(screen.getByTestId('editor-inspector-shell').className).toContain('w-[280px]');
    expect(screen.getByLabelText('色温')).toBeInTheDocument();
    expect(screen.getByLabelText('色调')).toBeInTheDocument();
  });
});
