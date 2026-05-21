export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let i = 0;
  const runners: Promise<void>[] = [];
  for (let k = 0; k < Math.min(limit, items.length); k++) {
    runners.push(
      (async () => {
        while (true) {
          const idx = i++;
          if (idx >= items.length) return;
          await worker(items[idx]!);
        }
      })()
    );
  }
  await Promise.all(runners);
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await runWithConcurrency(items, limit, async (item) => {
    const index = cursor++;
    results[index] = await worker(item, index);
  });
  return results;
}
