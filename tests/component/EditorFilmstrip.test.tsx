import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EditorFilmstrip from '../../src/components/image-editor/EditorFilmstrip';

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
});
