import { describe, expect, it, vi } from 'vitest';
import { createBatchQueueControl, runConcurrentQueue } from '../../src/utils/batchQueue';

describe('batchQueue', () => {
  it('runs all items when not cancelled', async () => {
    const seen: number[] = [];
    await runConcurrentQueue([1, 2, 3], 2, async (item) => {
      seen.push(item);
    });
    expect(seen.sort()).toEqual([1, 2, 3]);
  });

  it('stops dequeuing remaining items after cancel', async () => {
    const control = createBatchQueueControl();
    const started: number[] = [];
    const releaseFirst = vi.fn();

    let resolveFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    const runPromise = runConcurrentQueue(
      [1, 2, 3, 4],
      1,
      async (item) => {
        started.push(item);
        if (item === 1) {
          releaseFirst();
          await firstGate;
        }
      },
      control
    );

    await vi.waitFor(() => expect(started).toEqual([1]));
    control.cancel();
    resolveFirst?.();
    await runPromise;

    expect(started).toEqual([1]);
    expect(control.isCancelled()).toBe(true);
  });
});
