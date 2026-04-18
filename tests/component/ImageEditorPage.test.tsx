import { act, render, screen, waitFor } from '@testing-library/react';
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

describe('ImageEditorPage', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
    vi.clearAllMocks();
    vi.useRealTimers();
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

  it('opens a selected file and renders session metadata with thumbnails', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    expect(screen.getByRole('heading', { name: '编辑工具栏' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开图片' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开图片' }));

    await waitFor(() => {
      expect(openImageSession).toHaveBeenCalledWith('F:/Demo/示例图片_A.jpg');
    });

    expect(screen.getByRole('button', { name: /示例图片_A.jpg/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '示例图片_A.jpg 缩略图' })).toBeInTheDocument();
    expect(screen.getByText('目录图片数')).toBeInTheDocument();
    await waitFor(() => {
      expect(generateImagePreview).toHaveBeenCalled();
    });
  });

  it('prompts before switching with unsaved changes and confirms the switch', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开图片' }));

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage?.name).toBe('示例图片_A.jpg');
    });

    await user.click(screen.getByLabelText('brightness'));
    act(() => {
      useEditorStore.getState().updateAdjustment('brightness', 25);
    });
    await user.click(screen.getByRole('button', { name: '下一张' }));

    expect(screen.getByText('存在未保存修改')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '不保存并切换' }));

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage?.name).toBe('示例图片_B.png');
    });
    await waitFor(() => {
      expect(vi.mocked(generateImagePreview)).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'F:/Demo/示例图片_B.png' })
      );
    });
  });

  it('saves JPG successfully and clears unsaved state', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');
    vi.mocked(chooseJpgSavePath).mockResolvedValue('F:/Demo/示例图片_A_edited.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开图片' }));

    await waitFor(() => {
      expect(useEditorStore.getState().currentImage?.name).toBe('示例图片_A.jpg');
    });

    act(() => {
      useEditorStore.getState().updateAdjustment('contrast', 40);
    });

    await user.click(screen.getByRole('button', { name: '保存 JPG' }));

    await waitFor(() => {
      expect(saveImageAsJpg).toHaveBeenCalledWith({
        sourcePath: 'F:/Demo/示例图片_A.jpg',
        targetPath: 'F:/Demo/示例图片_A_edited.jpg',
        adjustments: expect.objectContaining({ contrast: 40 }),
        quality: 90
      });
    });

    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });
});
