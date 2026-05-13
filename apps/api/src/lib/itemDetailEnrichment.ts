import type { PrismaClient } from "@prisma/client";
import type { ItemDetail } from "@geeklogs/shared";
import { getMovieById, getTvById } from "../services/tmdb.js";
import { getAnimeById, getMangaById } from "../services/jikan.js";
import { getGameById } from "../services/rawg.js";
import { getBookById } from "../services/openLibrary.js";
import { getBoardGameById } from "../services/bgg.js";
import { getBoardGameByIdLudopedia } from "../services/ludopedia.js";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const TOMBSTONE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BUDGET_MS = 2500;
const MAX_PARALLEL = 6;

const ENRICHED_MEDIA_TYPES = new Set(["tv", "movies", "anime", "manga", "games", "books", "boardgames"]);

export interface ItemEnrichment {
  apiScore: number | null;
  networks: string[] | null;
  tvStatus: string | null;
  pagesCount: number | null;
  playersMin: number | null;
  playersMax: number | null;
}

const EMPTY: ItemEnrichment = {
  apiScore: null,
  networks: null,
  tvStatus: null,
  pagesCount: null,
  playersMin: null,
  playersMax: null,
};

export type EnrichmentInput = {
  mediaType: string;
  externalId: string;
  boardGameSource?: string | null;
};

function cacheKey(mediaType: string, externalId: string): string {
  return `${mediaType}:${externalId}`;
}

function parseNetworksJson(raw: string | null): string[] | null {
  if (!raw || raw.trim() === "") return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return null;
    const out = arr.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 10);
    return out.length ? out : null;
  } catch {
    return null;
  }
}

type CacheRow = {
  mediaType: string;
  externalId: string;
  score: number | null;
  networks: string | null;
  status: string | null;
  pagesCount: number | null;
  playersMin: number | null;
  playersMax: number | null;
  fetchedAt: Date;
};

async function readCacheRows(
  prisma: PrismaClient,
  pairs: Array<{ mediaType: string; externalId: string }>
) {
  const map = new Map<string, CacheRow>();
  if (pairs.length === 0) return map;
  const rows = await prisma.itemDetailCache.findMany({
    where: {
      OR: pairs.map(({ mediaType, externalId }) => ({ mediaType, externalId })),
    },
    select: {
      mediaType: true,
      externalId: true,
      score: true,
      networks: true,
      status: true,
      pagesCount: true,
      playersMin: true,
      playersMax: true,
      fetchedAt: true,
    },
  });
  for (const r of rows) map.set(cacheKey(r.mediaType, r.externalId), r);
  return map;
}

function rowToEnrichment(row: CacheRow): ItemEnrichment {
  const apiScore = typeof row.score === "number" && Number.isFinite(row.score) ? row.score : null;
  const tvOnly = row.mediaType === "tv";
  return {
    apiScore,
    networks: tvOnly ? parseNetworksJson(row.networks) : null,
    tvStatus: tvOnly && row.status?.trim() ? row.status.trim() : null,
    pagesCount: row.mediaType === "books" && typeof row.pagesCount === "number" && row.pagesCount > 0 ? row.pagesCount : null,
    playersMin: row.mediaType === "boardgames" && typeof row.playersMin === "number" && row.playersMin > 0 ? row.playersMin : null,
    playersMax: row.mediaType === "boardgames" && typeof row.playersMax === "number" && row.playersMax > 0 ? row.playersMax : null,
  };
}

async function fetchItemDetail(
  input: EnrichmentInput,
  apiKey: string | null
): Promise<ItemDetail | null> {
  try {
    if (input.mediaType === "tv") return await getTvById(input.externalId, apiKey);
    if (input.mediaType === "movies") return await getMovieById(input.externalId, apiKey);
    if (input.mediaType === "anime") return await getAnimeById(input.externalId);
    if (input.mediaType === "manga") return await getMangaById(input.externalId);
    if (input.mediaType === "games") return await getGameById(input.externalId, apiKey);
    if (input.mediaType === "books") return await getBookById(input.externalId);
    if (input.mediaType === "boardgames") {
      const source = input.boardGameSource;
      if (source === "ludopedia") {
        return await getBoardGameByIdLudopedia(input.externalId);
      }
      if (source === "bgg" || source == null) {
        return await getBoardGameById(input.externalId);
      }
      return null;
    }
    return null;
  } catch (err) {
    console.warn(
      `[itemDetailEnrichment] fetch threw for ${input.mediaType}:${input.externalId}: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

async function fetchAndUpsertOne(
  prisma: PrismaClient,
  input: EnrichmentInput,
  apiKey: string | null
): Promise<ItemEnrichment | null> {
  const item = await fetchItemDetail(input, apiKey);
  const isTv = input.mediaType === "tv";
  const isBook = input.mediaType === "books";
  const isBoardgame = input.mediaType === "boardgames";
  const score = item != null && typeof item.score === "number" && Number.isFinite(item.score) ? item.score : null;
  const networks = item != null && isTv && item.networks?.length ? item.networks : null;
  const status = item != null && isTv && item.status?.trim() ? item.status.trim() : null;
  const pagesCount = item != null && isBook && typeof item.pagesCount === "number" && item.pagesCount > 0 ? Math.round(item.pagesCount) : null;
  const playersMin = item != null && isBoardgame && typeof item.playersMin === "number" && item.playersMin > 0 ? item.playersMin : null;
  const playersMax = item != null && isBoardgame && typeof item.playersMax === "number" && item.playersMax > 0 ? item.playersMax : null;
  try {
    await prisma.itemDetailCache.upsert({
      where: { mediaType_externalId: { mediaType: input.mediaType, externalId: input.externalId } },
      create: {
        mediaType: input.mediaType,
        externalId: input.externalId,
        score,
        networks: networks ? JSON.stringify(networks) : null,
        status,
        pagesCount,
        playersMin,
        playersMax,
      },
      update: {
        score,
        networks: networks ? JSON.stringify(networks) : null,
        status,
        pagesCount,
        playersMin,
        playersMax,
      },
    });
  } catch {
    void 0;
  }
  return {
    apiScore: score,
    networks,
    tvStatus: status,
    pagesCount,
    playersMin,
    playersMax,
  };
}

function isTombstoneRow(row: CacheRow): boolean {
  return (
    row.score == null &&
    row.networks == null &&
    (row.status == null || row.status.trim() === "") &&
    row.pagesCount == null &&
    row.playersMin == null &&
    row.playersMax == null
  );
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
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

type SerializedLogLike = {
  mediaType: string;
  externalId: string;
  boardGameSource?: string | null;
};

export type WithItemEnrichment<T extends SerializedLogLike> = T & {
  apiScore?: number | null;
  networks?: string[] | null;
  tvStatus?: string | null;
  pagesCount?: number | null;
  playersMin?: number | null;
  playersMax?: number | null;
};

export async function attachItemEnrichment<T extends SerializedLogLike>(
  prisma: PrismaClient,
  logs: T[],
  opts?: { apiKey?: string | null; budgetMs?: number }
): Promise<WithItemEnrichment<T>[]> {
  const enrichable = logs.filter((l) => ENRICHED_MEDIA_TYPES.has(l.mediaType));
  if (enrichable.length === 0) return logs as WithItemEnrichment<T>[];
  const map = await getItemEnrichmentMap(
    prisma,
    enrichable.map((l) => ({
      mediaType: l.mediaType,
      externalId: l.externalId,
      boardGameSource: l.boardGameSource ?? null,
    })),
    opts
  );
  return logs.map((log) => {
    if (!ENRICHED_MEDIA_TYPES.has(log.mediaType)) return log as WithItemEnrichment<T>;
    const e = map.get(cacheKey(log.mediaType, log.externalId)) ?? EMPTY;
    const out: WithItemEnrichment<T> = {
      ...log,
      apiScore: e.apiScore,
    };
    if (log.mediaType === "tv") {
      out.networks = e.networks;
      out.tvStatus = e.tvStatus;
    } else if (log.mediaType === "books") {
      out.pagesCount = e.pagesCount;
    } else if (log.mediaType === "boardgames") {
      out.playersMin = e.playersMin;
      out.playersMax = e.playersMax;
    }
    return out;
  });
}

export async function attachItemEnrichmentSingle<T extends SerializedLogLike>(
  prisma: PrismaClient,
  log: T,
  opts?: { apiKey?: string | null; budgetMs?: number }
): Promise<WithItemEnrichment<T>> {
  const [enriched] = await attachItemEnrichment(prisma, [log], opts);
  return enriched!;
}

export async function getItemEnrichmentMap(
  prisma: PrismaClient,
  pairs: EnrichmentInput[],
  opts?: { apiKey?: string | null; budgetMs?: number }
): Promise<Map<string, ItemEnrichment>> {
  const out = new Map<string, ItemEnrichment>();
  const seen = new Set<string>();
  const unique: EnrichmentInput[] = [];
  for (const p of pairs) {
    if (typeof p.mediaType !== "string" || typeof p.externalId !== "string") continue;
    if (!ENRICHED_MEDIA_TYPES.has(p.mediaType)) continue;
    if (!p.externalId) continue;
    const key = cacheKey(p.mediaType, p.externalId);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ mediaType: p.mediaType, externalId: p.externalId, boardGameSource: p.boardGameSource ?? null });
  }
  if (unique.length === 0) return out;

  const cache = await readCacheRows(prisma, unique);
  const now = Date.now();
  const stale: EnrichmentInput[] = [];
  for (const p of unique) {
    const key = cacheKey(p.mediaType, p.externalId);
    const row = cache.get(key);
    if (row == null) {
      stale.push(p);
      continue;
    }
    out.set(key, rowToEnrichment(row));
    const ageMs = now - row.fetchedAt.getTime();
    const ttl = isTombstoneRow(row) ? TOMBSTONE_STALE_AFTER_MS : STALE_AFTER_MS;
    if (ageMs > ttl) stale.push(p);
  }

  if (stale.length === 0) return out;

  const apiKey = opts?.apiKey ?? null;
  const budgetMs = opts?.budgetMs ?? DEFAULT_BUDGET_MS;
  const work = runWithConcurrency(stale, MAX_PARALLEL, async (p) => {
    const enriched = await fetchAndUpsertOne(prisma, p, apiKey);
    if (enriched != null) out.set(cacheKey(p.mediaType, p.externalId), enriched);
  });

  let timedOut = false;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      timedOut = true;
      resolve();
    }, budgetMs);
    work.finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });

  if (timedOut) {
    work.catch(() => {});
  }

  return out;
}
