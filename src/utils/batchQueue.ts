export const runConcurrentQueue = async <T>(
  items: T[],
  workerCount: number,
  runItem: (item: T) => Promise<void>
) => {
  const queue = [...items];
  const count = Math.max(1, Math.min(workerCount, queue.length));
  const workers = Array.from({ length: count }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) {
        await runItem(item);
      }
    }
  });

  await Promise.all(workers);
};
