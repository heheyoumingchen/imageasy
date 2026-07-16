import { describe, expect, it } from 'vitest';
import { expandPageRange, normalizePageRangeInput } from '../../src/utils/pageRange';

describe('pageRange', () => {
  it('normalizes user input before persistence', () => {
    expect(normalizePageRangeInput(' 1 - 3 , 5 , 8 - 10 ')).toBe('1-3,5,8-10');
  });

  it('expands custom ranges into sorted unique page numbers', () => {
    expect(expandPageRange('1-3,5,8-10', 12)).toEqual([1, 2, 3, 5, 8, 9, 10]);
  });

  it('expands syntax without an upper bound when the page count is unknown', () => {
    expect(expandPageRange('1-3,5')).toEqual([1, 2, 3, 5]);
  });

  it('rejects invalid ranges regardless of the optional upper bound', () => {
    expect(() => expandPageRange('0,2')).toThrow('页码必须从 1 开始');
    expect(() => expandPageRange('3-1')).toThrow('页码范围必须按升序填写');
  });

  it('rejects out-of-bounds ranges only when the page count is known', () => {
    expect(() => expandPageRange('3-1', 12)).toThrow('页码范围必须按升序填写');
    expect(() => expandPageRange('1-3,20', 12)).toThrow('页码超出文档总页数');
    expect(() => expandPageRange('0', 12)).toThrow('页码必须从 1 开始');
    expect(() => expandPageRange('13', 12)).toThrow('页码超出文档总页数');
  });
});
