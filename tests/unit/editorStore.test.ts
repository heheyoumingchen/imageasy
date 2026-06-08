import { beforeEach, describe, expect, it } from 'vitest';
import type { CommitCropRequest, CommitCropResult } from '../../src/types/editor';
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

const commitCropRequestContract = {
  sourcePath: 'F:/Demo/a__working.jpg',
  rotation: 90,
  crop: { x: 10, y: 20, width: 300, height: 200 }
} satisfies CommitCropRequest;

const commitCropResultContract = {
  workingImage: {
    path: 'F:/Demo/a__crop_result.jpg',
    name: 'a__crop_result.jpg',
    extension: 'jpg',
    width: 300,
    height: 200,
    sizeBytes: 45678
  }
} satisfies CommitCropResult;

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('sets originalImage alongside currentImage when opening images', () => {
    openDemoImages();

    expect(useEditorStore.getState().originalImage).toEqual({
      path: 'F:/Demo/a.jpg',
      name: 'a.jpg',
      extension: 'jpg',
      width: 1200,
      height: 800,
      sizeBytes: 123456
    });
    expect(useEditorStore.getState().currentImage).toEqual(useEditorStore.getState().originalImage);
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

  it('commits a destructive crop with a new working canvas and preserves the original path', () => {
    openDemoImages();
    useEditorStore.getState().updateAdjustment('brightness', 18);
    useEditorStore.getState().applyCrop({ x: 40, y: 50, width: 500, height: 320 });

    useEditorStore.getState().commitDestructiveCrop({
      workingImage: {
        path: 'F:/Demo/a__crop_1.jpg',
        name: 'a__crop_1.jpg',
        extension: 'jpg',
        width: 500,
        height: 320,
        sizeBytes: 65432
      },
      preservedAdjustments: {
        ...useEditorStore.getState().adjustments,
        crop: null
      }
    });

    expect(useEditorStore.getState().currentImage).toEqual({
      path: 'F:/Demo/a__crop_1.jpg',
      name: 'a__crop_1.jpg',
      extension: 'jpg',
      width: 500,
      height: 320,
      sizeBytes: 65432
    });
    expect(useEditorStore.getState().originalImage).toEqual({
      path: 'F:/Demo/a.jpg',
      name: 'a.jpg',
      extension: 'jpg',
      width: 1200,
      height: 800,
      sizeBytes: 123456
    });
    expect(useEditorStore.getState().adjustments).toEqual(
      expect.objectContaining({
        brightness: 18,
        crop: null
      })
    );
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('undoes and redoes a destructive crop by restoring full working-image snapshots', () => {
    openDemoImages();
    useEditorStore.getState().updateAdjustment('contrast', 22);
    useEditorStore.getState().applyCrop({ x: 12, y: 16, width: 600, height: 400 });

    useEditorStore.getState().commitDestructiveCrop({
      workingImage: {
        path: 'F:/Demo/a__crop_2.jpg',
        name: 'a__crop_2.jpg',
        extension: 'jpg',
        width: 600,
        height: 400,
        sizeBytes: 77777
      },
      preservedAdjustments: {
        ...useEditorStore.getState().adjustments,
        crop: null
      }
    });

    expect(useEditorStore.getState().currentImage?.path).toBe('F:/Demo/a__crop_2.jpg');

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().currentImage?.path).toBe('F:/Demo/a.jpg');
    expect(useEditorStore.getState().adjustments.crop).toEqual({ x: 12, y: 16, width: 600, height: 400 });

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().currentImage?.path).toBe('F:/Demo/a__crop_2.jpg');
    expect(useEditorStore.getState().adjustments.crop).toBeNull();
    expect(useEditorStore.getState().adjustments.contrast).toBe(22);
  });

  it('normalizes rotation and crop when committing a destructive crop', () => {
    openDemoImages();
    useEditorStore.getState().rotateRight();
    useEditorStore.getState().applyCrop({ x: 24, y: 18, width: 480, height: 320 });
    useEditorStore.getState().updateAdjustment('brightness', 12);

    useEditorStore.getState().commitDestructiveCrop({
      workingImage: {
        path: 'F:/Demo/a__crop_3.jpg',
        name: 'a__crop_3.jpg',
        extension: 'jpg',
        width: 480,
        height: 320,
        sizeBytes: 71234
      },
      preservedAdjustments: {
        ...useEditorStore.getState().adjustments
      }
    });

    expect(useEditorStore.getState().adjustments).toEqual(
      expect.objectContaining({
        rotation: 0,
        crop: null,
        brightness: 12
      })
    );

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().adjustments).toEqual(
      expect.objectContaining({
        rotation: 90,
        crop: { x: 24, y: 18, width: 480, height: 320 },
        brightness: 12
      })
    );

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().adjustments).toEqual(
      expect.objectContaining({
        rotation: 0,
        crop: null,
        brightness: 12
      })
    );
  });

  it('tracks dirty state correctly across undo and redo around a save checkpoint', () => {
    openDemoImages();

    useEditorStore.getState().updateAdjustment('contrast', 15);
    useEditorStore.getState().markSaved();
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);

    useEditorStore.getState().updateAdjustment('brightness', 25);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().adjustments).toEqual(expect.objectContaining({ contrast: 15, brightness: 0 }));
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().adjustments).toEqual(expect.objectContaining({ contrast: 0, brightness: 0 }));
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().adjustments).toEqual(expect.objectContaining({ contrast: 15, brightness: 0 }));
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().adjustments).toEqual(expect.objectContaining({ contrast: 15, brightness: 25 }));
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
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
