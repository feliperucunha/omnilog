import { Router } from "express";
import { z } from "zod";
import { MEDIA_TYPES, SEARCH_SORT_OPTIONS } from "@dogument/shared";
import type { MediaType, SearchResult } from "@dogument/shared";
import { prisma } from "../lib/prisma.js";
import { sanitizeText, SEARCH_QUERY_MAX_LENGTH } from "../lib/sanitize.js";
import { optionalAuthMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { API_KEY_META } from "../lib/apiKeyMeta.js";
import {
  searchMovies,
  searchTv,
  getMovieRecommendationsMerged,
  getTvRecommendationsMerged,
  getPopularMovies,
  getPopularTv,
} from "../services/tmdb.js";
import {
  searchGames,
  getGamesRecommendationsFromSeedsViaGenres,
  getPopularGames,
} from "../services/rawg.js";
import { searchBooks } from "../services/openLibrary.js";
import { searchAnime, searchManga, getAnimeRecommendationsForId, getTopAnimePopular } from "../services/jikan.js";
import { searchBoardGames } from "../services/bgg.js";
import { searchBoardGamesLudopedia } from "../services/ludopedia.js";
import { searchComics } from "../services/comicvine.js";
import { InvalidApiKeyError } from "../lib/InvalidApiKeyError.js";
import { collectFromSeeds, topUpFromPopular } from "../lib/searchRecommendationsMerge.js";

export const searchRouter = Router();
searchRouter.use(optionalAuthMiddleware);

/** Free searches per category when user has no API key. Key: userId|ip + type (+ boardProvider for boardgames). */
const FREE_SEARCH_LIMIT_PER_CATEGORY = 10;
const freeSearchCounts = new Map<string, number>();

function getFreeSearchKey(req: { user?: { userId: string }; ip?: string }, type: string, boardProvider: string): string {
  const id = req.user?.userId ?? req.ip ?? "anon";
  const suffix = type === "boardgames" ? `-${boardProvider}` : "";
  return `${id}-${type}${suffix}`;
}

/** Client may send X-Free-Search-Used (from localStorage) so usage persists across server restarts. */
function getClientUsedFromRequest(req: { headers: Record<string, string | string[] | undefined> }): number | undefined {
  const raw = req.headers["x-free-search-used"];
  const s = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (s == null) return undefined;
  const n = parseInt(s, 10);
  if (Number.isNaN(n) || n < 0) return undefined;
  return Math.min(n, FREE_SEARCH_LIMIT_PER_CATEGORY);
}

function getFreeSearchUsage(key: string, clientUsed?: number): { used: number; limit: number } {
  const serverUsed = freeSearchCounts.get(key) ?? 0;
  const used = Math.max(serverUsed, clientUsed ?? 0);
  return { used, limit: FREE_SEARCH_LIMIT_PER_CATEGORY };
}

function incrementFreeSearch(key: string, clientUsed?: number): number {
  const serverUsed = freeSearchCounts.get(key) ?? 0;
  const used = Math.max(serverUsed, clientUsed ?? 0);
  const next = used + 1;
  freeSearchCounts.set(key, next);
  return next;
}

const querySchema = z.object({
  type: z.enum(MEDIA_TYPES as unknown as [string, ...string[]]),
  q: z.string().min(1),
  sort: z.string().optional(),
  boardGameProvider: z.enum(["bgg", "ludopedia"]).optional(),
});

async function getUserKeys(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tmdbApiKey: true,
      rawgApiKey: true,
      bggApiToken: true,
      ludopediaApiToken: true,
      comicVineApiKey: true,
      boardGameProvider: true,
    },
  });
  return user ?? undefined;
}

const RECOMMENDATIONS_MAX = 16;
const RECOMMENDATION_SEEDS_MAX = 4;

async function getLoggedExternalIds(userId: string, mediaType: string): Promise<Set<string>> {
  const rows = await prisma.log.findMany({
    where: { userId, mediaType },
    select: { externalId: true },
    distinct: ["externalId"],
  });
  return new Set(rows.map((r) => r.externalId));
}

async function getRecentSeedIds(userId: string, mediaType: string, maxSeeds: number): Promise<string[]> {
  const recent = await prisma.log.findMany({
    where: { userId, mediaType },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: { externalId: true },
  });
  const seen = new Set<string>();
  const seeds: string[] = [];
  for (const r of recent) {
    if (seen.has(r.externalId)) continue;
    seen.add(r.externalId);
    seeds.push(r.externalId);
    if (seeds.length >= maxSeeds) break;
  }
  return seeds;
}

const recommendationsQuerySchema = z.object({
  type: z.enum(MEDIA_TYPES as unknown as [string, ...string[]]),
});

/**
 * Personalized or popular picks for the Search empty state. Does not consume free-search quota.
 * Query: type (media). Optional auth: seeds from recent logs when logged in.
 */
searchRouter.get("/recommendations", async (req: AuthenticatedRequest, res) => {
  const parsed = recommendationsQuerySchema.safeParse({ type: req.query.type });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid type" });
    return;
  }
  const type = parsed.data.type as MediaType;
  const keys = req.user ? await getUserKeys(req.user.userId) : undefined;
  const tmdbMeta = API_KEY_META.tmdb;
  const rawgMeta = API_KEY_META.rawg;

  const unsupported: MediaType[] = ["books", "manga", "boardgames", "comics"];
  if ((unsupported as string[]).includes(type)) {
    res.json({ results: [], personalization: "none" as const });
    return;
  }

  try {
    switch (type) {
      case "movies": {
        const userKey = keys?.tmdbApiKey ?? null;
        const hasKey = !!(userKey ?? process.env.TMDB_API_KEY);
        if (!hasKey) {
          res.json({
            results: [],
            personalization: "none" as const,
            requiresApiKey: "tmdb" as const,
            link: tmdbMeta.link,
            tutorial: tmdbMeta.tutorial,
          });
          return;
        }
        const exclude = req.user ? await getLoggedExternalIds(req.user.userId, "movies") : new Set<string>();
        const seeds = req.user ? await getRecentSeedIds(req.user.userId, "movies", RECOMMENDATION_SEEDS_MAX) : [];
        let fromLogs = false;
        let results =
          seeds.length > 0
            ? await collectFromSeeds(
                seeds,
                (id) => getMovieRecommendationsMerged(id, userKey, 20),
                exclude,
                RECOMMENDATIONS_MAX
              )
            : [];
        if (results.length > 0) fromLogs = true;
        results = await topUpFromPopular(
          results,
          () => getPopularMovies(userKey, RECOMMENDATIONS_MAX),
          exclude,
          RECOMMENDATIONS_MAX
        );
        res.json({
          results,
          personalization: fromLogs ? ("from_logs" as const) : ("popular" as const),
        });
        return;
      }
      case "tv": {
        const userKey = keys?.tmdbApiKey ?? null;
        const hasKey = !!(userKey ?? process.env.TMDB_API_KEY);
        if (!hasKey) {
          res.json({
            results: [],
            personalization: "none" as const,
            requiresApiKey: "tmdb" as const,
            link: tmdbMeta.link,
            tutorial: tmdbMeta.tutorial,
          });
          return;
        }
        const exclude = req.user ? await getLoggedExternalIds(req.user.userId, "tv") : new Set<string>();
        const seeds = req.user ? await getRecentSeedIds(req.user.userId, "tv", RECOMMENDATION_SEEDS_MAX) : [];
        let fromLogs = false;
        let results =
          seeds.length > 0
            ? await collectFromSeeds(
                seeds,
                (id) => getTvRecommendationsMerged(id, userKey, 20),
                exclude,
                RECOMMENDATIONS_MAX
              )
            : [];
        if (results.length > 0) fromLogs = true;
        results = await topUpFromPopular(
          results,
          () => getPopularTv(userKey, RECOMMENDATIONS_MAX),
          exclude,
          RECOMMENDATIONS_MAX
        );
        res.json({
          results,
          personalization: fromLogs ? ("from_logs" as const) : ("popular" as const),
        });
        return;
      }
      case "games": {
        const userKey = keys?.rawgApiKey ?? null;
        const hasKey = !!(userKey ?? process.env.RAWG_API_KEY);
        if (!hasKey) {
          res.json({
            results: [],
            personalization: "none" as const,
            requiresApiKey: "rawg" as const,
            link: rawgMeta.link,
            tutorial: rawgMeta.tutorial,
          });
          return;
        }
        const exclude = req.user ? await getLoggedExternalIds(req.user.userId, "games") : new Set<string>();
        const seeds = req.user ? await getRecentSeedIds(req.user.userId, "games", RECOMMENDATION_SEEDS_MAX) : [];
        let fromLogs = false;
        let results =
          seeds.length > 0
            ? await getGamesRecommendationsFromSeedsViaGenres(
                seeds,
                exclude,
                RECOMMENDATIONS_MAX,
                userKey,
                RECOMMENDATION_SEEDS_MAX
              )
            : [];
        if (results.length > 0) fromLogs = true;
        results = await topUpFromPopular(
          results,
          () => getPopularGames(userKey, RECOMMENDATIONS_MAX),
          exclude,
          RECOMMENDATIONS_MAX
        );
        res.json({
          results,
          personalization: fromLogs ? ("from_logs" as const) : ("popular" as const),
        });
        return;
      }
      case "anime": {
        const exclude = req.user ? await getLoggedExternalIds(req.user.userId, "anime") : new Set<string>();
        const seeds = req.user ? await getRecentSeedIds(req.user.userId, "anime", RECOMMENDATION_SEEDS_MAX) : [];
        let fromLogs = false;
        let results =
          seeds.length > 0
            ? await collectFromSeeds(
                seeds,
                (id) => getAnimeRecommendationsForId(id, 20),
                exclude,
                RECOMMENDATIONS_MAX
              )
            : [];
        if (results.length > 0) fromLogs = true;
        results = await topUpFromPopular(
          results,
          () => getTopAnimePopular(RECOMMENDATIONS_MAX),
          exclude,
          RECOMMENDATIONS_MAX
        );
        res.json({
          results,
          personalization: fromLogs ? ("from_logs" as const) : ("popular" as const),
        });
        return;
      }
      default: {
        res.json({ results: [], personalization: "none" as const });
        return;
      }
    }
  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      const userHadKey =
        err.provider === "tmdb"
          ? !!keys?.tmdbApiKey
          : err.provider === "rawg"
            ? !!keys?.rawgApiKey
            : false;
      if (userHadKey) {
        res.status(400).json({
          error: "Invalid API key",
          code: "INVALID_API_KEY",
          provider: err.provider,
        });
        return;
      }
    }
    console.error("Recommendations error:", err);
    res.status(502).json({ error: "Recommendations failed" });
  }
});

searchRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const parsed = querySchema.safeParse({
    type: req.query.type,
    q: req.query.q,
    sort: req.query.sort,
    boardGameProvider: req.query.boardGameProvider,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid type or q" });
    return;
  }
  const { type, q: rawQ, sort: rawSort, boardGameProvider: queryBoardProvider } = parsed.data;
  const q = sanitizeText(rawQ, SEARCH_QUERY_MAX_LENGTH);
  if (!q) {
    res.status(400).json({ error: "Invalid or empty search query" });
    return;
  }
  const allowedSorts = SEARCH_SORT_OPTIONS[type as MediaType].map((o) => o.value);
  const sort = rawSort && allowedSorts.includes(rawSort) ? rawSort : undefined;
  const clientUsed = getClientUsedFromRequest(req);
  const keys = req.user ? await getUserKeys(req.user.userId) : undefined;
  const boardProvider =
    (type as string) === "boardgames"
      ? queryBoardProvider ?? (keys?.boardGameProvider === "ludopedia" ? "ludopedia" : "bgg")
      : "bgg";
  const tmdbMeta = API_KEY_META.tmdb;
  const rawgMeta = API_KEY_META.rawg;
  const bggMeta = API_KEY_META.bgg;
  const comicvineMeta = API_KEY_META.comicvine;
  const ludopediaMeta = API_KEY_META.ludopedia;
  const addPromptIfUserHasNoKey = (
    out: { results: unknown[] },
    provider: "tmdb" | "rawg" | "bgg" | "ludopedia" | "comicvine",
    userHasKey: boolean,
    freeSearchUsed?: number,
    freeSearchLimit?: number,
    freeSearchLimitReached?: boolean
  ) => {
    const freeSearchFields = {
      ...(freeSearchUsed != null && { freeSearchUsed }),
      ...(freeSearchLimit != null && { freeSearchLimit }),
      ...(freeSearchLimitReached && { freeSearchLimitReached: true }),
    };
    const shouldAddPrompt = (req.user && !userHasKey) || freeSearchLimitReached;
    if (shouldAddPrompt) {
      const meta =
        provider === "tmdb"
          ? tmdbMeta
          : provider === "rawg"
            ? rawgMeta
            : provider === "bgg"
              ? bggMeta
              : provider === "ludopedia"
                ? ludopediaMeta
                : comicvineMeta;
      return {
        ...out,
        requiresApiKey: provider,
        link: meta.link,
        tutorial: meta.tutorial,
        ...freeSearchFields,
      };
    }
    return Object.keys(freeSearchFields).length > 0 ? { ...out, ...freeSearchFields } : out;
  };

  try {
    switch (type as MediaType) {
      case "movies": {
        const userHasKey = !!keys?.tmdbApiKey;
        if (!userHasKey) {
          const key = getFreeSearchKey(req, type, boardProvider);
          const { used } = getFreeSearchUsage(key, clientUsed);
          if (used >= FREE_SEARCH_LIMIT_PER_CATEGORY) {
            return res.json(
              addPromptIfUserHasNoKey(
                { results: [] },
                "tmdb",
                false,
                FREE_SEARCH_LIMIT_PER_CATEGORY,
                FREE_SEARCH_LIMIT_PER_CATEGORY,
                true
              )
            );
          }
          incrementFreeSearch(key, clientUsed);
        }
        const out = await searchMovies(q, keys?.tmdbApiKey, { link: tmdbMeta.link, tutorial: tmdbMeta.tutorial }, sort);
        const key = !keys?.tmdbApiKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
        return res.json(
          addPromptIfUserHasNoKey(
            out,
            "tmdb",
            !!keys?.tmdbApiKey,
            usage?.used,
            usage?.limit,
            usage ? usage.used >= FREE_SEARCH_LIMIT_PER_CATEGORY : false
          )
        );
      }
      case "tv": {
        const userHasKey = !!keys?.tmdbApiKey;
        if (!userHasKey) {
          const key = getFreeSearchKey(req, type, boardProvider);
          const { used } = getFreeSearchUsage(key, clientUsed);
          if (used >= FREE_SEARCH_LIMIT_PER_CATEGORY) {
            return res.json(
              addPromptIfUserHasNoKey(
                { results: [] },
                "tmdb",
                false,
                FREE_SEARCH_LIMIT_PER_CATEGORY,
                FREE_SEARCH_LIMIT_PER_CATEGORY,
                true
              )
            );
          }
          incrementFreeSearch(key, clientUsed);
        }
        const out = await searchTv(q, keys?.tmdbApiKey, { link: tmdbMeta.link, tutorial: tmdbMeta.tutorial }, sort);
        const key = !keys?.tmdbApiKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
        return res.json(
          addPromptIfUserHasNoKey(
            out,
            "tmdb",
            !!keys?.tmdbApiKey,
            usage?.used,
            usage?.limit,
            usage ? usage.used >= FREE_SEARCH_LIMIT_PER_CATEGORY : false
          )
        );
      }
      case "boardgames": {
        const provider = boardProvider === "ludopedia" ? "ludopedia" : "bgg";
        const userHasKey = boardProvider === "ludopedia" ? !!keys?.ludopediaApiToken : !!keys?.bggApiToken;
        if (!userHasKey) {
          const key = getFreeSearchKey(req, type, boardProvider);
          const { used } = getFreeSearchUsage(key, clientUsed);
          if (used >= FREE_SEARCH_LIMIT_PER_CATEGORY) {
            const meta = provider === "ludopedia" ? ludopediaMeta : bggMeta;
            return res.json({
              results: [],
              requiresApiKey: provider,
              link: meta.link,
              tutorial: meta.tutorial,
              freeSearchUsed: FREE_SEARCH_LIMIT_PER_CATEGORY,
              freeSearchLimit: FREE_SEARCH_LIMIT_PER_CATEGORY,
              freeSearchLimitReached: true,
            });
          }
          incrementFreeSearch(key, clientUsed);
        }
        if (boardProvider === "ludopedia") {
          const out = await searchBoardGamesLudopedia(
            q,
            keys?.ludopediaApiToken,
            { link: ludopediaMeta.link, tutorial: ludopediaMeta.tutorial },
            sort
          );
          const key = !keys?.ludopediaApiToken ? getFreeSearchKey(req, type, boardProvider) : "";
          const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
          return res.json(
            addPromptIfUserHasNoKey(
              out,
              "ludopedia",
              !!keys?.ludopediaApiToken,
              usage?.used,
              usage?.limit,
              usage ? usage.used >= FREE_SEARCH_LIMIT_PER_CATEGORY : false
            )
          );
        }
        const out = await searchBoardGames(q, keys?.bggApiToken, { link: bggMeta.link, tutorial: bggMeta.tutorial }, sort);
        const key = !keys?.bggApiToken ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
        return res.json(
          addPromptIfUserHasNoKey(
            out,
            "bgg",
            !!keys?.bggApiToken,
            usage?.used,
            usage?.limit,
            usage ? usage.used >= FREE_SEARCH_LIMIT_PER_CATEGORY : false
          )
        );
      }
      case "games": {
        const userHasKey = !!keys?.rawgApiKey;
        if (!userHasKey) {
          const key = getFreeSearchKey(req, type, boardProvider);
          const { used } = getFreeSearchUsage(key, clientUsed);
          if (used >= FREE_SEARCH_LIMIT_PER_CATEGORY) {
            return res.json(
              addPromptIfUserHasNoKey(
                { results: [] },
                "rawg",
                false,
                FREE_SEARCH_LIMIT_PER_CATEGORY,
                FREE_SEARCH_LIMIT_PER_CATEGORY,
                true
              )
            );
          }
          incrementFreeSearch(key, clientUsed);
        }
        const out = await searchGames(q, keys?.rawgApiKey, { link: rawgMeta.link, tutorial: rawgMeta.tutorial }, sort);
        const key = !keys?.rawgApiKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
        return res.json(
          addPromptIfUserHasNoKey(
            out,
            "rawg",
            !!keys?.rawgApiKey,
            usage?.used,
            usage?.limit,
            usage ? usage.used >= FREE_SEARCH_LIMIT_PER_CATEGORY : false
          )
        );
      }
      case "books": {
        const results = await searchBooks(q, sort);
        return res.json({ results });
      }
      case "anime": {
        const results = await searchAnime(q, sort);
        return res.json({ results });
      }
      case "manga": {
        const results = await searchManga(q, sort);
        return res.json({ results });
      }
      case "comics": {
        const comicvineKey = keys?.comicVineApiKey ?? process.env.COMIC_VINE_API_KEY ?? null;
        const userHasKey = !!comicvineKey;
        if (!userHasKey) {
          const key = getFreeSearchKey(req, type, boardProvider);
          const { used } = getFreeSearchUsage(key, clientUsed);
          if (used >= FREE_SEARCH_LIMIT_PER_CATEGORY) {
            return res.json(
              addPromptIfUserHasNoKey(
                { results: [] },
                "comicvine",
                false,
                FREE_SEARCH_LIMIT_PER_CATEGORY,
                FREE_SEARCH_LIMIT_PER_CATEGORY,
                true
              )
            );
          }
          incrementFreeSearch(key, clientUsed);
        }
        const out = await searchComics(q, keys?.comicVineApiKey, { link: comicvineMeta.link, tutorial: comicvineMeta.tutorial }, sort);
        const key = !comicvineKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
        return res.json(
          addPromptIfUserHasNoKey(
            out,
            "comicvine",
            !!comicvineKey,
            usage?.used,
            usage?.limit,
            usage ? usage.used >= FREE_SEARCH_LIMIT_PER_CATEGORY : false
          )
        );
      }
    }
  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      const userHadKey =
        err.provider === "tmdb"
          ? !!keys?.tmdbApiKey
          : err.provider === "rawg"
            ? !!keys?.rawgApiKey
            : err.provider === "bgg"
              ? !!keys?.bggApiToken
              : err.provider === "ludopedia"
                ? !!keys?.ludopediaApiToken
                : !!keys?.comicVineApiKey;
      if (userHadKey) {
        return res.status(400).json({
          error: "Invalid API key",
          code: "INVALID_API_KEY",
          provider: err.provider,
        });
      }
    }
    console.error("Search error:", err);
    res.status(502).json({ error: "Search failed" });
  }
});

const USER_SEARCH_MAX = 20;

/** GET /search/users?q= - Search users by username (for Social / Follow). Returns { users: Array<{ id, username, logCount, following? }> }. */
searchRouter.get("/users", async (req: AuthenticatedRequest, res) => {
  const rawQ = typeof req.query.q === "string" ? req.query.q : "";
  const q = sanitizeText(rawQ.trim(), 100);
  if (!q || q.length < 1) {
    res.json({ users: [] });
    return;
  }
  const users = await prisma.user.findMany({
    where: {
      username: { not: null, contains: q, mode: "insensitive" },
    },
    select: {
      id: true,
      username: true,
      _count: { select: { logs: true } },
    },
    take: USER_SEARCH_MAX,
    orderBy: { username: "asc" },
  });
  let followingIds = new Set<string>();
  if (req.user && users.length > 0) {
    const follows = await prisma.follow.findMany({
      where: {
        followerId: req.user.userId,
        followingId: { in: users.map((u) => u.id) },
      },
      select: { followingId: true },
    });
    followingIds = new Set(follows.map((f) => f.followingId));
  }
  res.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username ?? undefined,
      logCount: u._count.logs,
      ...(req.user && { following: followingIds.has(u.id) }),
    })),
  });
});
