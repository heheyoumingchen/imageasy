import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ImagePreviewCanvas from '../../src/components/image-editor/ImagePreviewCanvas';
import type { AdjustmentParams, EditorImageSummary } from '../../src/types/editor';

const image: EditorImageSummary = {
  path: 'F:/Demo/示例图片_A.jpg',
  name: '示例图片_A.jpg',
  extension: 'jpg',
  width: 1600,
  height: 1200,
  sizeBytes: 123456
};

const adjustments: AdjustmentParams = {
  brightness: 12,
  contrast: 18,
  saturation: 24,
  sharpen: 8,
  clarity: 10,
  quality: 90,
  filterType: 'warm',
  filterIntensity: 40,
  rotation: 0,
  crop: null
};

describe('ImagePreviewCanvas', () => {
  it('shows crop actions when cropping mode is active', () => {
    render(
      <ImagePreviewCanvas
        image={image}
        adjustments={adjustments}
        previewUrl="data:image/jpeg;base64,preview-a"
        isLoading={false}
        error={null}
        scale={1}
        isCropping={true}
        onCroppingChange={vi.fn()}
        onApplyCrop={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '确认裁剪' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消裁剪' })).toBeInTheDocument();
  });

  it('updates the crop rectangle by dragging the box and resizing from the handle', async () => {
    const onApplyCrop = vi.fn();
    const user = userEvent.setup();

    render(
      <ImagePreviewCanvas
        image={image}
        adjustments={adjustments}
        previewUrl="data:image/jpeg;base64,preview-a"
        isLoading={false}
        error={null}
        scale={1}
        isCropping={true}
        onCroppingChange={vi.fn()}
        onApplyCrop={onApplyCrop}
      />
    );

    const cropBox = screen.getByTestId('crop-box');
    await user.pointer([
      { keys: '[MouseLeft>]', target: cropBox, coords: { clientX: 200, clientY: 180 } },
      { target: cropBox, coords: { clientX: 260, clientY: 230 } },
      { keys: '[/MouseLeft]', target: cropBox }
    ]);

    const resizeHandle = screen.getByTestId('crop-resize-se');
    await user.pointer([
      { keys: '[MouseLeft>]', target: resizeHandle, coords: { clientX: 360, clientY: 300 } },
      { target: resizeHandle, coords: { clientX: 430, clientY: 350 } },
      { keys: '[/MouseLeft]', target: resizeHandle }
    ]);

    await user.click(screen.getByRole('button', { name: '确认裁剪' }));

    expect(onApplyCrop).toHaveBeenCalledWith({ x: 300, y: 230, width: 1190, height: 890 });
  });

  it('cancels crop edits without committing draft changes', async () => {
    const onApplyCrop = vi.fn();
    const onCroppingChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ImagePreviewCanvas
        image={image}
        adjustments={{ ...adjustments, crop: { x: 80, y: 60, width: 640, height: 480 } }}
        previewUrl="data:image/jpeg;base64,preview-a"
        isLoading={false}
        error={null}
        scale={1}
        isCropping={true}
        onCroppingChange={onCroppingChange}
        onApplyCrop={onApplyCrop}
      />
    );

    const cropBox = screen.getByTestId('crop-box');
    await user.pointer([
      { keys: '[MouseLeft>]', target: cropBox, coords: { clientX: 180, clientY: 180 } },
      { target: cropBox, coords: { clientX: 240, clientY: 230 } },
      { keys: '[/MouseLeft]', target: cropBox }
    ]);

    await user.click(screen.getByRole('button', { name: '取消裁剪' }));

    expect(onApplyCrop).not.toHaveBeenCalled();
    expect(onCroppingChange).toHaveBeenCalledWith(false);
  });

  it('pans the preview image when scaled above 1', async () => {
    const user = userEvent.setup();

    render(
      <ImagePreviewCanvas
        image={image}
        adjustments={adjustments}
        previewUrl="data:image/jpeg;base64,preview-a"
        isLoading={false}
        error={null}
        scale={1.5}
        isCropping={false}
        onCroppingChange={vi.fn()}
        onApplyCrop={vi.fn()}
      />
    );

    const previewImage = screen.getByRole('img', { name: '示例图片_A.jpg' });
    expect(previewImage).toHaveStyle({ transform: 'translate(0px, 0px) scale(1.5)' });

    await user.pointer([
      { keys: '[MouseLeft>]', target: previewImage, coords: { clientX: 0, clientY: 0 } },
      { target: previewImage, coords: { clientX: 40, clientY: 30 } },
      { keys: '[/MouseLeft]', target: previewImage }
    ]);

    expect(previewImage.style.transform).toMatch(/translate\([^,]+px, [^)]+px\) scale\(1.5\)/);
  });
});
