import { Router } from "express";
import { MEDIA_TYPES } from "@logeverything/shared";
import type { MediaType } from "@logeverything/shared";
import { prisma } from "../lib/prisma.js";
import { sanitizeText, EXTERNAL_ID_MAX_LENGTH } from "../lib/sanitize.js";
import { optionalAuthMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getMovieById, getTvById, getTvSeasonEpisodeNumbers } from "../services/tmdb.js";
import { getGameById } from "../services/rawg.js";
import { getBookById } from "../services/openLibrary.js";
import { getAnimeById, getMangaById } from "../services/jikan.js";
import { getBoardGameById } from "../services/bgg.js";
import { getBoardGameByIdLudopedia } from "../services/ludopedia.js";
import { getVolumeById } from "../services/comicvine.js";

export const itemsRouter = Router();
itemsRouter.use(optionalAuthMiddleware);

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

const DEFAULT_REVIEWS_LIMIT = 10;
const MAX_REVIEWS_LIMIT = 50;

/** GET /items/:mediaType/:externalId/progress-options - options for season/episode/chapter/volume dropdowns. */
itemsRouter.get("/:mediaType/:externalId/progress-options", async (req: AuthenticatedRequest, res) => {
  const mediaType = req.params.mediaType as MediaType;
  const rawExternalId = req.params.externalId;
  if (!MEDIA_TYPES.includes(mediaType) || !rawExternalId) {
    res.status(400).json({ error: "Invalid mediaType or externalId" });
    return;
  }
  const externalId = sanitizeText(rawExternalId, EXTERNAL_ID_MAX_LENGTH);
  if (!externalId) {
    res.status(400).json({ error: "Invalid externalId" });
    return;
  }
  const keys = req.user ? await getUserKeys(req.user.userId) : undefined;

  try {
    if (mediaType === "tv") {
      const item = await getTvById(externalId, keys?.tmdbApiKey);
      if (!item || !item.seasonsCount) {
        res.json({ seasons: [], episodesBySeason: {} });
        return;
      }
      const seasons = Array.from({ length: item.seasonsCount }, (_, i) => i + 1);
      const episodesBySeason: Record<string, number[]> = {};
      for (const sn of seasons) {
        const eps = await getTvSeasonEpisodeNumbers(externalId, sn, keys?.tmdbApiKey);
        episodesBySeason[String(sn)] = eps.length > 0 ? eps : Array.from({ length: 24 }, (_, i) => i + 1);
      }
      res.json({ seasons, episodesBySeason });
      return;
    }
    if (mediaType === "anime") {
      const item = await getAnimeById(externalId);
      if (!item || !item.episodesCount) {
        res.json({ episodes: [] });
        return;
      }
      const episodes = Array.from({ length: item.episodesCount }, (_, i) => i + 1);
      res.json({ episodes });
      return;
    }
    if (mediaType === "manga") {
      const item = await getMangaById(externalId);
      if (!item) {
        res.json({ chapters: [], volumes: [] });
        return;
      }
      const chapters =
        (item.chaptersCount ?? 0) > 0
          ? Array.from({ length: item.chaptersCount! }, (_, i) => i + 1)
          : [];
      const volumes =
        (item.volumesCount ?? 0) > 0
          ? Array.from({ length: item.volumesCount! }, (_, i) => i + 1)
          : [];
      res.json({ chapters, volumes });
      return;
    }
    if (mediaType === "comics") {
      const item = await getVolumeById(externalId, keys?.comicVineApiKey);
      if (!item || !item.issuesCount) {
        res.json({ volumes: [] });
        return;
      }
      const volumes = Array.from({ length: item.issuesCount }, (_, i) => i + 1);
      res.json({ volumes });
      return;
    }
    res.json({});
  } catch (err) {
    console.error("Progress options error:", err);
    res.status(500).json({ error: "Failed to load options" });
  }
});

/** GET /items/:mediaType/:externalId/reviews - reviews only (for async loading after details). */
itemsRouter.get("/:mediaType/:externalId/reviews", async (req: AuthenticatedRequest, res) => {
  const mediaType = req.params.mediaType as MediaType;
  const rawExternalId = req.params.externalId;
  if (!MEDIA_TYPES.includes(mediaType) || !rawExternalId) {
    res.status(400).json({ error: "Invalid mediaType or externalId" });
    return;
  }
  const externalId = sanitizeText(rawExternalId, EXTERNAL_ID_MAX_LENGTH);
  if (!externalId) {
    res.status(400).json({ error: "Invalid externalId" });
    return;
  }
  const reviewsPage = Math.max(1, parseInt(String(req.query.page ?? req.query.reviewsPage ?? 1), 10) || 1);
  const reviewsLimit = Math.min(
    MAX_REVIEWS_LIMIT,
    Math.max(1, parseInt(String(req.query.limit ?? req.query.reviewsLimit ?? DEFAULT_REVIEWS_LIMIT), 10) || DEFAULT_REVIEWS_LIMIT)
  );
  const where = { mediaType, externalId };

  const [reviewsTotal, gradeAgg, logs] = await Promise.all([
    prisma.log.count({ where }),
    prisma.log.aggregate({
      where: { ...where, grade: { not: null } },
      _avg: { grade: true },
      _count: { grade: true },
    }),
    prisma.log.findMany({
      where,
      include: { user: { select: { email: true, tier: true } } },
      orderBy: { createdAt: "desc" },
      skip: (reviewsPage - 1) * reviewsLimit,
      take: reviewsLimit,
    }),
  ]);

  const meanGrade =
    gradeAgg._count.grade > 0 && gradeAgg._avg.grade != null
      ? gradeAgg._avg.grade
      : null;

  const reviews = logs.map((l) => ({
    id: l.id,
    userEmail: l.user.email,
    isPro: l.user.tier === "pro",
    grade: l.grade,
    review: l.review,
    listType: l.listType,
    status: l.status,
    season: l.season,
    episode: l.episode,
    chapter: l.chapter,
    volume: l.volume,
    startedAt: l.startedAt?.toISOString() ?? null,
    completedAt: l.completedAt?.toISOString() ?? null,
    contentHours: l.contentHours,
    createdAt: l.createdAt.toISOString(),
  }));

  res.json({
    reviews,
    meanGrade: meanGrade != null ? Math.round(meanGrade * 10) / 10 : null,
    reviewsTotal,
    reviewsPage,
    reviewsLimit,
  });
});

itemsRouter.get("/:mediaType/:externalId", async (req: AuthenticatedRequest, res) => {
  const mediaType = req.params.mediaType as MediaType;
  const rawExternalId = req.params.externalId;
  if (!MEDIA_TYPES.includes(mediaType) || !rawExternalId) {
    res.status(400).json({ error: "Invalid mediaType or externalId" });
    return;
  }
  const externalId = sanitizeText(rawExternalId, EXTERNAL_ID_MAX_LENGTH);
  if (!externalId) {
    res.status(400).json({ error: "Invalid externalId" });
    return;
  }
  const reviewsPage = Math.max(1, parseInt(String(req.query.reviewsPage ?? 1), 10) || 1);
  const requestedLimit = parseInt(String(req.query.reviewsLimit ?? DEFAULT_REVIEWS_LIMIT), 10);
  const reviewsLimit =
    requestedLimit === 0
      ? 0
      : Math.min(MAX_REVIEWS_LIMIT, Math.max(1, requestedLimit || DEFAULT_REVIEWS_LIMIT));
  const keys = req.user ? await getUserKeys(req.user.userId) : undefined;

  let boardProviderUsed: "bgg" | "ludopedia" | null = null;

  let item = null;
  try {
    switch (mediaType) {
      case "movies":
        item = await getMovieById(externalId, keys?.tmdbApiKey);
        break;
      case "tv":
        item = await getTvById(externalId, keys?.tmdbApiKey);
        break;
      case "boardgames": {
        let boardProvider: "bgg" | "ludopedia" = keys?.boardGameProvider === "ludopedia" ? "ludopedia" : "bgg";
        if (req.user) {
          const logWithSource = await prisma.log.findFirst({
            where: { userId: req.user.userId, mediaType: "boardgames", externalId },
            select: { boardGameSource: true },
          });
          if (logWithSource?.boardGameSource === "bgg" || logWithSource?.boardGameSource === "ludopedia")
            boardProvider = logWithSource.boardGameSource;
        }
        boardProviderUsed = boardProvider;
        item =
          boardProvider === "ludopedia"
            ? await getBoardGameByIdLudopedia(externalId, keys?.ludopediaApiToken)
            : await getBoardGameById(externalId, keys?.bggApiToken);
        if (item) (item as { itemSource?: "bgg" | "ludopedia" }).itemSource = boardProvider;
        break;
      }
      case "games":
        item = await getGameById(externalId, keys?.rawgApiKey);
        break;
      case "books":
        item = await getBookById(externalId);
        break;
      case "anime":
        item = await getAnimeById(externalId);
        break;
      case "manga":
        item = await getMangaById(externalId);
        break;
      case "comics":
        item = await getVolumeById(externalId, keys?.comicVineApiKey);
        break;
    }
  } catch (err) {
    console.error("Item fetch error:", err);
  }

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const where = { mediaType, externalId };

  const [reviewsTotal, gradeAgg, logs] = await Promise.all([
    prisma.log.count({ where }),
    prisma.log.aggregate({
      where: { ...where, grade: { not: null } },
      _avg: { grade: true },
      _count: { grade: true },
    }),
    reviewsLimit === 0
      ? Promise.resolve([])
      : prisma.log.findMany({
          where,
          include: { user: { select: { email: true, tier: true } } },
          orderBy: { createdAt: "desc" },
          skip: (reviewsPage - 1) * reviewsLimit,
          take: reviewsLimit,
        }),
  ]);

  const meanGrade =
    gradeAgg._count.grade > 0 && gradeAgg._avg.grade != null
      ? gradeAgg._avg.grade
      : null;

  const reviews = logs.map((l) => ({
    id: l.id,
    userEmail: l.user.email,
    isPro: l.user.tier === "pro",
    grade: l.grade,
    review: l.review,
    listType: l.listType,
    status: l.status,
    season: l.season,
    episode: l.episode,
    chapter: l.chapter,
    volume: l.volume,
    startedAt: l.startedAt?.toISOString() ?? null,
    completedAt: l.completedAt?.toISOString() ?? null,
    contentHours: l.contentHours,
    createdAt: l.createdAt.toISOString(),
  }));

  const logWithImage = await prisma.log.findFirst({
    where: { mediaType, externalId, image: { not: null } },
    select: { image: true },
  });
  const itemImage = item.image ?? (logWithImage?.image as string | null) ?? null;

  res.json({
    item: {
      ...item,
      image: itemImage,
    },
    reviews,
    meanGrade: meanGrade != null ? Math.round(meanGrade * 10) / 10 : null,
    reviewsTotal,
    reviewsPage,
    reviewsLimit: reviewsLimit === 0 ? DEFAULT_REVIEWS_LIMIT : reviewsLimit,
  });
});
