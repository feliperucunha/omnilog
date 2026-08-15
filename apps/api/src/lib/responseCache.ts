import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { ItemDetail } from "@geeklogs/shared";

function isMissingCacheTableError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P2021" || err.code === "P2010";
  }
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("SearchResponseCache") || msg.includes("ItemPayloadCache");
}

export const SEARCH_CACHE_FRESH_MS = 30 * 60 * 1000;
export const SEARCH_CACHE_STALE_MS = 60 * 60 * 1000;
export const ITEM_PAYLOAD_CACHE_FRESH_MS = 24 * 60 * 60 * 1000;
export const ITEM_PAYLOAD_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeSearchQueryKey(
  q: string,
  sort?: string,
  boardProvider?: string,
  titleLanguage?: string
): string {
  return JSON.stringify({
    q: q.trim().toLowerCase(),
    sort: sort ?? "",
    board: boardProvider ?? "",
    titleLang: titleLanguage ?? "",
  });
}

export type CachedPayload<T> = {
  data: T;
  fetchedAt: Date;
  fresh: boolean;
  stale: boolean;
};

function cacheAgeMs(fetchedAt: Date): number {
  return Date.now() - fetchedAt.getTime();
}

export async function getSearchResponseCached<T>(
  prisma: PrismaClient,
  mediaType: string,
  queryKey: string
): Promise<CachedPayload<T> | null> {
  try {
    const row = await prisma.searchResponseCache.findUnique({
      where: { mediaType_queryKey: { mediaType, queryKey } },
    });
    if (!row) return null;
    const age = cacheAgeMs(row.fetchedAt);
    return {
      data: row.payload as T,
      fetchedAt: row.fetchedAt,
      fresh: age <= SEARCH_CACHE_FRESH_MS,
      stale: age > SEARCH_CACHE_FRESH_MS && age <= SEARCH_CACHE_STALE_MS,
    };
  } catch (err) {
    if (isMissingCacheTableError(err)) return null;
    throw err;
  }
}

export async function setSearchResponseCached(
  prisma: PrismaClient,
  mediaType: string,
  queryKey: string,
  payload: unknown
): Promise<void> {
  try {
    await prisma.searchResponseCache.upsert({
      where: { mediaType_queryKey: { mediaType, queryKey } },
      create: { mediaType, queryKey, payload: payload as object },
      update: { payload: payload as object },
    });
  } catch (err) {
    if (isMissingCacheTableError(err)) return;
    throw err;
  }
}

export async function withSearchResultsCache<T extends { results: unknown[] }>(
  prisma: PrismaClient,
  mediaType: string,
  queryKey: string,
  fetch: () => Promise<T>
): Promise<{ data: T; cacheHit: boolean }> {
  return withCachedSearchPayload(prisma, mediaType, queryKey, fetch);
}

export async function withCachedSearchPayload<T>(
  prisma: PrismaClient,
  mediaType: string,
  queryKey: string,
  fetch: () => Promise<T>
): Promise<{ data: T; cacheHit: boolean }> {
  try {
    const cached = await getSearchResponseCached<T>(prisma, mediaType, queryKey);
    if (cached && (cached.fresh || cached.stale)) {
      if (cached.stale) {
        scheduleSearchCacheRefresh(prisma, mediaType, queryKey, fetch);
      }
      return { data: cached.data, cacheHit: true };
    }
    const data = await fetch();
    await setSearchResponseCached(prisma, mediaType, queryKey, data);
    return { data, cacheHit: false };
  } catch (err) {
    if (isMissingCacheTableError(err)) {
      const data = await fetch();
      return { data, cacheHit: false };
    }
    throw err;
  }
}

export function scheduleSearchCacheRefresh(
  prisma: PrismaClient,
  mediaType: string,
  queryKey: string,
  refresh: () => Promise<unknown>
): void {
  setImmediate(() => {
    void refresh()
      .then((payload) => setSearchResponseCached(prisma, mediaType, queryKey, payload))
      .catch((err) => console.error("search cache refresh failed:", err));
  });
}

export async function getItemPayloadCached(
  prisma: PrismaClient,
  mediaType: string,
  externalId: string
): Promise<CachedPayload<ItemDetail> | null> {
  try {
    const row = await prisma.itemPayloadCache.findUnique({
      where: { mediaType_externalId: { mediaType, externalId } },
    });
    if (!row) return null;
    const age = cacheAgeMs(row.fetchedAt);
    return {
      data: row.payload as unknown as ItemDetail,
      fetchedAt: row.fetchedAt,
      fresh: age <= ITEM_PAYLOAD_CACHE_FRESH_MS,
      stale: age > ITEM_PAYLOAD_CACHE_FRESH_MS && age <= ITEM_PAYLOAD_CACHE_STALE_MS,
    };
  } catch (err) {
    if (isMissingCacheTableError(err)) return null;
    throw err;
  }
}

export async function setItemPayloadCached(
  prisma: PrismaClient,
  mediaType: string,
  externalId: string,
  payload: ItemDetail
): Promise<void> {
  try {
    await prisma.itemPayloadCache.upsert({
      where: { mediaType_externalId: { mediaType, externalId } },
      create: { mediaType, externalId, payload: payload as object },
      update: { payload: payload as object },
    });
  } catch (err) {
    if (isMissingCacheTableError(err)) return;
    throw err;
  }
}

export function scheduleItemPayloadCacheRefresh(
  prisma: PrismaClient,
  mediaType: string,
  externalId: string,
  refresh: () => Promise<ItemDetail | null>
): void {
  setImmediate(() => {
    void refresh()
      .then(async (item) => {
        if (item) await setItemPayloadCached(prisma, mediaType, externalId, item);
      })
      .catch((err) => console.error("item payload cache refresh failed:", err));
  });
}
