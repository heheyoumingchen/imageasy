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
  temperature: 0,
  tint: 0,
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

  it('translates crop move and resize deltas from preview pixels back to source-image pixels', async () => {
    const onApplyCrop = vi.fn();
    const user = userEvent.setup();
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 750,
      width: 1000,
      height: 750,
      toJSON: () => ({})
    } as DOMRect);

    render(
      <ImagePreviewCanvas
        image={image}
        adjustments={{
          ...adjustments,
          crop: { x: 200, y: 100, width: 1000, height: 500 }
        }}
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
      { keys: '[MouseLeft>]', target: cropBox, coords: { clientX: 100, clientY: 100 } },
      { target: cropBox, coords: { clientX: 150, clientY: 125 } },
      { keys: '[/MouseLeft]', target: cropBox }
    ]);

    const resizeHandle = screen.getByTestId('crop-resize-se');
    await user.pointer([
      { keys: '[MouseLeft>]', target: resizeHandle, coords: { clientX: 700, clientY: 350 } },
      { target: resizeHandle, coords: { clientX: 750, clientY: 375 } },
      { keys: '[/MouseLeft]', target: resizeHandle }
    ]);

    await user.click(screen.getByRole('button', { name: '确认裁剪' }));

    expect(onApplyCrop).toHaveBeenCalledWith({
      x: 280,
      y: 140,
      width: 1080,
      height: 540
    });

    rectSpy.mockRestore();
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

  it('pans the preview stage content when scaled above 1', async () => {
    const user = userEvent.setup();
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 750,
      width: 1000,
      height: 750,
      toJSON: () => ({})
    } as DOMRect);

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

    const previewImage = screen.getByRole('img', { name: 'preview' });
    const stageContent = screen.getByTestId('preview-stage-content');
    expect(stageContent.style.left).toBe('-250px');
    expect(stageContent.style.top).toBe('-187.5px');

    await user.pointer([
      { keys: '[MouseLeft>]', target: previewImage, coords: { clientX: 0, clientY: 0 } },
      { target: previewImage, coords: { clientX: 40, clientY: 30 } },
      { keys: '[/MouseLeft]', target: previewImage }
    ]);

    expect(stageContent.style.left).toBe('-210px');
    expect(stageContent.style.top).toBe('-157.5px');

    rectSpy.mockRestore();
  });
});
