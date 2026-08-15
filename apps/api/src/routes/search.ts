import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { MEDIA_TYPES, SEARCH_RESULTS_PAGE_SIZE, SEARCH_SORT_OPTIONS, resolveAnimeMangaTitleLanguage } from "@geeklogs/shared";
import type { MediaType, SearchResult } from "@geeklogs/shared";
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
  getTrendingMovies,
  getTrendingTv,
  getPopularMoviesNow,
  getPopularTvNow,
  getNowPlayingMovies,
  getOnTheAirTv,
} from "../services/tmdb.js";
import {
  searchGames,
  getGamesRecommendationsFromSeedsViaGenres,
  getPopularGames,
  getTrendingGames,
  getNewReleasesGames,
} from "../services/rawg.js";
import { searchBooks } from "../services/openLibrary.js";
import { searchAnime, searchManga, getAnimeRecommendationsForId, getTopAnimeByScore, getTopMangaByScore, getPopularAnime, getPopularManga, getAiringAnime } from "../services/jikan.js";
import { getHotBoardGames } from "../services/bgg.js";
import type { BoardGameProvider, BrowseRail, BrowseResponse } from "@geeklogs/shared";
import { searchBoardGames } from "../services/bgg.js";
import { searchBoardGamesLudopedia } from "../services/ludopedia.js";
import { searchComics } from "../services/comicvine.js";
import { InvalidApiKeyError } from "../lib/InvalidApiKeyError.js";
import { collectFromSeeds, topUpFromPopular } from "../lib/searchRecommendationsMerge.js";
import { isDisableApiKeyRequirementsEnabled } from "../lib/featureFlags.js";
import { preferEnvApiToken } from "../lib/preferEnvApiToken.js";
import { fetchBoardGameRecommendationsMerged } from "../services/boardGameRecommendations.js";
import { fetchBookRecommendationsMerged } from "../services/bookRecommendations.js";
import { fetchMangaRecommendationsMerged } from "../services/mangaRecommendations.js";
import { sortRecommendationsByScoreDesc } from "../lib/recommendationsSort.js";
import { createRouteTimer } from "../lib/routeTiming.js";
import { normalizeSearchQueryKey, withSearchResultsCache, withCachedSearchPayload } from "../lib/responseCache.js";

export const searchRouter = Router();

searchRouter.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.SEARCH_RATE_LIMIT_MAX) || 120,
    message: { error: "Search rate limit exceeded. Try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
  })
);
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
      animeMangaTitleLanguage: true,
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

const BROWSE_RAIL_MAX = 12;

type RecommendationsPayload =
  | { results: SearchResult[]; personalization: "from_logs" | "popular" | "none" }
  | { results: SearchResult[]; personalization: "none"; requiresApiKey: string; link: string; tutorial: string };

interface RecommendationCtx {
  type: MediaType;
  user?: { userId: string };
  keys?: NonNullable<Awaited<ReturnType<typeof getUserKeys>>>;
  skipApiKeyUX: boolean;
  boardGameProvider?: BoardGameProvider;
  sort?: string;
}

/**
 * Build the "recommended" (personalized + popular top-up) rail for a media type.
 * Shared by GET /search/recommendations and GET /search/browse. Options may include
 * requiresApiKey/link/tutorial when the provider needs a missing key.
 */
async function buildRecommendationsPayload(ctx: RecommendationCtx): Promise<RecommendationsPayload> {
  const { type, user, keys, skipApiKeyUX, boardGameProvider } = ctx;
  const tmdbMeta = API_KEY_META.tmdb;
  const rawgMeta = API_KEY_META.rawg;

  if (type === "comics") {
    return { results: [], personalization: "none" };
  }

  const forTypeLogs = () =>
    prisma.log.findMany({
      where: { userId: user!.userId, mediaType: type },
      select: { genres: true, mechanics: true, grade: true, status: true, affinityContext: true },
      orderBy: { updatedAt: "desc" },
      take: 120,
    });

  switch (type) {
    case "movies": {
      const userKey = keys?.tmdbApiKey ?? null;
      const hasKey = !!(userKey ?? process.env.TMDB_API_KEY);
      if (!skipApiKeyUX && !hasKey) {
        return { results: [], personalization: "none", requiresApiKey: "tmdb", link: tmdbMeta.link, tutorial: tmdbMeta.tutorial };
      }
      const exclude = user ? await getLoggedExternalIds(user.userId, "movies") : new Set<string>();
      const seeds = user ? await getRecentSeedIds(user.userId, "movies", RECOMMENDATION_SEEDS_MAX) : [];
      let fromLogs = false;
      let results =
        seeds.length > 0
          ? await collectFromSeeds(seeds, (id) => getMovieRecommendationsMerged(id, userKey, 20), exclude, RECOMMENDATIONS_MAX)
          : [];
      if (results.length > 0) fromLogs = true;
      results = await topUpFromPopular(results, () => getPopularMovies(userKey, RECOMMENDATIONS_MAX), exclude, RECOMMENDATIONS_MAX);
      results = sortRecommendationsByScoreDesc(results).slice(0, RECOMMENDATIONS_MAX);
      return { results, personalization: fromLogs ? "from_logs" : "popular" };
    }
    case "tv": {
      const userKey = keys?.tmdbApiKey ?? null;
      const hasKey = !!(userKey ?? process.env.TMDB_API_KEY);
      if (!skipApiKeyUX && !hasKey) {
        return {
          results: [],
          personalization: "none",
          requiresApiKey: "tmdb",
          link: tmdbMeta.link,
          tutorial: tmdbMeta.tutorial,
        };
      }
      const exclude = user ? await getLoggedExternalIds(user.userId, "tv") : new Set<string>();
      const seeds = user ? await getRecentSeedIds(user.userId, "tv", RECOMMENDATION_SEEDS_MAX) : [];
      let fromLogs = false;
      let results =
        seeds.length > 0
          ? await collectFromSeeds(seeds, (id) => getTvRecommendationsMerged(id, userKey, 20), exclude, RECOMMENDATIONS_MAX)
          : [];
      if (results.length > 0) fromLogs = true;
      results = await topUpFromPopular(results, () => getPopularTv(userKey, RECOMMENDATIONS_MAX), exclude, RECOMMENDATIONS_MAX);
      results = sortRecommendationsByScoreDesc(results).slice(0, RECOMMENDATIONS_MAX);
      return { results, personalization: fromLogs ? "from_logs" : "popular" };
    }
    case "games": {
      const userKey = keys?.rawgApiKey ?? null;
      const hasKey = !!(userKey ?? process.env.RAWG_API_KEY);
      if (!skipApiKeyUX && !hasKey) {
        return {
          results: [],
          personalization: "none",
          requiresApiKey: "rawg",
          link: rawgMeta.link,
          tutorial: rawgMeta.tutorial,
        };
      }
      const exclude = user ? await getLoggedExternalIds(user.userId, "games") : new Set<string>();
      const seeds = user ? await getRecentSeedIds(user.userId, "games", RECOMMENDATION_SEEDS_MAX) : [];
      let fromLogs = false;
      let results =
        seeds.length > 0
          ? await getGamesRecommendationsFromSeedsViaGenres(seeds, exclude, RECOMMENDATIONS_MAX, userKey, RECOMMENDATION_SEEDS_MAX)
          : [];
      if (results.length > 0) fromLogs = true;
      results = await topUpFromPopular(results, () => getPopularGames(userKey, RECOMMENDATIONS_MAX), exclude, RECOMMENDATIONS_MAX);
      results = sortRecommendationsByScoreDesc(results).slice(0, RECOMMENDATIONS_MAX);
      return { results, personalization: fromLogs ? "from_logs" : "popular" };
    }
    case "anime": {
      const titlePreference = resolveAnimeMangaTitleLanguage(keys?.animeMangaTitleLanguage);
      const exclude = user ? await getLoggedExternalIds(user.userId, "anime") : new Set<string>();
      const seeds = user ? await getRecentSeedIds(user.userId, "anime", RECOMMENDATION_SEEDS_MAX) : [];
      let fromLogs = false;
      let results =
        seeds.length > 0
          ? await collectFromSeeds(seeds, (id) => getAnimeRecommendationsForId(id, 20, titlePreference), exclude, RECOMMENDATIONS_MAX)
          : [];
      if (results.length > 0) fromLogs = true;
      results = await topUpFromPopular(results, () => getTopAnimeByScore(RECOMMENDATIONS_MAX, titlePreference), exclude, RECOMMENDATIONS_MAX);
      results = sortRecommendationsByScoreDesc(results).slice(0, RECOMMENDATIONS_MAX);
      return { results, personalization: fromLogs ? "from_logs" : "popular" };
    }
    case "books": {
      const exclude = user ? await getLoggedExternalIds(user.userId, "books") : new Set<string>();
      const logs = user ? await forTypeLogs() : [];
      const sortParam = ctx.sort;
      const allowedSorts = SEARCH_SORT_OPTIONS.books.map((o) => o.value);
      const sort = sortParam && allowedSorts.includes(sortParam) ? sortParam : undefined;
      const outcome = await fetchBookRecommendationsMerged({
        logs,
        exclude,
        maxResults: RECOMMENDATIONS_MAX,
        sort,
        maxSearchCalls: 2,
      });
      const results = sortRecommendationsByScoreDesc(outcome.results).slice(0, RECOMMENDATIONS_MAX);
      return { results, personalization: outcome.personalization };
    }
    case "manga": {
      const titlePreference = resolveAnimeMangaTitleLanguage(keys?.animeMangaTitleLanguage);
      const exclude = user ? await getLoggedExternalIds(user.userId, "manga") : new Set<string>();
      const logs = user
        ? await prisma.log.findMany({
            where: { userId: user.userId, mediaType: "manga" },
            select: { genres: true, affinityContext: true, grade: true, status: true },
            orderBy: { updatedAt: "desc" },
            take: 120,
          })
        : [];
      const sortParam = ctx.sort;
      const allowedSorts = SEARCH_SORT_OPTIONS.manga.map((o) => o.value);
      const sort = sortParam && allowedSorts.includes(sortParam) ? sortParam : undefined;
      const outcome = await fetchMangaRecommendationsMerged({
        logs,
        exclude,
        maxResults: RECOMMENDATIONS_MAX,
        sort,
        maxSearchCalls: 2,
        titlePreference,
      });
      const results = sortRecommendationsByScoreDesc(outcome.results).slice(0, RECOMMENDATIONS_MAX);
      return { results, personalization: outcome.personalization };
    }
    case "boardgames": {
      const bggMeta = API_KEY_META.bgg;
      const ludopediaMeta = API_KEY_META.ludopedia;
      const provider =
        boardGameProvider ??
        (keys?.boardGameProvider === "ludopedia" ? "ludopedia" : "bgg");
      const userBgg = keys?.bggApiToken ?? null;
      const userLudo = keys?.ludopediaApiToken ?? null;
      const hasKey =
        skipApiKeyUX ||
        (provider === "bgg" ? !!(userBgg ?? process.env.BGG_API_TOKEN) : !!(userLudo ?? process.env.LUDOPEDIA_API_TOKEN));
      if (!hasKey) {
        const meta = provider === "bgg" ? bggMeta : ludopediaMeta;
        return {
          results: [],
          personalization: "none",
          requiresApiKey: provider,
          link: meta.link,
          tutorial: meta.tutorial,
        };
      }
      const exclude = user ? await getLoggedExternalIds(user.userId, "boardgames") : new Set<string>();
      const logs = user ? await prisma.log.findMany({
        where: { userId: user.userId, mediaType: "boardgames" },
        select: { genres: true, mechanics: true, grade: true, status: true, affinityContext: true },
        orderBy: { updatedAt: "desc" },
        take: 120,
      }) : [];
      const token =
        provider === "bgg"
          ? preferEnvApiToken(process.env.BGG_API_TOKEN, userBgg)
          : preferEnvApiToken(process.env.LUDOPEDIA_API_TOKEN, userLudo);
      const sortParam = ctx.sort;
      const allowedSorts = SEARCH_SORT_OPTIONS.boardgames.map((o) => o.value);
      const sort = sortParam && allowedSorts.includes(sortParam) ? sortParam : undefined;
      const outcome = await fetchBoardGameRecommendationsMerged({
        logs,
        exclude,
        maxResults: RECOMMENDATIONS_MAX,
        provider,
        apiToken: token,
        sort,
        bggMeta,
        ludopediaMeta,
        maxSearchCalls: 2,
      });
      if ("requiresApiKey" in outcome) {
        return {
          results: [],
          personalization: "none",
          requiresApiKey: outcome.requiresApiKey,
          link: outcome.link,
          tutorial: outcome.tutorial,
        };
      }
      const boardResults = sortRecommendationsByScoreDesc(outcome.results).slice(0, RECOMMENDATIONS_MAX);
      return { results: boardResults, personalization: outcome.personalization };
    }
    default:
      return { results: [], personalization: "none" };
  }
}

/** Rails available from each provider for the empty-search browse carousels. */
async function buildBrowseRails(ctx: RecommendationCtx): Promise<{ rails: BrowseRail[]; requiresApiKey?: string; link?: string; tutorial?: string }> {
  const { type, user, keys, skipApiKeyUX, boardGameProvider } = ctx;
  const tmdbMeta = API_KEY_META.tmdb;
  const rawgMeta = API_KEY_META.rawg;
  const rails: BrowseRail[] = [];
  const exclude = user ? await getLoggedExternalIds(user.userId, type) : new Set<string>();

  const filtered = (list: SearchResult[]): SearchResult[] =>
    list.filter((r) => !exclude.has(r.id)).slice(0, BROWSE_RAIL_MAX);

  const singleNotFound = (provider: "tmdb" | "rawg"): { requiresApiKey?: string; link?: string; tutorial?: string } | undefined => {
    const userKey = provider === "tmdb" ? keys?.tmdbApiKey : keys?.rawgApiKey;
    const hasKey = provider === "tmdb" ? !!(userKey ?? process.env.TMDB_API_KEY) : !!(userKey ?? process.env.RAWG_API_KEY);
    if (!skipApiKeyUX && !hasKey) {
      const meta = provider === "tmdb" ? tmdbMeta : rawgMeta;
      return { requiresApiKey: provider, link: meta.link, tutorial: meta.tutorial };
    }
    return undefined;
  };

  switch (type) {
    case "movies": {
      const miss = singleNotFound("tmdb");
      if (miss) return { rails: [], ...miss };
      const userKey = keys?.tmdbApiKey ?? null;
      const [trending, popular, topRated, nowPlaying] = await Promise.all([
        getTrendingMovies(userKey, BROWSE_RAIL_MAX),
        getPopularMoviesNow(userKey, BROWSE_RAIL_MAX),
        getPopularMovies(userKey, BROWSE_RAIL_MAX),
        getNowPlayingMovies(userKey, BROWSE_RAIL_MAX),
      ]);
      if (trending.length) rails.push({ key: "trending", results: filtered(trending) });
      if (popular.length) rails.push({ key: "popular", results: filtered(popular) });
      if (topRated.length) rails.push({ key: "topRated", results: filtered(topRated) });
      if (nowPlaying.length) rails.push({ key: "newReleases", results: filtered(nowPlaying) });
      return { rails };
    }
    case "tv": {
      const miss = singleNotFound("tmdb");
      if (miss) return { rails: [], ...miss };
      const userKey = keys?.tmdbApiKey ?? null;
      const [trending, popular, topRated, onTheAir] = await Promise.all([
        getTrendingTv(userKey, BROWSE_RAIL_MAX),
        getPopularTvNow(userKey, BROWSE_RAIL_MAX),
        getPopularTv(userKey, BROWSE_RAIL_MAX),
        getOnTheAirTv(userKey, BROWSE_RAIL_MAX),
      ]);
      if (trending.length) rails.push({ key: "trending", results: filtered(trending) });
      if (popular.length) rails.push({ key: "popular", results: filtered(popular) });
      if (topRated.length) rails.push({ key: "topRated", results: filtered(topRated) });
      if (onTheAir.length) rails.push({ key: "newReleases", results: filtered(onTheAir) });
      return { rails };
    }
    case "games": {
      const miss = singleNotFound("rawg");
      if (miss) return { rails: [], ...miss };
      const userKey = keys?.rawgApiKey ?? null;
      const [trending, topRated, newReleases] = await Promise.all([
        getTrendingGames(userKey, BROWSE_RAIL_MAX),
        getPopularGames(userKey, BROWSE_RAIL_MAX),
        getNewReleasesGames(userKey, BROWSE_RAIL_MAX),
      ]);
      if (trending.length) rails.push({ key: "trending", results: filtered(trending) });
      if (topRated.length) rails.push({ key: "topRated", results: filtered(topRated) });
      if (newReleases.length) rails.push({ key: "newReleases", results: filtered(newReleases) });
      return { rails };
    }
    case "anime": {
      const titlePreference = resolveAnimeMangaTitleLanguage(keys?.animeMangaTitleLanguage);
      const [trending, topRated, airing] = await Promise.all([
        getPopularAnime(BROWSE_RAIL_MAX, titlePreference),
        getTopAnimeByScore(BROWSE_RAIL_MAX, titlePreference),
        getAiringAnime(BROWSE_RAIL_MAX, titlePreference),
      ]);
      if (trending.length) rails.push({ key: "trending", results: filtered(trending) });
      if (topRated.length) rails.push({ key: "topRated", results: filtered(topRated) });
      if (airing.length) rails.push({ key: "newReleases", results: filtered(airing) });
      return { rails };
    }
    case "manga": {
      const titlePreference = resolveAnimeMangaTitleLanguage(keys?.animeMangaTitleLanguage);
      const [trending, topRated] = await Promise.all([
        getPopularManga(BROWSE_RAIL_MAX, titlePreference),
        getTopMangaByScore(BROWSE_RAIL_MAX, titlePreference),
      ]);
      if (trending.length) rails.push({ key: "trending", results: filtered(trending) });
      if (topRated.length) rails.push({ key: "topRated", results: filtered(topRated) });
      return { rails };
    }
    case "boardgames": {
      const hot = await getHotBoardGames(BROWSE_RAIL_MAX);
      if (hot.length) rails.push({ key: "hot", results: filtered(hot) });
      return { rails };
    }
    default:
      return { rails };
  }
}

const recommendationsQuerySchema = z.object({
  type: z.enum(MEDIA_TYPES as unknown as [string, ...string[]]),
  boardGameProvider: z.enum(["bgg", "ludopedia"]).optional(),
  sort: z.string().optional(),
});

/**
 * Personalized or popular picks for the Search empty state. Does not consume free-search quota.
 * Query: type (media). Optional auth: seeds from recent logs when logged in.
 */
searchRouter.get("/recommendations", async (req: AuthenticatedRequest, res) => {
  const parsed = recommendationsQuerySchema.safeParse({
    type: req.query.type,
    boardGameProvider: req.query.boardGameProvider,
    sort: req.query.sort,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid type" });
    return;
  }
  const type = parsed.data.type as MediaType;
  const keys = req.user ? await getUserKeys(req.user.userId) : undefined;
  const skipApiKeyUX = await isDisableApiKeyRequirementsEnabled();
  const viewer = req.user?.userId ?? "guest";
  const titleLang = keys
    ? resolveAnimeMangaTitleLanguage(keys.animeMangaTitleLanguage)
    : "";
  const queryKey = JSON.stringify({
    kind: "recs",
    viewer,
    board: parsed.data.boardGameProvider ?? "",
    sort: parsed.data.sort ?? "",
    titleLang,
  });

  try {
    const { data: payload } = await withCachedSearchPayload(prisma, type, queryKey, () =>
      buildRecommendationsPayload({
        type,
        user: req.user,
        keys,
        skipApiKeyUX,
        boardGameProvider: parsed.data.boardGameProvider,
        sort: parsed.data.sort,
      })
    );
    res.json(payload);
  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      if (skipApiKeyUX) {
        console.error("Recommendations error (INVALID_API_KEY UX disabled by feature flag):", err);
        res.status(502).json({ error: "Recommendations failed" });
        return;
      }
      const userHadKey =
        err.provider === "tmdb"
          ? !!keys?.tmdbApiKey
          : err.provider === "rawg"
            ? !!keys?.rawgApiKey
            : err.provider === "bgg"
              ? !!keys?.bggApiToken
              : err.provider === "ludopedia"
                ? !!keys?.ludopediaApiToken
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

/** Netflix-style carousels for the blank search state. Does not consume free-search quota. */
searchRouter.get("/browse", async (req: AuthenticatedRequest, res) => {
  const parsed = recommendationsQuerySchema.safeParse({
    type: req.query.type,
    boardGameProvider: req.query.boardGameProvider,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid type" });
    return;
  }
  const type = parsed.data.type as MediaType;
  const keys = req.user ? await getUserKeys(req.user.userId) : undefined;
  const skipApiKeyUX = await isDisableApiKeyRequirementsEnabled();
  const viewer = req.user?.userId ?? "guest";
  const titleLang = keys
    ? resolveAnimeMangaTitleLanguage(keys.animeMangaTitleLanguage)
    : "";
  const queryKey = JSON.stringify({
    kind: "browse",
    viewer,
    board: parsed.data.boardGameProvider ?? "",
    titleLang,
  });

  try {
    const { data } = await withCachedSearchPayload(prisma, type, queryKey, async () => {
      const { rails, requiresApiKey, link, tutorial } = await buildBrowseRails({
        type,
        user: req.user,
        keys,
        skipApiKeyUX,
        boardGameProvider: parsed.data.boardGameProvider,
      });
      return {
        type,
        rails,
        ...(requiresApiKey ? { requiresApiKey, link, tutorial } : {}),
      } satisfies BrowseResponse;
    });
    res.json(data);
  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      if (skipApiKeyUX) {
        console.error("Browse error (INVALID_API_KEY UX disabled by feature flag):", err);
        res.status(502).json({ error: "Browse failed" });
        return;
      }
      const userHadKey =
        err.provider === "tmdb"
          ? !!keys?.tmdbApiKey
          : err.provider === "rawg"
            ? !!keys?.rawgApiKey
            : err.provider === "bgg"
              ? !!keys?.bggApiToken
              : err.provider === "ludopedia"
                ? !!keys?.ludopediaApiToken
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
    console.error("Browse error:", err);
    res.status(502).json({ error: "Browse failed" });
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
  const skipApiKeyUX = await isDisableApiKeyRequirementsEnabled();
  const titlePreference = resolveAnimeMangaTitleLanguage(keys?.animeMangaTitleLanguage);
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
    const shouldAddPrompt =
      !skipApiKeyUX && ((req.user && !userHasKey) || freeSearchLimitReached);
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

  const timer = createRouteTimer();
  const searchQueryKey = normalizeSearchQueryKey(
    q,
    sort,
    type === "boardgames" ? boardProvider : undefined,
    type === "anime" || type === "manga" ? titlePreference : undefined
  );

  try {
    switch (type as MediaType) {
      case "movies": {
        const userHasKey = skipApiKeyUX || !!keys?.tmdbApiKey;
        if (!userHasKey) {
          const key = getFreeSearchKey(req, type, boardProvider);
          const { used } = getFreeSearchUsage(key, clientUsed);
          if (used >= FREE_SEARCH_LIMIT_PER_CATEGORY) {
            timer.finish(res);
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
        timer.setProvider("tmdb");
        const { data: out, cacheHit } = await timer.trackExternal(() =>
          withSearchResultsCache(prisma, type, searchQueryKey, () =>
            searchMovies(q, keys?.tmdbApiKey, { link: tmdbMeta.link, tutorial: tmdbMeta.tutorial }, sort)
          )
        );
        timer.setCacheHit(cacheHit);
        const key = !userHasKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
        timer.finish(res, { provider: "tmdb" });
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
        const userHasKey = skipApiKeyUX || !!keys?.tmdbApiKey;
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
        timer.setProvider("tmdb");
        const { data: out, cacheHit } = await withSearchResultsCache(prisma, type, searchQueryKey, () =>
          searchTv(q, keys?.tmdbApiKey, { link: tmdbMeta.link, tutorial: tmdbMeta.tutorial }, sort)
        );
        timer.setCacheHit(cacheHit);
        const key = !userHasKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
        timer.finish(res, { provider: "tmdb" });
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
        const userHasKey =
          skipApiKeyUX ||
          (boardProvider === "ludopedia" ? !!keys?.ludopediaApiToken : !!keys?.bggApiToken);
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
          timer.setProvider("ludopedia");
          const { data: out, cacheHit } = await withSearchResultsCache(prisma, type, searchQueryKey, () =>
            searchBoardGamesLudopedia(
              q,
              keys?.ludopediaApiToken,
              { link: ludopediaMeta.link, tutorial: ludopediaMeta.tutorial },
              sort
            )
          );
          timer.setCacheHit(cacheHit);
          const key = !userHasKey ? getFreeSearchKey(req, type, boardProvider) : "";
          const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
          timer.finish(res, { provider: "ludopedia" });
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
        timer.setProvider("bgg");
        const { data: out, cacheHit } = await withSearchResultsCache(prisma, type, searchQueryKey, () =>
          searchBoardGames(q, keys?.bggApiToken, { link: bggMeta.link, tutorial: bggMeta.tutorial }, sort)
        );
        timer.setCacheHit(cacheHit);
        const key = !userHasKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
        timer.finish(res, { provider: "bgg" });
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
        const userHasKey = skipApiKeyUX || !!keys?.rawgApiKey;
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
        timer.setProvider("rawg");
        const { data: out, cacheHit } = await withSearchResultsCache(prisma, type, searchQueryKey, () =>
          searchGames(q, keys?.rawgApiKey, { link: rawgMeta.link, tutorial: rawgMeta.tutorial }, sort)
        );
        timer.setCacheHit(cacheHit);
        const key = !userHasKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
        timer.finish(res, { provider: "rawg" });
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
        timer.setProvider("openlibrary");
        const { data: cached, cacheHit } = await withSearchResultsCache(prisma, type, searchQueryKey, async () => ({
          results: await searchBooks(q, sort),
        }));
        timer.setCacheHit(cacheHit);
        timer.finish(res, { provider: "openlibrary" });
        return res.json(cached);
      }
      case "anime": {
        timer.setProvider("jikan");
        const { data: cached, cacheHit } = await withSearchResultsCache(prisma, type, searchQueryKey, async () => ({
          results: await searchAnime(q, sort, titlePreference),
        }));
        timer.setCacheHit(cacheHit);
        timer.finish(res, { provider: "jikan" });
        return res.json(cached);
      }
      case "manga": {
        timer.setProvider("jikan");
        const { data: cached, cacheHit } = await withSearchResultsCache(prisma, type, searchQueryKey, async () => ({
          results: await searchManga(q, sort, titlePreference),
        }));
        timer.setCacheHit(cacheHit);
        timer.finish(res, { provider: "jikan" });
        return res.json(cached);
      }
      case "comics": {
        const comicvineKey = keys?.comicVineApiKey ?? process.env.COMIC_VINE_API_KEY ?? null;
        const userHasKey = skipApiKeyUX || !!comicvineKey;
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
        timer.setProvider("comicvine");
        const { data: out, cacheHit } = await withSearchResultsCache(prisma, type, searchQueryKey, () =>
          searchComics(q, keys?.comicVineApiKey, { link: comicvineMeta.link, tutorial: comicvineMeta.tutorial }, sort)
        );
        timer.setCacheHit(cacheHit);
        const key = !userHasKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key, clientUsed) : null;
        timer.finish(res, { provider: "comicvine" });
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
      if (skipApiKeyUX) {
        console.error("Search error (INVALID_API_KEY UX disabled by feature flag):", err);
        return res.status(502).json({ error: "Search failed" });
      }
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

const USER_SEARCH_MAX = SEARCH_RESULTS_PAGE_SIZE;

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

const GUEST_BROWSE_PREWARM_TYPES: MediaType[] = ["movies", "tv", "games", "anime"];

/** Fill SearchResponseCache for anonymous browse rails so the first visitor is not the cache filler. */
export async function prewarmGuestSearchRails(): Promise<void> {
  const skipApiKeyUX = await isDisableApiKeyRequirementsEnabled();
  const queryKey = JSON.stringify({ kind: "browse", viewer: "guest", board: "", titleLang: "" });
  for (const type of GUEST_BROWSE_PREWARM_TYPES) {
    try {
      await withCachedSearchPayload(prisma, type, queryKey, async () => {
        const { rails, requiresApiKey, link, tutorial } = await buildBrowseRails({
          type,
          skipApiKeyUX,
        });
        return {
          type,
          rails,
          ...(requiresApiKey ? { requiresApiKey, link, tutorial } : {}),
        } satisfies BrowseResponse;
      });
    } catch (err) {
      console.error(`guest browse prewarm failed (${type}):`, err);
    }
  }
}
