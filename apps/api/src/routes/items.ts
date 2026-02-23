import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { MEDIA_TYPES } from "@logeverything/shared";
import type { MediaType } from "@logeverything/shared";
import { prisma } from "../lib/prisma.js";

type LogWithUser = Prisma.LogGetPayload<{
  include: { user: { select: { email: true } } };
}>;
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

itemsRouter.get("/:mediaType/:externalId", async (req: AuthenticatedRequest, res) => {
  const mediaType = req.params.mediaType as MediaType;
  const externalId = req.params.externalId;
  if (!MEDIA_TYPES.includes(mediaType) || !externalId) {
    res.status(400).json({ error: "Invalid mediaType or externalId" });
    return;
  }
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

  const logs = await prisma.log.findMany({
    where: { mediaType, externalId },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const withGrade = logs.filter((l: LogWithUser) => l.grade != null);
  const meanGrade =
    withGrade.length > 0
      ? withGrade.reduce((s: number, l: LogWithUser) => s + (l.grade ?? 0), 0) / withGrade.length
      : null;

  const reviews = logs.map((l: LogWithUser) => ({
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

  const logWithImage = logs.find((l: LogWithUser) => l.image != null && l.image !== "");
  const itemImage = item.image ?? logWithImage?.image ?? null;

  res.json({
    item: {
      id: item.id,
      title: item.title,
      image: itemImage,
      year: item.year,
      subtitle: item.subtitle,
      runtimeMinutes: item.runtimeMinutes ?? null,
    },
    reviews,
    meanGrade: meanGrade != null ? Math.round(meanGrade * 10) / 10 : null,
  });
});
