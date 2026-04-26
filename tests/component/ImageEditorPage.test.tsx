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

  it('renders the latest toolbar without copy or paste buttons', async () => {
    const user = userEvent.setup();
    vi.mocked(openImageFile).mockResolvedValue('F:/Demo/示例图片_A.jpg');

    render(<ImageEditorPage />);
    await user.click(screen.getByRole('button', { name: '打开图片' }));

    await waitFor(() => {
      expect(openImageSession).toHaveBeenCalled();
    });

    expect(screen.queryByRole('button', { name: '复制参数' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '粘贴参数' })).not.toBeInTheDocument();
  });

  it('saves the current image after an adjustment change', async () => {
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
      expect(saveImageAsJpg).toHaveBeenCalled();
    });
  });
});
