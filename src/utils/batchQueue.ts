export type BatchQueueControl = {
  cancel: () => void;
  isCancelled: () => boolean;
};

export const createBatchQueueControl = (): BatchQueueControl => {
  let cancelled = false;
  return {
    cancel: () => {
      cancelled = true;
    },
    isCancelled: () => cancelled
  };
};

export const runConcurrentQueue = async <T>(
  items: T[],
  workerCount: number,
  runItem: (item: T) => Promise<void>,
  control?: BatchQueueControl
) => {
  const queue = [...items];
  const count = Math.max(1, Math.min(workerCount, queue.length));
  const workers = Array.from({ length: count }, async () => {
    while (queue.length > 0) {
      if (control?.isCancelled()) {
        queue.length = 0;
        break;
      }

      const item = queue.shift();
      if (item) {
        await runItem(item);
      }
    }
  });

  await Promise.all(workers);
};
