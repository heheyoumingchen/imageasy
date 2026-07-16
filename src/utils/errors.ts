import type { ConversionCommandError } from '../types/conversion';

// Tauri 命令以对象形式 reject 时，String(error) 会得到 [object Object]；此处识别结构化错误取其 message。
const isConversionCommandError = (value: unknown): value is ConversionCommandError =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { code?: unknown }).code === 'string' &&
  typeof (value as { message?: unknown }).message === 'string';

export const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (isConversionCommandError(error)) {
    return error.message;
  }
  return String(error);
};

export const toDisplayErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}') {
      return serialized;
    }
  } catch {
  }

  return fallback;
};

// Tauri 命令以对象形式 reject 时（结构化 CommandError），保留 code/message，避免 [object Object]。
export const normalizeConversionError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === 'string' ? record.message : undefined;
    const code = typeof record.code === 'string' ? record.code : undefined;
    const normalized = new Error(message ?? code ?? '文档转换失败');
    // 保留结构化字段，页面可据 code 映射本地化文案。
    Object.assign(normalized, {
      code,
      diagnostic: typeof record.diagnostic === 'string' ? record.diagnostic : undefined,
      stage: typeof record.stage === 'string' ? record.stage : undefined,
      rendererKind: typeof record.rendererKind === 'string' ? record.rendererKind : undefined
    });
    return normalized;
  }

  return new Error(String(error));
};
