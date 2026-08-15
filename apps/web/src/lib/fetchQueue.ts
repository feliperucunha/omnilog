export type FetchPriority = "high" | "low";

/** Background/prefetch GETs share a small lane so visible-page requests are not starved. */
const LOW_GET_CONCURRENCY = 2;

let activeLowGets = 0;
const lowWaiters: Array<() => void> = [];

export async function withLowPriorityGetSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireLowGetSlot();
  try {
    return await fn();
  } finally {
    releaseLowGetSlot();
  }
}

function acquireLowGetSlot(): Promise<void> {
  if (activeLowGets < LOW_GET_CONCURRENCY) {
    activeLowGets += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    lowWaiters.push(() => {
      activeLowGets += 1;
      resolve();
    });
  });
}

function releaseLowGetSlot(): void {
  activeLowGets = Math.max(0, activeLowGets - 1);
  const next = lowWaiters.shift();
  if (next) next();
}

export function shouldUseLowPriorityLane(priority: FetchPriority | undefined): boolean {
  return priority === "low";
}
