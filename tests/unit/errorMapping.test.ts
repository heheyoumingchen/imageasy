import { describe, expect, it } from 'vitest';
import { mapAppError } from '../../src/utils/errorMapping';

describe('errorMapping', () => {
  it('maps known app error codes to user-facing messages', () => {
    expect(mapAppError('NO_SUPPORTED_IMAGES')).toBe('当前目录中没有可浏览的支持图片。');
    expect(mapAppError('SAVE_IMAGE_FAILED')).toBe('保存 JPG 失败，请检查输出目录权限。');
  });

  it('falls back for unknown error codes', () => {
    expect(mapAppError('UNKNOWN_CODE', '发生未知错误。')).toBe('发生未知错误。');
  });
});
