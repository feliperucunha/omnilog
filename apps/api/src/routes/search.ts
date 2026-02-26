import { Router } from "express";
import { z } from "zod";
import { MEDIA_TYPES, SEARCH_SORT_OPTIONS } from "@logeverything/shared";
import type { MediaType, SearchResult } from "@logeverything/shared";
import { prisma } from "../lib/prisma.js";
import { sanitizeText, SEARCH_QUERY_MAX_LENGTH } from "../lib/sanitize.js";
import { optionalAuthMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { API_KEY_META } from "../lib/apiKeyMeta.js";
import { searchMovies, searchTv } from "../services/tmdb.js";
import { searchGames } from "../services/rawg.js";
import { searchBooks } from "../services/openLibrary.js";
import { searchAnime, searchManga } from "../services/jikan.js";
import { searchBoardGames } from "../services/bgg.js";
import { searchBoardGamesLudopedia } from "../services/ludopedia.js";
import { searchComics } from "../services/comicvine.js";

export const searchRouter = Router();
searchRouter.use(optionalAuthMiddleware);

/** Free searches per category when user has no API key. Key: userId|ip + type (+ boardProvider for boardgames). */
const FREE_SEARCH_LIMIT_PER_CATEGORY = 5;
const freeSearchCounts = new Map<string, number>();

function getFreeSearchKey(req: { user?: { userId: string }; ip?: string }, type: string, boardProvider: string): string {
  const id = req.user?.userId ?? req.ip ?? "anon";
  const suffix = type === "boardgames" ? `-${boardProvider}` : "";
  return `${id}-${type}${suffix}`;
}

function getFreeSearchUsage(key: string): { used: number; limit: number } {
  const used = freeSearchCounts.get(key) ?? 0;
  return { used, limit: FREE_SEARCH_LIMIT_PER_CATEGORY };
}

function incrementFreeSearch(key: string): number {
  const prev = freeSearchCounts.get(key) ?? 0;
  const next = prev + 1;
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

searchRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const parsed = querySchema.safeParse({
    type: req.query.type,
    q: req.query.q,
    sort: req.query.sort,
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
          const { used } = getFreeSearchUsage(key);
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
          incrementFreeSearch(key);
        }
        const out = await searchMovies(q, keys?.tmdbApiKey, { link: tmdbMeta.link, tutorial: tmdbMeta.tutorial }, sort);
        const key = !keys?.tmdbApiKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key) : null;
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
          const { used } = getFreeSearchUsage(key);
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
          incrementFreeSearch(key);
        }
        const out = await searchTv(q, keys?.tmdbApiKey, { link: tmdbMeta.link, tutorial: tmdbMeta.tutorial }, sort);
        const key = !keys?.tmdbApiKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key) : null;
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
          const { used } = getFreeSearchUsage(key);
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
          incrementFreeSearch(key);
        }
        if (boardProvider === "ludopedia") {
          const out = await searchBoardGamesLudopedia(
            q,
            keys?.ludopediaApiToken,
            { link: ludopediaMeta.link, tutorial: ludopediaMeta.tutorial },
            sort
          );
          const key = !keys?.ludopediaApiToken ? getFreeSearchKey(req, type, boardProvider) : "";
          const usage = key ? getFreeSearchUsage(key) : null;
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
        const usage = key ? getFreeSearchUsage(key) : null;
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
          const { used } = getFreeSearchUsage(key);
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
          incrementFreeSearch(key);
        }
        const out = await searchGames(q, keys?.rawgApiKey, { link: rawgMeta.link, tutorial: rawgMeta.tutorial }, sort);
        const key = !keys?.rawgApiKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key) : null;
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
          const { used } = getFreeSearchUsage(key);
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
          incrementFreeSearch(key);
        }
        const out = await searchComics(q, keys?.comicVineApiKey, { link: comicvineMeta.link, tutorial: comicvineMeta.tutorial }, sort);
        const key = !comicvineKey ? getFreeSearchKey(req, type, boardProvider) : "";
        const usage = key ? getFreeSearchUsage(key) : null;
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
    console.error("Search error:", err);
    res.status(502).json({ error: "Search failed" });
  }
});
