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
import { searchComics } from "../services/comicvine.js";

export const searchRouter = Router();
searchRouter.use(optionalAuthMiddleware);

const querySchema = z.object({
  type: z.enum(MEDIA_TYPES as unknown as [string, ...string[]]),
  q: z.string().min(1),
  sort: z.string().optional(),
});

async function getUserKeys(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tmdbApiKey: true, rawgApiKey: true, bggApiToken: true, comicVineApiKey: true },
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
  const { type, q: rawQ, sort: rawSort } = parsed.data;
  const q = sanitizeText(rawQ, SEARCH_QUERY_MAX_LENGTH);
  if (!q) {
    res.status(400).json({ error: "Invalid or empty search query" });
    return;
  }
  const allowedSorts = SEARCH_SORT_OPTIONS[type as MediaType].map((o) => o.value);
  const sort = rawSort && allowedSorts.includes(rawSort) ? rawSort : undefined;
  const keys = req.user ? await getUserKeys(req.user.userId) : undefined;
  const tmdbMeta = API_KEY_META.tmdb;
  const rawgMeta = API_KEY_META.rawg;
  const bggMeta = API_KEY_META.bgg;
  const comicvineMeta = API_KEY_META.comicvine;
  const addPromptIfUserHasNoKey = (
    out: { results: unknown[] },
    provider: "tmdb" | "rawg" | "bgg" | "comicvine",
    userHasKey: boolean
  ) => {
    if (req.user && !userHasKey) {
      const meta = provider === "tmdb" ? tmdbMeta : provider === "rawg" ? rawgMeta : provider === "bgg" ? bggMeta : comicvineMeta;
      return { ...out, requiresApiKey: provider, link: meta.link, tutorial: meta.tutorial };
    }
    return out;
  };

  try {
    switch (type as MediaType) {
      case "movies": {
        const out = await searchMovies(q, keys?.tmdbApiKey, { link: tmdbMeta.link, tutorial: tmdbMeta.tutorial }, sort);
        return res.json(addPromptIfUserHasNoKey(out, "tmdb", !!keys?.tmdbApiKey));
      }
      case "tv": {
        const out = await searchTv(q, keys?.tmdbApiKey, { link: tmdbMeta.link, tutorial: tmdbMeta.tutorial }, sort);
        return res.json(addPromptIfUserHasNoKey(out, "tmdb", !!keys?.tmdbApiKey));
      }
      case "boardgames": {
        const out = await searchBoardGames(q, keys?.bggApiToken, { link: bggMeta.link, tutorial: bggMeta.tutorial }, sort);
        return res.json(addPromptIfUserHasNoKey(out, "bgg", !!keys?.bggApiToken));
      }
      case "games": {
        const out = await searchGames(q, keys?.rawgApiKey, { link: rawgMeta.link, tutorial: rawgMeta.tutorial }, sort);
        return res.json(addPromptIfUserHasNoKey(out, "rawg", !!keys?.rawgApiKey));
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
        const out = await searchComics(q, keys?.comicVineApiKey, { link: comicvineMeta.link, tutorial: comicvineMeta.tutorial }, sort);
        return res.json(addPromptIfUserHasNoKey(out, "comicvine", !!comicvineKey));
      }
    }
  } catch (err) {
    console.error("Search error:", err);
    res.status(502).json({ error: "Search failed" });
  }
});
