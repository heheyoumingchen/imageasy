import { describe, expect, it } from 'vitest';
import { cropToOverlayRect, getDisplayedImageRect, pointerDeltaToImageDelta } from '../../src/utils/editorCropLayout';

describe('editorCropLayout', () => {
  it('centers a contained image before zoom and pan', () => {
    expect(
      getDisplayedImageRect({
        viewportWidth: 800,
        viewportHeight: 600,
        imageWidth: 1600,
        imageHeight: 800,
        scale: 1,
        offsetX: 0,
        offsetY: 0
      })
    ).toEqual({ left: 0, top: 100, width: 800, height: 400 });
  });

  it('applies zoom and pan to the displayed rect', () => {
    expect(
      getDisplayedImageRect({
        viewportWidth: 800,
        viewportHeight: 600,
        imageWidth: 1600,
        imageHeight: 800,
        scale: 1.5,
        offsetX: 40,
        offsetY: -20
      })
    ).toEqual({ left: -160, top: -20, width: 1200, height: 600 });
  });

  it('maps crop pixels into overlay coordinates on the displayed rect', () => {
    expect(
      cropToOverlayRect(
        { x: 200, y: 100, width: 800, height: 400 },
        { left: -160, top: -20, width: 1200, height: 600 },
        { width: 1600, height: 800 }
      )
    ).toEqual({ left: -10, top: 55, width: 600, height: 300 });
  });

  it('converts pointer deltas back into image pixels', () => {
    expect(
      pointerDeltaToImageDelta({
        displayedRect: { left: -160, top: -20, width: 1200, height: 600 },
        imageWidth: 1600,
        imageHeight: 800,
        deltaX: 150,
        deltaY: 75
      })
    ).toEqual({ x: 200, y: 100 });
  });
});
