import { Router } from "express";
import { decodeHtmlEntities, MEDIA_TYPES, resolveAnimeMangaTitleLanguage } from "@geeklogs/shared";
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
import { tierHasProFeatures } from "../lib/userTier.js";
import { getAllReviewerMilestonesForMediumBatch } from "../services/milestone.service.js";
import { loadItemReviewsPaginated } from "../lib/itemReviews.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import {
  getItemPayloadCached,
  scheduleItemPayloadCacheRefresh,
  setItemPayloadCached,
} from "../lib/responseCache.js";
import { createRouteTimer } from "../lib/routeTiming.js";
import { withAnimeMangaTitlePreference } from "../lib/animeMangaItemTitle.js";

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
      animeMangaTitleLanguage: true,
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
      const seasonEps = await mapWithConcurrency(seasons, 4, async (sn) => {
        const eps = await getTvSeasonEpisodeNumbers(externalId, sn, keys?.tmdbApiKey);
        return {
          sn: String(sn),
          eps: eps.length > 0 ? eps : Array.from({ length: 24 }, (_, i) => i + 1),
        };
      });
      const episodesBySeason: Record<string, number[]> = {};
      for (const { sn, eps } of seasonEps) {
        episodesBySeason[sn] = eps;
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
  const currentUserId = req.user?.userId ?? null;
  const skip = (reviewsPage - 1) * reviewsLimit;

  const { reviews, reviewsTotal, meanGrade } = await loadItemReviewsPaginated(
    prisma,
    mediaType,
    externalId,
    { sort, skip, take: reviewsLimit, currentUserId }
  );

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

  const timer = createRouteTimer();
  const cachedItem = await timer.trackDb(() => getItemPayloadCached(prisma, mediaType, externalId));

  const fetchUpstreamItem = async () => {
    switch (mediaType) {
      case "movies":
        return getMovieById(externalId, keys?.tmdbApiKey);
      case "tv":
        return getTvById(externalId, keys?.tmdbApiKey);
      case "boardgames": {
        let boardProvider: "bgg" | "ludopedia" =
          keys?.boardGameProvider === "ludopedia" ? "ludopedia" : "bgg";
        if (req.user) {
          const logWithSource = await prisma.log.findFirst({
            where: { userId: req.user.userId, mediaType: "boardgames", externalId },
            select: { boardGameSource: true },
          });
          if (logWithSource?.boardGameSource === "bgg" || logWithSource?.boardGameSource === "ludopedia")
            boardProvider = logWithSource.boardGameSource;
        }
        boardProviderUsed = boardProvider;
        const bg =
          boardProvider === "ludopedia"
            ? await getBoardGameByIdLudopedia(externalId, keys?.ludopediaApiToken)
            : await getBoardGameById(externalId, keys?.bggApiToken);
        if (bg) (bg as { itemSource?: "bgg" | "ludopedia" }).itemSource = boardProvider;
        return bg;
      }
      case "games":
        return getGameById(externalId, keys?.rawgApiKey);
      case "books":
        return getBookById(externalId);
      case "anime":
        return getAnimeById(externalId);
      case "manga":
        return getMangaById(externalId);
      case "comics":
        return getVolumeById(externalId, keys?.comicVineApiKey);
      default:
        return null;
    }
  };

  let item = cachedItem && (cachedItem.fresh || cachedItem.stale) ? cachedItem.data : null;
  if (cachedItem?.stale) {
    timer.setCacheHit(true);
    scheduleItemPayloadCacheRefresh(prisma, mediaType, externalId, fetchUpstreamItem);
  } else if (cachedItem?.fresh) {
    timer.setCacheHit(true);
  }

  try {
    if (!item) {
      item = await timer.trackExternal(fetchUpstreamItem);
      if (item) {
        void setItemPayloadCached(prisma, mediaType, externalId, item);
      }
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

  const reviewsSkip = (reviewsPage - 1) * reviewsLimit;
  const { reviews, reviewsTotal, meanGrade } =
    reviewsLimit === 0
      ? { reviews: [], reviewsTotal: 0, meanGrade: null }
      : await loadItemReviewsPaginated(prisma, mediaType, externalId, {
          sort: reviewsSort,
          skip: reviewsSkip,
          take: reviewsLimit,
          currentUserId,
        });

  const logWithImage = await prisma.log.findFirst({
    where: { mediaType, externalId, image: { not: null } },
    select: { image: true },
  });
  const itemImage =
    item.image ?? item.thumbnail ?? (logWithImage?.image as string | null) ?? null;

  const responseItem =
    mediaType === "anime" || mediaType === "manga"
      ? withAnimeMangaTitlePreference(
          item,
          resolveAnimeMangaTitleLanguage(keys?.animeMangaTitleLanguage)
        )
      : item;

  timer.finish(res, { provider: mediaType });
  res.json({
    item: {
      ...responseItem,
      image: itemImage,
    },
    reviews,
    meanGrade: meanGrade != null ? Math.round(meanGrade * 10) / 10 : null,
    reviewsTotal,
    reviewsPage,
    reviewsLimit: reviewsLimit === 0 ? DEFAULT_REVIEWS_LIMIT : reviewsLimit,
  });
});
