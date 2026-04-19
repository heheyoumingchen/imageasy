import { createStore } from 'zustand/vanilla';

type ToastItem = {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
};

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
};

type UiState = {
  toasts: ToastItem[];
  confirm: ConfirmState;
  pushToast: (toast: ToastItem) => void;
  removeToast: (id: string) => void;
  openConfirm: (title: string, message: string) => void;
  closeConfirm: () => void;
};

export const createUiStore = () => {
  return createStore<UiState>((set) => ({
    toasts: [],
    confirm: { open: false, title: '', message: '' },
    pushToast: (toast) => set((state) => ({ toasts: [...state.toasts, toast] })),
    removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
    openConfirm: (title, message) => set({ confirm: { open: true, title, message } }),
    closeConfirm: () => set({ confirm: { open: false, title: '', message: '' } })
  }));
};
