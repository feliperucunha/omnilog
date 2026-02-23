/**
 * In-memory client cache for GET requests. Reduces repeat loads and improves perceived performance.
 * Mutations should call invalidateApiCache() so the next read is fresh.
 */

const cache = new Map<
  string,
  { data: unknown; expiresAt: number }
>();

const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 minutes

function cacheKey(method: string, path: string): string {
  return `${method} ${path}`;
}

export function getCached<T>(method: string, path: string): T | undefined {
  const key = cacheKey(method, path);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function setCached<T>(method: string, path: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const key = cacheKey(method, path);
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/** Invalidate all entries whose key includes the given prefix (e.g. "/logs" or "/items") */
export function invalidateByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.includes(prefix)) cache.delete(key);
  }
}

export function invalidateAll(): void {
  cache.clear();
}
