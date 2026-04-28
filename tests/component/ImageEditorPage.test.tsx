import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageEditorPage from '../../src/pages/ImageEditorPage';
import { editorSessionFixture } from '../../src/services/editorFixtures';
import { useEditorStore } from '../../src/stores/editorStore';

vi.mock('../../src/services/fileDialog', () => ({
  openImageFile: vi.fn(),
  chooseJpgSavePath: vi.fn()
}));

vi.mock('../../src/services/editorCommands', () => ({
  openImageSession: vi.fn(),
  generateImagePreview: vi.fn(),
  saveImageAsJpg: vi.fn()
}));

const { openImageFile, chooseJpgSavePath } = await import('../../src/services/fileDialog');
const { openImageSession, generateImagePreview, saveImageAsJpg } = await import('../../src/services/editorCommands');

describe('ImageEditorPage redesign layout', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
    vi.clearAllMocks();
    vi.mocked(generateImagePreview).mockResolvedValue({
      dataUrl: 'data:image/jpeg;base64,preview-a',
      width: 720,
      height: 540
    });
    vi.mocked(openImageSession).mockResolvedValue(editorSessionFixture);
    vi.mocked(saveImageAsJpg).mockResolvedValue({
      savedPath: 'F:/Demo/示例图片_A_edited.jpg',
      sizeBytes: 123456
    });
  });

  it('renders the redesign filmstrip and bottom status bar', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开图片' }));

    const filmstrip = await screen.findByRole('region', { name: '底部胶片带' });
    expect(within(filmstrip).getByRole('button', { name: '上一张' })).toBeInTheDocument();
    expect(within(filmstrip).getByRole('button', { name: '下一张' })).toBeInTheDocument();
    expect(within(filmstrip).getByText('1.0')).toBeInTheDocument();
    expect(within(filmstrip).getByText('2.0')).toBeInTheDocument();

    const bottomBar = screen.getByRole('contentinfo');
    expect(within(bottomBar).getByText('当前文件')).toBeInTheDocument();
    expect(within(bottomBar).getByText('示例图片_A.jpg')).toBeInTheDocument();
    expect(within(bottomBar).getByText('1920 × 1080')).toBeInTheDocument();
  });

  it('still supports undo redo and save after the redesign', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');
    vi.mocked(chooseJpgSavePath).mockResolvedValue('F:/Demo/示例图片_A_edited.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开图片' }));

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage?.name).toBe('示例图片_A.jpg');
    });

    act(() => {
      useEditorStore.getState().updateAdjustment('quality', 72);
    });

    await user.click(screen.getByRole('button', { name: '撤销' }));
    expect(useEditorStore.getState().adjustments.quality).toBe(90);

    await user.click(screen.getByRole('button', { name: '重做' }));
    expect(useEditorStore.getState().adjustments.quality).toBe(72);

    await user.click(screen.getByRole('button', { name: '保存 JPG' }));

    await waitFor(() => {
      expect(saveImageAsJpg).toHaveBeenCalledWith({
        sourcePath: 'F:/Demo/示例图片_A.jpg',
        targetPath: 'F:/Demo/示例图片_A_edited.jpg',
        adjustments: expect.objectContaining({ quality: 72 }),
        quality: 72
      });
    });
  });
});
