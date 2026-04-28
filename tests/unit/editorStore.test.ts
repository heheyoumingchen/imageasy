import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../../src/stores/editorStore';

const openDemoImages = () => {
  useEditorStore.getState().openImages({
    currentIndex: 0,
    currentImage: {
      path: 'F:/Demo/a.jpg',
      name: 'a.jpg',
      extension: 'jpg',
      width: 1200,
      height: 800,
      sizeBytes: 123456
    },
    directoryImages: [
      {
        index: 0,
        path: 'F:/Demo/a.jpg',
        name: 'a.jpg',
        extension: 'jpg',
        width: 1200,
        height: 800,
        sizeBytes: 123456,
        thumbnailDataUrl: 'data:image/jpeg;base64,a'
      },
      {
        index: 1,
        path: 'F:/Demo/b.jpg',
        name: 'b.jpg',
        extension: 'jpg',
        width: 1000,
        height: 700,
        sizeBytes: 223456,
        thumbnailDataUrl: 'data:image/jpeg;base64,b'
      }
    ]
  });
};

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('uses 100 as the default intensity for non-none filters', () => {
    openDemoImages();

    useEditorStore.getState().updateFilter('warm');

    expect(useEditorStore.getState().adjustments.filterType).toBe('warm');
    expect(useEditorStore.getState().adjustments.filterIntensity).toBe(100);
  });

  it('updates the basic panel values including sharpen clarity and quality', () => {
    openDemoImages();

    useEditorStore.getState().updateAdjustment('brightness', 20);
    useEditorStore.getState().updateAdjustment('sharpen', 35);
    useEditorStore.getState().updateAdjustment('clarity', 40);
    useEditorStore.getState().updateAdjustment('quality', 75);

    expect(useEditorStore.getState().adjustments).toEqual(
      expect.objectContaining({
        brightness: 20,
        sharpen: 35,
        clarity: 40,
        quality: 75
      })
    );
  });

  it('tracks history for undo and redo across all adjustment changes', () => {
    openDemoImages();

    useEditorStore.getState().updateAdjustment('contrast', 15);
    useEditorStore.getState().updateFilter('cool');
    useEditorStore.getState().rotateRight();

    expect(useEditorStore.getState().past).toHaveLength(3);
    expect(useEditorStore.getState().adjustments.rotation).toBe(90);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().adjustments.rotation).toBe(0);
    expect(useEditorStore.getState().future).toHaveLength(1);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().adjustments.rotation).toBe(90);
  });

  it('applies and clears crop rectangles through the history stack', () => {
    openDemoImages();

    useEditorStore.getState().applyCrop({ x: 20, y: 30, width: 200, height: 160 });
    expect(useEditorStore.getState().adjustments.crop).toEqual({ x: 20, y: 30, width: 200, height: 160 });

    useEditorStore.getState().clearCrop();
    expect(useEditorStore.getState().adjustments.crop).toBeNull();

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().adjustments.crop).toEqual({ x: 20, y: 30, width: 200, height: 160 });
  });

  it('clears history when switching to another image', () => {
    openDemoImages();

    useEditorStore.getState().updateAdjustment('saturation', 12);
    useEditorStore.getState().rotateLeft();
    useEditorStore.getState().goToNext();
    useEditorStore.getState().confirmSwitch();

    expect(useEditorStore.getState().past).toHaveLength(0);
    expect(useEditorStore.getState().future).toHaveLength(0);
    expect(useEditorStore.getState().adjustments.rotation).toBe(0);
  });
});
