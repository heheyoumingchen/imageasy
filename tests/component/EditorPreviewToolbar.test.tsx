import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EditorPreviewToolbar from '../../src/components/image-editor/EditorPreviewToolbar';

describe('EditorPreviewToolbar', () => {
  it('only keeps rotate crop and zoom controls from the design draft', async () => {
    const user = userEvent.setup();
    const onRotateLeft = vi.fn();
    const onRotateRight = vi.fn();
    const onStartCrop = vi.fn();
    const onZoomChange = vi.fn();

    render(
      <EditorPreviewToolbar
        disabled={false}
        isCropping={false}
        isZoomSliderOpen={false}
        zoomValue={1}
        onRotateLeft={onRotateLeft}
        onRotateRight={onRotateRight}
        onStartCrop={onStartCrop}
        onToggleZoomSlider={vi.fn()}
        onZoomChange={onZoomChange}
      />
    );

    expect(screen.queryByRole('button', { name: '清除裁剪' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '适应窗口' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '100%' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '缩小' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '左转' }));
    await user.click(screen.getByRole('button', { name: '右转' }));
    await user.click(screen.getByRole('button', { name: '裁剪' }));

    expect(onRotateLeft).toHaveBeenCalledTimes(1);
    expect(onRotateRight).toHaveBeenCalledTimes(1);
    expect(onStartCrop).toHaveBeenCalledTimes(1);
  });

  it('expands a bidirectional zoom slider from the zoom button', async () => {
    const user = userEvent.setup();
    const onToggleZoomSlider = vi.fn();
    const onZoomChange = vi.fn();

    const { rerender } = render(
      <EditorPreviewToolbar
        disabled={false}
        isCropping={false}
        isZoomSliderOpen={false}
        zoomValue={1}
        onRotateLeft={vi.fn()}
        onRotateRight={vi.fn()}
        onStartCrop={vi.fn()}
        onToggleZoomSlider={onToggleZoomSlider}
        onZoomChange={onZoomChange}
      />
    );

    await user.click(screen.getByRole('button', { name: '放大' }));
    expect(onToggleZoomSlider).toHaveBeenCalledTimes(1);

    rerender(
      <EditorPreviewToolbar
        disabled={false}
        isCropping={false}
        isZoomSliderOpen={true}
        zoomValue={1.4}
        onRotateLeft={vi.fn()}
        onRotateRight={vi.fn()}
        onStartCrop={vi.fn()}
        onToggleZoomSlider={onToggleZoomSlider}
        onZoomChange={onZoomChange}
      />
    );

    const slider = screen.getByRole('slider', { name: '缩放倍率' });
    expect(slider).toHaveValue('1.4');

    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(onZoomChange).toHaveBeenLastCalledWith(0.8);
  });
});
