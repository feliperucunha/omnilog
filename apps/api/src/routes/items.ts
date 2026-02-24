import { Router } from "express";
import { MEDIA_TYPES } from "@logeverything/shared";
import type { MediaType } from "@logeverything/shared";
import { prisma } from "../lib/prisma.js";
import { sanitizeText, EXTERNAL_ID_MAX_LENGTH } from "../lib/sanitize.js";
import { optionalAuthMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getMovieById, getTvById } from "../services/tmdb.js";
import { getGameById } from "../services/rawg.js";
import { getBookById } from "../services/openLibrary.js";
import { getAnimeById, getMangaById } from "../services/jikan.js";
import { getBoardGameById } from "../services/bgg.js";
import { getVolumeById } from "../services/comicvine.js";

export const itemsRouter = Router();
itemsRouter.use(optionalAuthMiddleware);

async function getUserKeys(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tmdbApiKey: true, rawgApiKey: true, bggApiToken: true, comicVineApiKey: true },
  });
  return user ?? undefined;
}

const DEFAULT_REVIEWS_LIMIT = 10;
const MAX_REVIEWS_LIMIT = 50;

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
  const reviewsLimit = Math.min(
    MAX_REVIEWS_LIMIT,
    Math.max(1, parseInt(String(req.query.reviewsLimit ?? DEFAULT_REVIEWS_LIMIT), 10) || DEFAULT_REVIEWS_LIMIT)
  );
  const keys = req.user ? await getUserKeys(req.user.userId) : undefined;

  let item = null;
  try {
    switch (mediaType) {
      case "movies":
        item = await getMovieById(externalId, keys?.tmdbApiKey);
        break;
      case "tv":
        item = await getTvById(externalId, keys?.tmdbApiKey);
        break;
      case "boardgames":
        item = await getBoardGameById(externalId, keys?.bggApiToken);
        break;
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
    prisma.log.findMany({
      where,
      include: { user: { select: { email: true } } },
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
      id: item.id,
      title: item.title,
      image: itemImage,
      year: item.year,
      subtitle: item.subtitle,
      runtimeMinutes: item.runtimeMinutes ?? null,
      timeToBeatHours: item.timeToBeatHours ?? null,
    },
    reviews,
    meanGrade: meanGrade != null ? Math.round(meanGrade * 10) / 10 : null,
    reviewsTotal,
    reviewsPage,
    reviewsLimit,
  });
});
