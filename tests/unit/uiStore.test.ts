import { describe, expect, it } from 'vitest';
import { createUiStore } from '../../src/stores/uiStore';

describe('uiStore', () => {
  it('pushes and removes toasts', () => {
    const store = createUiStore();

    store.getState().pushToast({ id: 'toast-1', message: 'done', tone: 'success' });
    expect(store.getState().toasts).toHaveLength(1);

    store.getState().removeToast('toast-1');
    expect(store.getState().toasts).toEqual([]);
  });

  it('opens and closes confirm state', () => {
    const store = createUiStore();

    store.getState().openConfirm('存在未保存修改', '确认切换吗');
    expect(store.getState().confirm).toEqual({
      open: true,
      title: '存在未保存修改',
      message: '确认切换吗'
    });

    store.getState().closeConfirm();
    expect(store.getState().confirm).toEqual({ open: false, title: '', message: '' });
  });
});
