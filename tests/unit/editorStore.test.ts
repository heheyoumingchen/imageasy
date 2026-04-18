import { beforeEach, describe, expect, it } from 'vitest';
import { editorSessionFixture } from '../../src/services/editorFixtures';
import { useEditorStore } from '../../src/stores/editorStore';

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('opens image session data into the editor state', () => {
    useEditorStore.getState().openImages(editorSessionFixture);

    const state = useEditorStore.getState();
    expect(state.currentImage?.name).toBe('示例图片_A.jpg');
    expect(state.directoryImages).toHaveLength(3);
    expect(state.currentIndex).toBe(0);
  });

  it('marks unsaved changes and blocks switching until confirmed', () => {
    const store = useEditorStore.getState();
    store.openImages(editorSessionFixture);
    store.updateAdjustment('brightness', 32);
    store.requestSwitch({ index: 1, reason: 'thumbnail' });

    expect(useEditorStore.getState().pendingSwitchTarget?.index).toBe(1);
    expect(useEditorStore.getState().currentImage?.name).toBe('示例图片_A.jpg');

    useEditorStore.getState().confirmSwitch();

    expect(useEditorStore.getState().currentImage?.name).toBe('示例图片_B.png');
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it('copies and pastes adjustments', () => {
    const store = useEditorStore.getState();
    store.openImages(editorSessionFixture);
    store.updateAdjustment('contrast', 24);
    store.copyAdjustments();
    store.markSaved();
    store.updateAdjustment('contrast', -10);
    store.pasteAdjustments();

    expect(useEditorStore.getState().adjustments.contrast).toBe(24);
  });
});
