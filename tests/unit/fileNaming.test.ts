import { describe, expect, it } from 'vitest';
import { buildNextJpgName } from '../../src/utils/fileNaming';

describe('fileNaming', () => {
  it('builds incremented jpg name with date stamp', () => {
    expect(
      buildNextJpgName('demo.png', '20260413', ['demo_20260413_001.jpg', 'demo_20260413_002.jpg'])
    ).toBe('demo_20260413_003.jpg');
  });
});
