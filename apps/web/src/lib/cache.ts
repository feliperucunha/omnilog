/**
 * In-memory client cache for GET requests. Supports stale-while-revalidate reads.
 */

const cache = new Map<string, { data: unknown; expiresAt: number; storedAt: number }>();

export const DEFAULT_TTL_MS = 2 * 60 * 1000;
export const HEAVY_PAGE_TTL_MS = 30 * 60 * 1000;

function cacheKey(method: string, path: string): string {
  return `${method} ${path}`;
}

export function getCached<T>(method: string, path: string): T | undefined {
  const entry = getCachedEntry<T>(method, path);
  if (!entry || entry.isStale) return undefined;
  return entry.data;
}

export function getCachedEntry<T>(
  method: string,
  path: string
): { data: T; isStale: boolean; storedAt: number } | undefined {
  const key = cacheKey(method, path);
  const entry = cache.get(key);
  if (!entry) return undefined;
  const isStale = Date.now() > entry.expiresAt;
  return { data: entry.data as T, isStale, storedAt: entry.storedAt };
}

export function setCached<T>(
  method: string,
  path: string,
  data: T,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  const key = cacheKey(method, path);
  const now = Date.now();
  cache.set(key, {
    data,
    expiresAt: now + ttlMs,
    storedAt: now,
  });
}

export function invalidateByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.includes(prefix)) cache.delete(key);
  }
}

/** Keep entries for instant UI; readers using getCachedEntry still see data while SWR revalidates. */
export function markStaleByPrefix(prefix: string): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (key.includes(prefix)) {
      cache.set(key, { ...entry, expiresAt: now - 1 });
    }
  }
}

export function invalidateAll(): void {
  cache.clear();
}

export function updateCachedEntriesMatching(
  keyIncludes: string,
  updater: (data: unknown, cacheKey: string) => unknown | undefined,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (!key.includes(keyIncludes)) continue;
    const next = updater(entry.data, key);
    if (next === undefined) continue;
    cache.set(key, {
      data: next,
      expiresAt: now + ttlMs,
      storedAt: entry.storedAt,
    });
  }
}
