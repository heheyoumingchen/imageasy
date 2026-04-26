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

  it('updates filter settings and marks the editor as dirty', () => {
    openDemoImages();

    useEditorStore.getState().updateFilter('warm');
    useEditorStore.getState().updateFilterIntensity(60);

    expect(useEditorStore.getState().adjustments.filterType).toBe('warm');
    expect(useEditorStore.getState().adjustments.filterIntensity).toBe(60);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('resets only filter settings without changing basic adjustments', () => {
    openDemoImages();

    useEditorStore.getState().updateAdjustment('brightness', 20);
    useEditorStore.getState().updateFilter('vintage');
    useEditorStore.getState().updateFilterIntensity(45);
    useEditorStore.getState().resetFilters();

    expect(useEditorStore.getState().adjustments.brightness).toBe(20);
    expect(useEditorStore.getState().adjustments.filterType).toBe('none');
    expect(useEditorStore.getState().adjustments.filterIntensity).toBe(0);
  });

  it('does not expose copy or paste actions in the latest scope', () => {
    const state = useEditorStore.getState() as Record<string, unknown>;

    expect('copyAdjustments' in state).toBe(false);
    expect('pasteAdjustments' in state).toBe(false);
    expect('copiedAdjustments' in state).toBe(false);
  });
});
