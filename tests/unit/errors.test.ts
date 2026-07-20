import { describe, expect, it } from 'vitest';
import {
  normalizeConversionError,
  redactDisplayError,
  toDisplayErrorMessage,
  toErrorMessage
} from '../../src/utils/errors';

describe('error display helpers', () => {
  it('redacts windows absolute paths in user-facing messages', () => {
    const message = redactDisplayError(String.raw`无法打开图片: C:\Users\Alice\Photos\secret.jpg`);
    expect(message).not.toContain('Alice');
    expect(message).toContain('[path:secret.jpg]');
  });

  it('keeps ordinary business messages intact', () => {
    expect(toErrorMessage(new Error('不支持的输出格式'))).toBe('不支持的输出格式');
  });

  it('uses fallback when error payload is empty', () => {
    expect(toDisplayErrorMessage(null, '操作失败')).toBe('操作失败');
  });

  it('maps Word renderer unavailable codes to install guidance', () => {
    const error = normalizeConversionError({
      code: 'WORD_RENDERER_NOT_AVAILABLE',
      message: '无法启动 Office helper'
    });
    expect(error.message).toMatch(/Word|WPS/);
    expect(error.message).toContain('PDF');
  });

  it('appends diagnostic detail for document renderer failures', () => {
    const error = normalizeConversionError({
      code: 'DOCUMENT_RENDERER_EXPORT_FAILED',
      message: 'Microsoft Word 和 WPS Office 均未能导出文档',
      diagnostic: 'Word: timeout; WPS: missing export'
    });
    expect(error.message).toContain('均未能导出文档');
    expect(error.message).toContain('Word: timeout');
  });
});
