import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditorFilmstrip from '../../src/components/image-editor/EditorFilmstrip';

vi.mock('../../src/services/editorCommands', () => ({
  generateEditorThumbnail: vi.fn()
}));

const { generateEditorThumbnail } = await import('../../src/services/editorCommands');

const images = Array.from({ length: 6 }, (_, index) => ({
  index,
  name: `示例图片_${index + 1}.jpg`,
  path: `F:/demo/${index + 1}.jpg`,
  extension: 'jpg',
  width: 800,
  height: 600,
  sizeBytes: 1024,
  thumbnailDataUrl: 'data:image/jpeg;base64,abc'
}));

describe('EditorFilmstrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateEditorThumbnail).mockResolvedValue('data:image/jpeg;base64,lazy-thumb');
  });

  it('sizes thumbnails to fit exactly six visible items', () => {
    render(
      <EditorFilmstrip
        images={images}
        currentIndex={0}
        canGoPrevious={false}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const firstThumbnailButton = screen.getByTitle('示例图片_1.jpg');
    const scroller = screen.getByTestId('editor-filmstrip-scroller');
    expect(scroller.className).toContain('justify-center');
    expect(firstThumbnailButton.className).toContain('min-w-[104px]');
    expect(firstThumbnailButton.className).toContain('max-w-[104px]');
    expect(screen.getAllByRole('button', { name: /缩略图/ })).toHaveLength(6);
  });

  it('retries a missing thumbnail after a failed load when it becomes visible again', async () => {
    const attempts = new Map<string, number>();
    vi.mocked(generateEditorThumbnail).mockImplementation((path: string) => {
      const nextAttempt = (attempts.get(path) ?? 0) + 1;
      attempts.set(path, nextAttempt);
      if (path.endsWith('/1.jpg') && nextAttempt === 1) {
        return Promise.reject(new Error('decode failed'));
      }
      if (path.endsWith('/1.jpg')) {
        return Promise.resolve('data:image/jpeg;base64,retry-thumb');
      }
      return Promise.resolve('data:image/jpeg;base64,lazy-thumb');
    });
    const lazyImages = images.map((image) => ({ ...image, thumbnailDataUrl: '' }));
    const { rerender } = render(
      <EditorFilmstrip
        images={lazyImages}
        currentIndex={0}
        canGoPrevious={false}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(generateEditorThumbnail).toHaveBeenCalledWith('F:/demo/1.jpg');
    });

    rerender(
      <EditorFilmstrip
        images={lazyImages}
        currentIndex={5}
        canGoPrevious={true}
        canGoNext={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    rerender(
      <EditorFilmstrip
        images={lazyImages}
        currentIndex={0}
        canGoPrevious={false}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(generateEditorThumbnail).toHaveBeenCalledTimes(7);
    });
    expect(await screen.findByRole('img', { name: '示例图片_1.jpg 缩略图' })).toHaveAttribute('src', 'data:image/jpeg;base64,retry-thumb');
  });
});
