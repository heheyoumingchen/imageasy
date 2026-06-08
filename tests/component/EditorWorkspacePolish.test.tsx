import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EditorFilmstrip from '../../src/components/image-editor/EditorFilmstrip';
import EditorTopActionBar from '../../src/components/image-editor/EditorTopActionBar';

describe('Editor workspace polish', () => {
  it('renders larger action buttons and six-up thumbnail sizing hooks', () => {
    render(
      <>
        <EditorTopActionBar
          hasUnsavedChanges
          canUndo
          canRedo
          isBusy={false}
          onOpenImage={vi.fn()}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          onSave={vi.fn()}
          onRotateLeft={vi.fn()}
          onRotateRight={vi.fn()}
          onZoom={vi.fn()}
          onCrop={vi.fn()}
        />
        <EditorFilmstrip
          images={Array.from({ length: 6 }, (_, index) => ({
            index,
            name: `image-${index + 1}.jpg`,
            path: `F:/demo/image-${index + 1}.jpg`,
            extension: 'jpg',
            width: 800,
            height: 600,
            sizeBytes: 1024,
            thumbnailDataUrl: 'data:image/png;base64,abc'
          }))}
          currentIndex={0}
          canGoPrevious={false}
          canGoNext
          onPrevious={vi.fn()}
          onNext={vi.fn()}
          onSelect={vi.fn()}
        />
      </>
    );

    expect(screen.getByRole('button', { name: '撤销' }).className).toContain('h-10');
    expect(screen.getByRole('button', { name: '上一张' }).className).toContain('h-10');
    expect(screen.getAllByRole('button', { name: /image-\d\.jpg/ })[0].className).toContain('min-w-[104px]');
    expect(screen.getByTestId('editor-top-action-bar').className).toContain('rounded-lg');
    expect(screen.getByLabelText('底部胶片带').className).toContain('rounded-lg');
    expect(screen.getByRole('button', { name: '导出' }).className).toContain('rounded-lg');
  });
});
