import { invoke } from '@tauri-apps/api/core';

export const createBatchTaskId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const registerBatchTask = async (taskId: string) => {
  await invoke('register_batch_task', { taskId });
};

export const cancelBatchTask = async (taskId: string) => {
  await invoke<boolean>('cancel_batch_task', { taskId });
};

export const completeBatchTask = async (taskId: string) => {
  await invoke('complete_batch_task', { taskId });
};

export const isCancelledError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
  return message.includes('任务已取消');
};
