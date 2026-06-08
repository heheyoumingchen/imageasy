import { describe, expect, it } from 'vitest';
import { formatFileSize } from '../../src/utils/formatters';

describe('formatFileSize', () => {
  it('formats bytes into KB with one decimal place', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('formats zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
});
