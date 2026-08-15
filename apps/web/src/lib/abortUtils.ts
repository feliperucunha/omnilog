/** Combine timeout and caller abort signals. Caller abort wins for retry decisions. */
export function combineAbortSignals(signals: (AbortSignal | undefined)[]): AbortSignal {
  const list = signals.filter((s): s is AbortSignal => s != null);
  if (list.length === 0) return new AbortController().signal;
  if (list.length === 1) return list[0]!;
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === "function") return anyFn(list);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of list) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
}

export function isAbortError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "name" in err &&
      (err as { name: string }).name === "AbortError"
  );
}

export function isCallerAborted(callerSignal: AbortSignal | undefined, err?: unknown): boolean {
  if (callerSignal?.aborted) return true;
  return isAbortError(err) && callerSignal?.aborted === true;
}
