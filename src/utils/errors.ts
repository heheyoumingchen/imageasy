import type { ConversionCommandError } from '../types/conversion';

// Tauri 命令以对象形式 reject 时，String(error) 会得到 [object Object]；此处识别结构化错误取其 message。
const isConversionCommandError = (value: unknown): value is ConversionCommandError =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { code?: unknown }).code === 'string' &&
  typeof (value as { message?: unknown }).message === 'string';

const WINDOWS_PATH = /[A-Za-z]:[\\/](?:[^\\/:*?"<>|\r\n]+[\\/])*[^\\/:*?"<>|\r\n]*/g;
const UNC_PATH = /\\\\[^\\/:*?"<>|\r\n]+(?:\\[^\\/:*?"<>|\r\n]+)+/g;
const UNIX_PATH = /\/(?:home|Users|tmp|var|private|opt|mnt|media|Volumes)\/[^\s"'(),;\]]+/g;

const fileNameFromPath = (path: string) => {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'file';
};

/** 前端展示前再做一层路径脱敏，避免后端遗漏时把完整路径渲染到 UI。 */
export const redactDisplayError = (message: string) => {
  let out = message.replace(WINDOWS_PATH, (match) => `[path:${fileNameFromPath(match)}]`);
  out = out.replace(UNC_PATH, (match) => `[path:${fileNameFromPath(match)}]`);
  out = out.replace(UNIX_PATH, (match) => `[path:${fileNameFromPath(match)}]`);
  return out;
};

export const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return redactDisplayError(error.message);
  }
  if (isConversionCommandError(error)) {
    return redactDisplayError(error.message);
  }
  return redactDisplayError(String(error));
};

export const toDisplayErrorMessage = (error: unknown, fallback: string) => {
  if (error == null) {
    return fallback;
  }

  if (error instanceof Error && error.message) {
    return redactDisplayError(error.message);
  }

  if (typeof error === 'string' && error.trim()) {
    return redactDisplayError(error);
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}' && serialized !== 'null') {
      return redactDisplayError(serialized);
    }
  } catch {
  }

  return fallback;
};

const conversionCodeMessage = (code: string | undefined, message?: string): string | undefined => {
  switch (code) {
    case 'WORD_RENDERER_NOT_AVAILABLE':
      // 后端 message 可能已含更具体原因；若只是泛化不可用文案则补安装引导。
      if (message && !/需要|安装|未能连接|不可用|无法启动/.test(message)) {
        return message;
      }
      return message && message.includes('未能连接')
        ? message
        : 'DOC/DOCX 转图片未能连接 Microsoft Word 或 WPS Office。请确认已安装且可手动打开文档；PDF 转图片不受影响。';
    case 'WPS_RENDERER_NOT_AVAILABLE':
      return message && message.trim()
        ? message
        : 'WPS 文档转图片需要安装 WPS Office，并允许本应用启动 Office。';
    case 'PDF_RENDERER_NOT_AVAILABLE':
    case 'PDF_RENDERER_BIND_FAILED':
      return 'PDF 渲染组件与捆绑的 pdfium.dll 不匹配或加载失败。请更新应用运行库后重试。';
    case 'DOCUMENT_RENDERER_TIMEOUT':
      return '文档转换超时。请关闭占用该文件的 Word/WPS 窗口后重试。';
    case 'DOCUMENT_PAGE_RANGE_INVALID':
      return '文档页码范围无效，请检查页码设置。';
    default:
      return undefined;
  }
};

// Tauri 命令以对象形式 reject 时（结构化 CommandError），保留 code/message，避免 [object Object]。
export const normalizeConversionError = (error: unknown): Error => {
  if (error instanceof Error) {
    return new Error(redactDisplayError(error.message));
  }

  if (typeof error === 'string') {
    return new Error(redactDisplayError(error));
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === 'string' ? record.message : undefined;
    const code = typeof record.code === 'string' ? record.code : undefined;
    const diagnostic = typeof record.diagnostic === 'string' ? record.diagnostic : undefined;
    const friendly = conversionCodeMessage(code, message);
    const detail = diagnostic ? `（${redactDisplayError(diagnostic)}）` : '';
    const normalized = new Error(redactDisplayError((friendly ?? message ?? code ?? '文档转换失败') + detail));
    // 保留结构化字段，页面可据 code 映射本地化文案。
    Object.assign(normalized, {
      code,
      diagnostic: diagnostic ? redactDisplayError(diagnostic) : undefined,
      stage: typeof record.stage === 'string' ? record.stage : undefined,
      rendererKind: typeof record.rendererKind === 'string' ? record.rendererKind : undefined
    });
    return normalized;
  }

  return new Error(redactDisplayError(String(error)));
};
