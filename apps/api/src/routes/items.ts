import { Router } from "express";
import { MEDIA_TYPES } from "@geeklogs/shared";
import type { MediaType } from "@geeklogs/shared";
import { prisma } from "../lib/prisma.js";
import { getReactionsForLogs } from "../lib/reactions.js";
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
import { InvalidApiKeyError } from "../lib/InvalidApiKeyError.js";
import { isDisableApiKeyRequirementsEnabled } from "../lib/featureFlags.js";
import { getAllReviewerMilestonesForMediumBatch } from "../services/milestone.service.js";

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

const REVIEW_SORT_OPTIONS = ["recent", "oldest", "likes", "dislikes"] as const;
type ReviewSort = (typeof REVIEW_SORT_OPTIONS)[number];

function parseReviewSort(sort: unknown): ReviewSort {
  return REVIEW_SORT_OPTIONS.includes(sort as ReviewSort) ? (sort as ReviewSort) : "recent";
}

/** Fetch review log IDs in order for likes or dislikes sort (raw query). */
async function getReviewLogIdsByReaction(
  mediaType: string,
  externalId: string,
  reactionType: "like" | "dislike",
  skip: number,
  take: number
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT l.id FROM "Log" l
    LEFT JOIN (
      SELECT "logId", COUNT(*)::int as c FROM "LogReaction"
      WHERE type = ${reactionType} GROUP BY "logId"
    ) r ON r."logId" = l.id
    WHERE l."mediaType" = ${mediaType} AND l."externalId" = ${externalId} AND l.grade IS NOT NULL
    ORDER BY COALESCE(r.c, 0) DESC, l."createdAt" DESC
    LIMIT ${take} OFFSET ${skip}
  `;
  return rows.map((r) => r.id);
}

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
  const skipApiKeyUX = await isDisableApiKeyRequirementsEnabled();

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
    if (err instanceof InvalidApiKeyError) {
      if (skipApiKeyUX) {
        console.error("Progress options error (INVALID_API_KEY UX disabled by feature flag):", err);
        return res.status(502).json({ error: "Failed to load options" });
      }
      const userHadKey =
        err.provider === "tmdb"
          ? !!keys?.tmdbApiKey
          : err.provider === "comicvine"
            ? !!keys?.comicVineApiKey
            : false;
      if (userHadKey) {
        return res.status(400).json({
          error: "Invalid API key",
          code: "INVALID_API_KEY",
          provider: err.provider,
        });
      }
    }
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
  const sort = parseReviewSort(req.query.sort);
  const where = { mediaType, externalId };
  const whereWithGrade = { ...where, grade: { not: null } };
  const currentUserId = req.user?.userId ?? null;
  const skip = (reviewsPage - 1) * reviewsLimit;

  const [reviewsTotal, gradeAgg, logs] = await Promise.all([
    prisma.log.count({ where: whereWithGrade }),
    prisma.log.aggregate({
      where: whereWithGrade,
      _avg: { grade: true },
      _count: { grade: true },
    }),
    (async () => {
      if (sort === "likes" || sort === "dislikes") {
        const orderedIds = await getReviewLogIdsByReaction(
          mediaType,
          externalId,
          sort === "likes" ? "like" : "dislike",
          skip,
          reviewsLimit
        );
        if (orderedIds.length === 0) return [];
        const byId = new Map(
          (
            await prisma.log.findMany({
              where: { id: { in: orderedIds } },
              include: { user: { select: { email: true, username: true, tier: true } } },
            })
          ).map((l) => [l.id, l])
        );
        return orderedIds.map((id) => byId.get(id)).filter(Boolean) as Awaited<
          ReturnType<typeof prisma.log.findMany<{ include: { user: { select: { email: true; username: true; tier: true } } } }>>
        >;
      }
      return prisma.log.findMany({
        where: whereWithGrade,
        include: { user: { select: { email: true, username: true, tier: true } } },
        orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
        skip,
        take: reviewsLimit,
      });
    })(),
  ]);

  const meanGrade =
    gradeAgg._count.grade > 0 && gradeAgg._avg.grade != null
      ? gradeAgg._avg.grade
      : null;

  const logIds = logs.map((l) => l.id);
  const [reactionMap, reviewerBadgesMap] = await Promise.all([
    getReactionsForLogs(logIds, currentUserId),
    getAllReviewerMilestonesForMediumBatch(logs.map((l) => l.userId), mediaType),
  ]);

  const reviews = logs.map((l) => {
    const stats = reactionMap.get(l.id);
    const { badges, count: reviewerReviewsInCategory } = reviewerBadgesMap.get(l.userId) ?? { badges: [] as { label: string; icon: string; level: number }[], count: 0 };
    const last = badges.length > 0 ? badges[badges.length - 1]! : null;
    return {
      id: l.id,
      userEmail: l.user.email,
      reviewerUsername: l.user.username ?? null,
      isPro: l.user.tier === "pro",
      isAdmin: l.user.tier === "admin",
      reviewerBadges: last ? [last] : [],
      reviewerLevel: last?.level ?? undefined,
      reviewerLevelLabel: last?.label,
      reviewerLevelIcon: last?.icon,
      reviewerReviewsInCategory,
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
      likesCount: stats?.likesCount ?? 0,
      dislikesCount: stats?.dislikesCount ?? 0,
      userReaction: stats?.userReaction ?? null,
    };
  });

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
  const reviewsSort = parseReviewSort(req.query.reviewsSort ?? req.query.sort);
  const keys = req.user ? await getUserKeys(req.user.userId) : undefined;
  const currentUserId = req.user?.userId ?? null;
  const skipApiKeyUX = await isDisableApiKeyRequirementsEnabled();

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
    if (err instanceof InvalidApiKeyError) {
      if (skipApiKeyUX) {
        console.error("Item fetch error (INVALID_API_KEY UX disabled by feature flag):", err);
        return res.status(502).json({ error: "Item fetch failed" });
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
    console.error("Item fetch error:", err);
  }

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const where = { mediaType, externalId };
  const whereWithGrade = { ...where, grade: { not: null } };

  const reviewsSkip = (reviewsPage - 1) * reviewsLimit;
  const [reviewsTotal, gradeAgg, logs] = await Promise.all([
    prisma.log.count({ where: whereWithGrade }),
    prisma.log.aggregate({
      where: whereWithGrade,
      _avg: { grade: true },
      _count: { grade: true },
    }),
    reviewsLimit === 0
      ? Promise.resolve([])
      : (async () => {
          if (reviewsSort === "likes" || reviewsSort === "dislikes") {
            const orderedIds = await getReviewLogIdsByReaction(
              mediaType,
              externalId,
              reviewsSort === "likes" ? "like" : "dislike",
              reviewsSkip,
              reviewsLimit
            );
            if (orderedIds.length === 0) return [];
            const byId = new Map(
              (
                await prisma.log.findMany({
                  where: { id: { in: orderedIds } },
                  include: { user: { select: { email: true, username: true, tier: true } } },
                })
              ).map((l) => [l.id, l])
            );
            return orderedIds.map((id) => byId.get(id)).filter(Boolean) as Awaited<
              ReturnType<typeof prisma.log.findMany<{ include: { user: { select: { email: true; username: true; tier: true } } } }>>
            >;
          }
          return prisma.log.findMany({
            where: whereWithGrade,
            include: { user: { select: { email: true, username: true, tier: true } } },
            orderBy: { createdAt: reviewsSort === "oldest" ? "asc" : "desc" },
            skip: reviewsSkip,
            take: reviewsLimit,
          });
        })(),
  ]);

  const meanGrade =
    gradeAgg._count.grade > 0 && gradeAgg._avg.grade != null
      ? gradeAgg._avg.grade
      : null;

  const logIds = logs.map((l) => l.id);
  const [reactionMap, reviewerBadgesMap] = await Promise.all([
    getReactionsForLogs(logIds, currentUserId),
    getAllReviewerMilestonesForMediumBatch(logs.map((l) => l.userId), mediaType),
  ]);

  const reviews = logs.map((l) => {
    const stats = reactionMap.get(l.id);
    const { badges, count: reviewerReviewsInCategory } = reviewerBadgesMap.get(l.userId) ?? { badges: [] as { label: string; icon: string; level: number }[], count: 0 };
    const last = badges.length > 0 ? badges[badges.length - 1]! : null;
    return {
      id: l.id,
      userEmail: l.user.email,
      reviewerUsername: l.user.username ?? null,
      isPro: l.user.tier === "pro",
      isAdmin: l.user.tier === "admin",
      reviewerBadges: last ? [last] : [],
      reviewerLevel: last?.level ?? undefined,
      reviewerLevelLabel: last?.label,
      reviewerLevelIcon: last?.icon,
      reviewerReviewsInCategory,
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
      likesCount: stats?.likesCount ?? 0,
      dislikesCount: stats?.dislikesCount ?? 0,
      userReaction: stats?.userReaction ?? null,
    };
  });

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
