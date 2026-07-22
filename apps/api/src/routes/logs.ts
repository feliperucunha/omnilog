import { Router } from "express";
import { z } from "zod";
import {
  COMPLETED_STATUSES,
  IN_PROGRESS_STATUSES,
  LIST_TYPES,
  LOG_STATUS_OPTIONS,
  MEDIA_TYPES,
  SPEND_TRACKED_MEDIA_TYPES,
  DEFAULT_BOARD_GAME_SESSION_DURATION_HOURS,
  isBoardGameSessionDurationHours,
  decodeHtmlEntities,
} from "@geeklogs/shared";
import type { BoardGameMatchPlayer, MediaType } from "@geeklogs/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  sanitizeReview,
  sanitizeText,
  sanitizeUrl,
  TITLE_MAX_LENGTH,
  EXTERNAL_ID_MAX_LENGTH,
  SEARCH_QUERY_MAX_LENGTH,
} from "../lib/sanitize.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js";
import type { NewBadge } from "../services/gamification.service.js";

export const logsRouter = Router();
logsRouter.use(authMiddleware);

const optionalInt = z.number().int().min(0).nullable().optional();
const GAME_PLATFORM_MAX_LENGTH = 80;

const optionalManualDate = z
  .string()
  .max(40)
  .nullable()
  .optional();

function parseManualLogDate(value: string): Date | null {
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

const optionalFloat = z.number().min(0).nullable().optional();

const genresSchema = z.array(z.string().min(1).max(80)).max(20).optional().nullable();
const mechanicsSchema = z.array(z.string().min(1).max(80)).max(20).optional().nullable();
const affinityContextSchema = logAffinityContextSchema.optional().nullable();

const createLogSchema = z.object({
  mediaType: z.enum(MEDIA_TYPES as unknown as [string, ...string[]]),
  externalId: z.string().min(1).max(EXTERNAL_ID_MAX_LENGTH),
  title: z.string().min(1).max(TITLE_MAX_LENGTH),
  image: z.string().url().max(2048).nullable().optional(),
  grade: z.number().min(0).max(10).nullable().optional(),
  review: z.string().nullable().optional(),
  listType: z.enum(LIST_TYPES as unknown as [string, ...string[]]).nullable().optional(),
  status: z.string().nullable().optional(),
  season: optionalInt,
  episode: optionalInt,
  chapter: optionalInt,
  volume: optionalInt,
  pagesRead: optionalInt,
  gamePlatform: z.string().max(GAME_PLATFORM_MAX_LENGTH).nullable().optional(),
  startedAt: optionalManualDate,
  completedAt: optionalManualDate,
  contentHours: optionalFloat,
  hoursToBeat: optionalFloat,
  genres: genresSchema,
  mechanics: mechanicsSchema,
  affinityContext: affinityContextSchema,
  boardGameSource: z.enum(["bgg", "ludopedia"]).nullable().optional(),
  own: z.boolean().nullable().optional(),
  wantToBuy: z.boolean().nullable().optional(),
  sold: z.boolean().nullable().optional(),
  matchesPlayed: z.number().int().min(0).nullable().optional(),
  purchaseAmountMinor: z.number().int().min(0).max(999_999_999_999).nullable().optional(),
  purchaseCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Za-z]{3}$/)
    .nullable()
    .optional()
    .transform((s) => (s == null ? null : s.toUpperCase())),
  saleAmountMinor: z.number().int().min(0).max(999_999_999_999).nullable().optional(),
  saleCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Za-z]{3}$/)
    .nullable()
    .optional()
    .transform((s) => (s == null ? null : s.toUpperCase())),
});

const PLAYER_NAME_MAX = 80;

const boardGameMatchPlayerSchema = z.object({
  name: z.string().min(1).max(PLAYER_NAME_MAX),
  score: z.number().finite().nullable().optional(),
  winner: z.boolean(),
  /** When set, server resolves `name` from this user’s username. */
  appUserId: z.string().min(1).max(40).optional().nullable(),
});

const createBoardGameMatchBodySchema = z.object({
  playedAt: z.string().min(1).max(40),
  durationHours: z.number().optional(),
  players: z.array(boardGameMatchPlayerSchema).min(1).max(16),
  notes: z.string().max(50000).optional().nullable(),
});

function parseBoardGamePlayersJson(json: string): BoardGameMatchPlayer[] {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    const out: BoardGameMatchPlayer[] = [];
    for (const row of raw) {
      if (row == null || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name : "";
      if (!name) continue;
      const winner = Boolean(o.winner);
      let score: number | null = null;
      if (typeof o.score === "number" && Number.isFinite(o.score)) score = o.score;
      else if (o.score === null) score = null;
      let appUserId: string | null | undefined;
      if (typeof o.appUserId === "string" && o.appUserId.trim().length > 0) {
        appUserId = o.appUserId.trim();
      } else if (o.appUserId === null) {
        appUserId = null;
      }
      out.push({ name, score, winner, ...(appUserId !== undefined ? { appUserId } : {}) });
    }
    return out;
  } catch {
    return [];
  }
}

function serializeBoardGameMatchRow(row: {
  id: string;
  logId: string;
  playedAt: Date;
  durationHours: number;
  players: string;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    logId: row.logId,
    playedAt: row.playedAt.toISOString(),
    durationHours: row.durationHours,
    players: parseBoardGamePlayersJson(row.players),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

const updateLogSchema = z.object({
  image: z.string().url().max(2048).nullable().optional(),
  grade: z.number().min(0).max(10).nullable().optional(),
  review: z.string().nullable().optional(),
  listType: z.enum(LIST_TYPES as unknown as [string, ...string[]]).nullable().optional(),
  status: z.string().nullable().optional(),
  season: optionalInt,
  episode: optionalInt,
  chapter: optionalInt,
  volume: optionalInt,
  pagesRead: optionalInt,
  gamePlatform: z.string().max(GAME_PLATFORM_MAX_LENGTH).nullable().optional(),
  startedAt: optionalManualDate,
  completedAt: optionalManualDate,
  contentHours: optionalFloat,
  hoursToBeat: optionalFloat,
  genres: genresSchema,
  mechanics: mechanicsSchema,
  affinityContext: affinityContextSchema,
  own: z.boolean().nullable().optional(),
  wantToBuy: z.boolean().nullable().optional(),
  sold: z.boolean().nullable().optional(),
  matchesPlayed: z.number().int().min(0).nullable().optional(),
  purchaseAmountMinor: z.number().int().min(0).max(999_999_999_999).nullable().optional(),
  purchaseCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Za-z]{3}$/)
    .nullable()
    .optional()
    .transform((s) => (s == null ? null : s.toUpperCase())),
  saleAmountMinor: z.number().int().min(0).max(999_999_999_999).nullable().optional(),
  saleCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Za-z]{3}$/)
    .nullable()
    .optional()
    .transform((s) => (s == null ? null : s.toUpperCase())),
});

function validateStatus(mediaType: MediaType, status: string | null | undefined): boolean {
  if (status == null || status === "") return true;
  const allowed = LOG_STATUS_OPTIONS[mediaType];
  return allowed.includes(status);
}

function isInProgress(status: string | null | undefined): boolean {
  return status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
}

function isCompleted(status: string | null | undefined): boolean {
  return status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
}

function isSpendTrackedMediaType(mt: MediaType): boolean {
  return (SPEND_TRACKED_MEDIA_TYPES as readonly string[]).includes(mt);
}

/** own / wantToBuy / sold are mutually exclusive for spend-tracked media. */
function reconcileSpendTrackedOwnership(
  mediaType: MediaType,
  patch: { own?: boolean | null; wantToBuy?: boolean | null; sold?: boolean | null },
  current: { own: boolean | null; wantToBuy: boolean | null; sold: boolean | null } | null
): { own: boolean | null; wantToBuy: boolean | null; sold: boolean | null } | null {
  if (!isSpendTrackedMediaType(mediaType)) return null;
  const touched =
    patch.own !== undefined || patch.wantToBuy !== undefined || patch.sold !== undefined;
  if (!touched && current == null) return { own: false, wantToBuy: false, sold: false };
  if (!touched) return null;
  const o = patch.own !== undefined ? patch.own === true : current?.own === true;
  const w = patch.wantToBuy !== undefined ? patch.wantToBuy === true : current?.wantToBuy === true;
  const s = patch.sold !== undefined ? patch.sold === true : current?.sold === true;
  if (s) return { own: false, wantToBuy: false, sold: true };
  if (o) return { own: true, wantToBuy: false, sold: false };
  if (w) return { own: false, wantToBuy: true, sold: false };
  return { own: false, wantToBuy: false, sold: false };
}

function mergeLogWhere(base: Prisma.LogWhereInput, extra: Prisma.LogWhereInput): Prisma.LogWhereInput {
  return { AND: [base, extra] };
}

function parseStatsMediaTypeFilter(query: Record<string, unknown>): MediaType | undefined {
  const raw = typeof query.mediaType === "string" ? query.mediaType.trim() : "";
  if (!raw) return undefined;
  if (MEDIA_TYPES.includes(raw as MediaType)) return raw as MediaType;
  return undefined;
}

function applyStatsMediaFilter(where: Prisma.LogWhereInput, mediaType?: MediaType): Prisma.LogWhereInput {
  return mediaType ? mergeLogWhere(where, { mediaType }) : where;
}

import { persistUserDefaultPurchaseCurrency } from "../lib/userPurchasePreference.js";
import { parseGenresJson, serializeLog } from "../lib/serializeLog.js";
import { attachItemEnrichment, attachItemEnrichmentSingle } from "../lib/itemDetailEnrichment.js";
import { enrichLogsForClient } from "../lib/attachScopedReviews.js";
import {
  computeGenreFacets,
  fetchLogsWithGenreFilter,
  LOG_GENRE_FILTER_MAX_LENGTH,
  logHasGenreExact,
} from "../lib/logGenreList.js";
import { stringifyLogAffinityContext, logAffinityContextSchema, parseLogAffinityContextJson } from "../lib/logAffinityContext.js";
import { boardGameAverageWeightFromAffinity } from "../lib/boardGameWeight.js";
import { ensureBoardGameWeightsForSort, isBoardGameWeightSort, resortLogsByWeight } from "../lib/backfillBoardGameWeight.js";
import { hoursFromCompletedLogForStats, rollupHoursFromCompletedLogs } from "../lib/completedLogHours.js";

async function enrichListLogsForClient(
  logs: ReturnType<typeof serializeLog>[],
  sort: string
) {
  const enriched = await enrichLogsForClient(prisma, logs);
  return isBoardGameWeightSort(sort) ? resortLogsByWeight(enriched, sort) : enriched;
}
import { attachBoardGameSessionHours } from "../lib/boardGameSessionHours.js";
import { syncTaggedPlayersBoardGameLogs } from "../lib/boardGameTaggedPlayerSync.js";
import {
  boardGameWeightHistogramEntries,
  boardGameWeightScopeWhere,
  binBoardGameWeight,
  countBoardGameWinsForStats,
  gamePlatformStatsForUser,
  isReadingMediaType,
  parseBoardGameWeightBin,
  parseBoardGameWeightScope,
  READING_MEDIA_TYPES,
  recentBoardGamesForStats,
  sumAllPagesReadForStats,
  sumMetricByPeriod,
  sumPagesReadForStats,
} from "../lib/statsCategoryMetrics.js";
import { tierHasProFeatures, tierHasUnlimitedLogs } from "../lib/userTier.js";
import { getReactionsForLogs } from "../lib/reactions.js";
import {
  handleLogCreated,
  handleReviewCreated,
  handleReviewRemoved,
  handleReviewLiked,
  countsAsReviewForGamification,
} from "../services/gamification.service.js";
import {
  normalizePurchaseFields,
  normalizeSaleFields,
  purchaseLogCreatedAtRange,
  localDayBoundsFromDateString,
  logSpendStatsDateWhere,
  spendMonetarySnapshotFromLog,
  spendFieldsAtAfterSnapshotChange,
  spendMonetaryHasAny,
  type PurchasePeriod,
} from "../lib/purchaseFields.js";
import {
  completedAtBoundsForStatsPeriod,
  freeTierStatisticsMonthRange,
  freeTierStatisticsMonthWhere,
} from "../lib/statisticsScope.js";

const FREE_LOG_LIMIT = 500;

const PAGINATION_LIMIT_DEFAULT = 25;
const PAGINATION_LIMIT_MAX = 100;
/** Recap list: allow a larger page than normal log pagination (still capped server-side). */
const RECAP_LIMIT_MAX = 400;

/** GET /logs/counts - Per-category log counts for tab labels. Returns { data: { [mediaType]: number } }. */
logsRouter.get("/counts", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const counts = await prisma.log.groupBy({
    by: ["mediaType"],
    where: { userId },
    _count: { id: true },
  });
  const data = Object.fromEntries(
    MEDIA_TYPES.map((t) => [t, counts.find((c) => c.mediaType === t)?._count.id ?? 0])
  ) as Record<MediaType, number>;
  res.json({ data });
});

/** GET /logs/status-counts?mediaType=X - Per-status counts for one category (for filter labels). Returns { data: { total, byStatus } }. */
logsRouter.get("/status-counts", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const mediaType = req.query.mediaType as MediaType | undefined;
  if (!mediaType || !MEDIA_TYPES.includes(mediaType)) {
    res.status(400).json({ error: "mediaType required and must be a valid media type" });
    return;
  }
  const [rows, genreRows] = await Promise.all([
    prisma.log.groupBy({
      by: ["status"],
      where: { userId, mediaType },
      _count: { id: true },
    }),
    prisma.log.findMany({
      where: {
        userId,
        mediaType,
        genres: { not: null },
        NOT: { genres: "" },
      },
      select: { id: true, genres: true },
    }),
  ]);
  let total = 0;
  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    const key = row.status ?? "";
    byStatus[key] = row._count.id;
    total += row._count.id;
  }
  const byGenre = computeGenreFacets(genreRows);
  if (isSpendTrackedMediaType(mediaType)) {
    const [owned, wantToBuy] = await Promise.all([
      prisma.log.count({ where: { userId, mediaType, own: true } }),
      prisma.log.count({ where: { userId, mediaType, wantToBuy: true } }),
    ]);
    res.json({ data: { total, byStatus, owned, wantToBuy, byGenre } });
    return;
  }
  res.json({ data: { total, byStatus, byGenre } });
});

logsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const mediaType = req.query.mediaType as MediaType | undefined;
  const externalId = req.query.externalId as string | undefined;
  const status = req.query.status as string | undefined;
  const sortParam = req.query.sort as string;
  const validSorts = ["dateAsc", "dateDesc", "gradeAsc", "gradeDesc"] as const;
  const boardgameSorts = ["matchesPlayedAsc", "matchesPlayedDesc", "weightAsc", "weightDesc"] as const;
  const gameSorts = ["timeToBeatAsc", "timeToBeatDesc"] as const;
  let sort = validSorts.includes(sortParam as (typeof validSorts)[number]) ? sortParam : "dateDesc";
  if (mediaType === "boardgames" && boardgameSorts.includes(sortParam as (typeof boardgameSorts)[number])) sort = sortParam;
  else if (mediaType === "games" && gameSorts.includes(sortParam as (typeof gameSorts)[number])) sort = sortParam;
  const ownFilter = req.query.own === "true";
  const wantToBuyFilter = req.query.wantToBuy === "true";
  const purchasedFilter = req.query.purchased === "true" || req.query.purchased === "1";
  const forStatistics =
    req.query.forStatistics === "1" || req.query.forStatistics === "true";
  const recapFlag = req.query.recap === "1" || req.query.recap === "true";
  const limitParam = req.query.limit != null ? parseInt(String(req.query.limit), 10) : NaN;
  const effectivePaginationMax = recapFlag ? RECAP_LIMIT_MAX : PAGINATION_LIMIT_MAX;
  const usePagination =
    Number.isInteger(limitParam) && limitParam >= 1 && limitParam <= effectivePaginationMax;
  const takeSize = usePagination ? Math.min(limitParam, effectivePaginationMax) : undefined;
  const cursorId = typeof req.query.cursor === "string" && req.query.cursor.length > 0 ? req.query.cursor : undefined;

  const tzRawList = req.query.timezoneOffsetMinutes;
  const tzOffsetMinutesList =
    typeof tzRawList === "string" && tzRawList !== "" && Number.isFinite(parseInt(tzRawList, 10))
      ? parseInt(tzRawList, 10)
      : 0;

  let statisticsMonthWhereFree: Prisma.LogWhereInput | undefined;
  let isFreeTierForList = false;
  let hasProFeaturesForList = false;
  if (forStatistics || purchasedFilter || recapFlag) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });
    hasProFeaturesForList = u != null && tierHasProFeatures(u.tier);
    isFreeTierForList = u != null && !hasProFeaturesForList;
    if (forStatistics && isFreeTierForList) {
      statisticsMonthWhereFree = freeTierStatisticsMonthWhere(tzOffsetMinutesList);
    }
  }

  if (recapFlag) {
    if (!usePagination || takeSize == null) {
      res.status(400).json({ error: "Recap requires limit between 1 and 400." });
      return;
    }
  }

  let where: Prisma.LogWhereInput = { userId };
  if (mediaType && MEDIA_TYPES.includes(mediaType)) where.mediaType = mediaType;
  if (externalId) {
    const safe = sanitizeText(externalId, EXTERNAL_ID_MAX_LENGTH);
    if (safe) where.externalId = safe;
  }
  if (status != null && status !== "") {
    if (mediaType && MEDIA_TYPES.includes(mediaType)) {
      const allowed = LOG_STATUS_OPTIONS[mediaType];
      if (allowed.includes(status)) where.status = status;
    } else {
      where.status = status;
    }
  }
  if (mediaType && isSpendTrackedMediaType(mediaType)) {
    if (ownFilter) where.own = true;
    if (wantToBuyFilter) where.wantToBuy = true;
  }
  if (purchasedFilter) {
    where.OR = [
      { AND: [{ purchaseAmountMinor: { not: null } }, { purchaseCurrency: { not: null } }] },
      { AND: [{ saleAmountMinor: { not: null } }, { saleCurrency: { not: null } }] },
    ];
    if (isFreeTierForList) {
      const range = purchaseLogCreatedAtRange("month", tzOffsetMinutesList);
      if (range) where = mergeLogWhere(where, logSpendStatsDateWhere(range));
    } else {
      const dateRaw = typeof req.query.purchaseDate === "string" ? req.query.purchaseDate.trim() : "";
      if (dateRaw !== "") {
        const tzRaw = req.query.timezoneOffsetMinutes;
        const tzOffsetMinutes =
          typeof tzRaw === "string" && tzRaw !== "" && Number.isFinite(parseInt(tzRaw, 10))
            ? parseInt(tzRaw, 10)
            : 0;
        const bounds = localDayBoundsFromDateString(dateRaw, tzOffsetMinutes);
        if (bounds) where = mergeLogWhere(where, logSpendStatsDateWhere(bounds));
      } else {
        const spendPeriodRaw = typeof req.query.spendPeriod === "string" ? req.query.spendPeriod.trim() : "";
        const validPeriods: PurchasePeriod[] = ["month", "year", "all"];
        if (validPeriods.includes(spendPeriodRaw as PurchasePeriod)) {
          const tzRaw = req.query.timezoneOffsetMinutes;
          const tzOffsetMinutes =
            typeof tzRaw === "string" && tzRaw !== "" && Number.isFinite(parseInt(tzRaw, 10))
              ? parseInt(tzRaw, 10)
              : 0;
          const range = purchaseLogCreatedAtRange(spendPeriodRaw as PurchasePeriod, tzOffsetMinutes);
          if (range) where = mergeLogWhere(where, logSpendStatsDateWhere(range));
        }
      }
    }
  }

  const titleSearch = sanitizeText(
    typeof req.query.q === "string" ? req.query.q : "",
    SEARCH_QUERY_MAX_LENGTH
  );
  if (titleSearch) {
    where.title = { contains: titleSearch, mode: "insensitive" };
  }

  const genreFilter = sanitizeText(
    typeof req.query.genre === "string" ? req.query.genre : "",
    LOG_GENRE_FILTER_MAX_LENGTH
  );

  const playersFilterRaw =
    mediaType === "boardgames" && typeof req.query.players === "string"
      ? req.query.players.trim()
      : "";
  if (playersFilterRaw) {
    const selectedCounts = playersFilterRaw
      .split(",")
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n) && n >= 1);
    if (selectedCounts.length > 0) {
      const cacheConditions: Prisma.ItemDetailCacheWhereInput[] = selectedCounts.map((count) => {
        if (count >= 6) return { playersMax: { gte: 6 } };
        return { playersMin: { lte: count }, playersMax: { gte: count } };
      });
      const matchingItems = await prisma.itemDetailCache.findMany({
        where: { mediaType: "boardgames", OR: cacheConditions },
        select: { externalId: true },
      });
      const matchingExternalIds = [...new Set(matchingItems.map((i) => i.externalId))];
      if (matchingExternalIds.length === 0) {
        if (usePagination) {
          res.json({ data: [], nextCursor: null });
        } else {
          res.json([]);
        }
        return;
      }
      where.externalId = { in: matchingExternalIds };
    }
  }

  if (statisticsMonthWhereFree) {
    where = mergeLogWhere(where, statisticsMonthWhereFree);
  }

  if (recapFlag) {
    const recapPeriodRaw =
      typeof req.query.recapPeriod === "string" ? req.query.recapPeriod.trim().toLowerCase() : "";
    const recapPeriods = ["week", "month", "year"] as const;
    if (!recapPeriods.includes(recapPeriodRaw as (typeof recapPeriods)[number])) {
      res.status(400).json({ error: "Invalid recapPeriod (use week, month, or year)." });
      return;
    }
    const recapPeriod = recapPeriodRaw as (typeof recapPeriods)[number];
    const fromRaw = typeof req.query.updatedFrom === "string" ? req.query.updatedFrom.trim() : "";
    const toRaw = typeof req.query.updatedTo === "string" ? req.query.updatedTo.trim() : "";
    if (!fromRaw || !toRaw) {
      res.status(400).json({ error: "Recap requires updatedFrom and updatedTo (ISO 8601)." });
      return;
    }
    const fromD = new Date(fromRaw);
    const toD = new Date(toRaw);
    if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime()) || fromD > toD) {
      res.status(400).json({ error: "Invalid recap date range." });
      return;
    }
    const spanMs = toD.getTime() - fromD.getTime();
    const maxSpanFreeMs = 10 * 24 * 60 * 60 * 1000;
    const maxSpanProMs = 370 * 24 * 60 * 60 * 1000;
    if (!hasProFeaturesForList) {
      if (recapPeriod !== "week") {
        res.status(403).json({ error: "Recap beyond last week requires Pro.", code: "PRO_REQUIRED" });
        return;
      }
      if (spanMs > maxSpanFreeMs) {
        res.status(400).json({ error: "Recap date range too wide for the current plan." });
        return;
      }
    } else if (spanMs > maxSpanProMs) {
      res.status(400).json({ error: "Recap date range too wide." });
      return;
    }
    where = mergeLogWhere(where, { updatedAt: { gte: fromD, lte: toD } });
  }

  const orderBy: Prisma.LogOrderByWithRelationInput[] | Prisma.LogOrderByWithRelationInput =
    sort === "matchesPlayedDesc"
      ? [{ matchesPlayed: "desc" }, { updatedAt: "desc" }]
      : sort === "matchesPlayedAsc"
        ? [{ matchesPlayed: "asc" }, { updatedAt: "desc" }]
        : sort === "weightDesc"
          ? [{ averageWeight: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }]
          : sort === "weightAsc"
            ? [{ averageWeight: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }]
            : sort === "timeToBeatDesc"
          ? [{ hoursToBeat: "desc" }, { updatedAt: "desc" }]
          : sort === "timeToBeatAsc"
            ? [{ hoursToBeat: "asc" }, { updatedAt: "desc" }]
            : sort === "gradeDesc"
              ? [{ grade: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }]
              : sort === "gradeAsc"
                ? [{ grade: { sort: "asc", nulls: "last" } }, { updatedAt: "asc" }]
                : sort === "dateDesc"
                  ? { updatedAt: "desc" }
                  : { updatedAt: "asc" };

  if (isBoardGameWeightSort(sort)) {
    await ensureBoardGameWeightsForSort(prisma, userId, mediaType);
  }

  if (genreFilter) {
    if (usePagination && takeSize != null) {
      const result = await fetchLogsWithGenreFilter(prisma, {
        where,
        sort,
        genre: genreFilter,
        takeSize,
        cursorId,
        usePagination: true,
      });
      if (Array.isArray(result)) {
        res.json(await enrichListLogsForClient(result, sort));
      } else {
        const enriched = await enrichListLogsForClient(result.data, sort);
        res.json({ data: enriched, nextCursor: result.nextCursor });
      }
      return;
    }
    const data = await fetchLogsWithGenreFilter(prisma, {
      where,
      sort,
      genre: genreFilter,
      takeSize: PAGINATION_LIMIT_MAX,
      cursorId: undefined,
      usePagination: false,
    });
    if (Array.isArray(data)) {
      res.json(await enrichListLogsForClient(data, sort));
    } else {
      const enriched = await enrichListLogsForClient(data.data, sort);
      res.json({ data: enriched, nextCursor: data.nextCursor });
    }
    return;
  }

  if (usePagination && takeSize != null) {
    const take = takeSize + 1;
    const logs = await prisma.log.findMany({
      where,
      orderBy,
      take,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    const hasMore = logs.length > takeSize;
    const data = (hasMore ? logs.slice(0, takeSize) : logs).map(serializeLog);
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;
    const enriched = await enrichListLogsForClient(data, sort);
    res.json({ data: enriched, nextCursor });
    return;
  }

  const logs = await prisma.log.findMany({
    where,
    orderBy,
  });
  const enriched = await enrichListLogsForClient(logs.map(serializeLog), sort);
  res.json(enriched);
});

/** GET /logs/feed - Up to 5 recent logs from followed users, ordered by startedAt desc (for Social section). Optional ?userId= to filter by one friend. */
logsRouter.get("/feed", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const followings = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const followingIds = followings.map((f) => f.followingId);
  if (followingIds.length === 0) {
    res.json({ data: [] });
    return;
  }
  const filterUserId = typeof req.query.userId === "string" ? req.query.userId.trim() : null;
  const userIds = filterUserId && followingIds.includes(filterUserId) ? [filterUserId] : followingIds;
  const rows = await prisma.log.findMany({
    where: { userId: { in: userIds } },
    orderBy: [{ startedAt: "desc" }, { updatedAt: "desc" }],
    take: 5,
    include: {
      user: {
        select: { id: true, username: true },
      },
    },
  });
  const logIds = rows.map((r) => r.id);
  const reactionMap = await getReactionsForLogs(logIds, userId);
  const serializedLogs = rows.map((row) => {
    const { user: _user, ...log } = row;
    const serialized = serializeLog(log) as ReturnType<typeof serializeLog> & {
      likesCount?: number;
      dislikesCount?: number;
      userReaction?: "like" | "dislike" | null;
    };
    const stats = reactionMap.get(row.id);
    if (stats) {
      serialized.likesCount = stats.likesCount;
      serialized.dislikesCount = stats.dislikesCount;
      serialized.userReaction = stats.userReaction ?? null;
    }
    return serialized;
  });
  const enrichedLogs = await enrichLogsForClient(prisma, serializedLogs);
  const data = rows.map((row, idx) => ({
    log: enrichedLogs[idx]!,
    user: {
      id: row.user.id,
      username: row.user.username ?? null,
    },
  }));
  res.json({ data });
});

const setReactionSchema = z.object({ type: z.enum(["like", "dislike"]) });

/** PUT /logs/:id/reaction - Set current user's reaction (like or dislike) on a log. */
logsRouter.put("/:id/reaction", async (req: AuthenticatedRequest, res) => {
  const logId = req.params.id;
  const parsed = setReactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body: type must be 'like' or 'dislike'" });
    return;
  }
  const userId = req.user!.userId;
  const log = await prisma.log.findUnique({
    where: { id: logId },
    select: { id: true, userId: true },
  });
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  await prisma.logReaction.upsert({
    where: { userId_logId: { userId, logId } },
    create: { logId, userId, type: parsed.data.type },
    update: { type: parsed.data.type },
  });
  if (parsed.data.type === "like") {
    handleReviewLiked(logId, log.userId).catch(() => {});
  }
  res.status(204).end();
});

/** DELETE /logs/:id/reaction - Remove current user's reaction. */
logsRouter.delete("/:id/reaction", async (req: AuthenticatedRequest, res) => {
  const logId = req.params.id;
  const userId = req.user!.userId;
  await prisma.logReaction.deleteMany({ where: { logId, userId } });
  res.status(204).end();
});

/** GET /logs/stats?group=summary|category|month|year|genre|completedByMonth|completedByYear|categoryByMonth|categoryByYear|boardGameWeight|pagesReadByMonth|pagesReadByYear|episodesByMonth|episodesByYear&mediaType=optional - summary = account totals; category/month/year rows include { hours, count }; genre uses unique log counts per genre name */
logsRouter.get("/stats", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const statsMediaType = parseStatsMediaTypeFilter(req.query as Record<string, unknown>);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  const fullStatsAccess = user != null && tierHasProFeatures(user.tier);
  const tzRawStats = req.query.timezoneOffsetMinutes;
  const tzOffsetMinutes =
    typeof tzRawStats === "string" && tzRawStats !== "" && Number.isFinite(parseInt(tzRawStats, 10))
      ? parseInt(tzRawStats, 10)
      : 0;
  const freeMonthWhere = fullStatsAccess ? undefined : freeTierStatisticsMonthWhere(tzOffsetMinutes);
  const freeMonthRange = fullStatsAccess ? undefined : freeTierStatisticsMonthRange(tzOffsetMinutes);

  const STATS_GROUPS = new Set([
    "summary",
    "year",
    "genre",
    "category",
    "completedByYear",
    "completedByMonth",
    "categoryByYear",
    "categoryByMonth",
    "purchaseSpending",
    "gamePlatforms",
    "recentBoardGames",
    "boardGameWeight",
    "pagesReadByMonth",
    "pagesReadByYear",
    "episodesByMonth",
    "episodesByYear",
    "month",
  ]);
  const groupParam = typeof req.query.group === "string" ? req.query.group : "month";
  const group = STATS_GROUPS.has(groupParam) ? groupParam : "month";

  if (group === "purchaseSpending") {
    const periodRaw = typeof req.query.period === "string" ? req.query.period.trim() : "month";
    let period: PurchasePeriod =
      periodRaw === "year" || periodRaw === "all" ? periodRaw : "month";
    if (!fullStatsAccess) period = "month";
    const range = purchaseLogCreatedAtRange(period, tzOffsetMinutes);
    const spendPresentWhere: Prisma.LogWhereInput = {
      OR: [
        { AND: [{ purchaseAmountMinor: { not: null } }, { purchaseCurrency: { not: null } }] },
        { AND: [{ saleAmountMinor: { not: null } }, { saleCurrency: { not: null } }] },
      ],
    };
    const dateWhere = logSpendStatsDateWhere(range);
    const purchaseSpendingAnd: Prisma.LogWhereInput[] = [
      { userId },
      statsMediaType
        ? { mediaType: statsMediaType }
        : { mediaType: { in: [...SPEND_TRACKED_MEDIA_TYPES] } },
      spendPresentWhere,
    ];
    if (Object.keys(dateWhere).length > 0) purchaseSpendingAnd.push(dateWhere);
    const logs = await prisma.log.findMany({
      where: { AND: purchaseSpendingAnd },
      select: {
        mediaType: true,
        purchaseAmountMinor: true,
        purchaseCurrency: true,
        saleAmountMinor: true,
        saleCurrency: true,
      },
    });
    const data: Record<string, Record<string, number>> = Object.fromEntries(
      SPEND_TRACKED_MEDIA_TYPES.map((mt) => [mt, {} as Record<string, number>])
    );
    const saleData: Record<string, Record<string, number>> = Object.fromEntries(
      SPEND_TRACKED_MEDIA_TYPES.map((mt) => [mt, {} as Record<string, number>])
    );
    const counts: Record<string, number> = Object.fromEntries(
      SPEND_TRACKED_MEDIA_TYPES.map((mt) => [mt, 0])
    );
    const saleCounts: Record<string, number> = Object.fromEntries(
      SPEND_TRACKED_MEDIA_TYPES.map((mt) => [mt, 0])
    );
    const totalsPurchaseByCur: Record<string, number> = {};
    const totalsSaleByCur: Record<string, number> = {};
    for (const row of logs) {
      const k = row.mediaType as string;
      if (!(k in data)) continue;
      const pn = row.purchaseAmountMinor;
      const pc = row.purchaseCurrency;
      if (pn != null && pc != null) {
        const bucket = data[k];
        bucket[pc] = (bucket[pc] ?? 0) + pn;
        counts[k] = (counts[k] ?? 0) + 1;
        totalsPurchaseByCur[pc] = (totalsPurchaseByCur[pc] ?? 0) + pn;
      }
      const sn = row.saleAmountMinor;
      const sc = row.saleCurrency;
      if (sn != null && sc != null) {
        const sb = saleData[k];
        sb[sc] = (sb[sc] ?? 0) + sn;
        saleCounts[k] = (saleCounts[k] ?? 0) + 1;
        totalsSaleByCur[sc] = (totalsSaleByCur[sc] ?? 0) + sn;
      }
    }
    const allCurrencies = new Set([
      ...Object.keys(totalsPurchaseByCur),
      ...Object.keys(totalsSaleByCur),
    ]);
    const netByCurrency: Record<string, number> = {};
    for (const cur of allCurrencies) {
      netByCurrency[cur] = (totalsSaleByCur[cur] ?? 0) - (totalsPurchaseByCur[cur] ?? 0);
    }
    res.json({
      group: "purchaseSpending",
      period,
      data,
      saleData,
      counts,
      saleCounts,
      netByCurrency,
    });
    return;
  }

  if (group === "summary") {
    const totalWhere = applyStatsMediaFilter(
      freeMonthWhere ? mergeLogWhere({ userId }, freeMonthWhere) : { userId },
      statsMediaType
    );
    const completedCountWhere: Prisma.LogWhereInput = applyStatsMediaFilter(
      freeMonthRange
        ? { userId, completedAt: { gte: freeMonthRange.gte, lte: freeMonthRange.lte } }
        : { userId, completedAt: { not: null } },
      statsMediaType
    );
    const reviewedWhere = applyStatsMediaFilter(
      freeMonthWhere
        ? mergeLogWhere({ userId, grade: { not: null } }, freeMonthWhere)
        : { userId, grade: { not: null } },
      statsMediaType
    );
    const completedForHoursWhere: Prisma.LogWhereInput = applyStatsMediaFilter(
      freeMonthRange
        ? { userId, completedAt: { gte: freeMonthRange.gte, lte: freeMonthRange.lte } }
        : { userId, completedAt: { not: null } },
      statsMediaType
    );

    let spendLifetimeWhere: Prisma.LogWhereInput = applyStatsMediaFilter(
      {
        userId,
        mediaType: { in: [...SPEND_TRACKED_MEDIA_TYPES] },
        OR: [
          { AND: [{ purchaseAmountMinor: { not: null } }, { purchaseCurrency: { not: null } }] },
          { AND: [{ saleAmountMinor: { not: null } }, { saleCurrency: { not: null } }] },
        ],
      },
      statsMediaType
    );
    if (freeMonthRange) {
      spendLifetimeWhere = mergeLogWhere(spendLifetimeWhere, logSpendStatsDateWhere(freeMonthRange));
    }

    const [totalLogs, completedLogCount, reviewedLogs, completedLogs, spendLifetimeRows] =
      await Promise.all([
        prisma.log.count({ where: totalWhere }),
        prisma.log.count({ where: completedCountWhere }),
        prisma.log.count({ where: reviewedWhere }),
        prisma.log.findMany({
          where: completedForHoursWhere,
          select: {
            id: true,
            completedAt: true,
            contentHours: true,
            startedAt: true,
            mediaType: true,
            hoursToBeat: true,
            matchesPlayed: true,
          },
        }),
        prisma.log.findMany({
          where: spendLifetimeWhere,
          select: {
            purchaseAmountMinor: true,
            purchaseCurrency: true,
            saleAmountMinor: true,
            saleCurrency: true,
          },
        }),
      ]);
    const { totalHours, logsWithPositiveHours } = rollupHoursFromCompletedLogs(
      await attachBoardGameSessionHours(completedLogs)
    );
    const totalsPurchaseByCur: Record<string, number> = {};
    const totalsSaleByCur: Record<string, number> = {};
    for (const row of spendLifetimeRows) {
      const pn = row.purchaseAmountMinor;
      const pc = row.purchaseCurrency;
      if (pn != null && pc != null) {
        totalsPurchaseByCur[pc] = (totalsPurchaseByCur[pc] ?? 0) + pn;
      }
      const sn = row.saleAmountMinor;
      const sc = row.saleCurrency;
      if (sn != null && sc != null) {
        totalsSaleByCur[sc] = (totalsSaleByCur[sc] ?? 0) + sn;
      }
    }
    const lifetimeCurrencies = new Set([
      ...Object.keys(totalsPurchaseByCur),
      ...Object.keys(totalsSaleByCur),
    ]);
    const lifetimeNetByCurrency: Record<string, number> = {};
    for (const cur of lifetimeCurrencies) {
      lifetimeNetByCurrency[cur] = (totalsSaleByCur[cur] ?? 0) - (totalsPurchaseByCur[cur] ?? 0);
    }
    const summaryPayload: Record<string, unknown> = {
      totalLogs,
      completedLogs: completedLogCount,
      reviewedLogs,
      totalContentHours: totalHours,
      completedLogsWithHours: logsWithPositiveHours,
      lifetimeNetByCurrency,
    };
    const highlightWhere = freeMonthWhere ?? undefined;
    const taggedPlayedAtWhere = freeMonthRange
      ? { playedAt: { gte: freeMonthRange.gte, lte: freeMonthRange.lte } }
      : undefined;
    const boardGameWinsOpts = taggedPlayedAtWhere ? { taggedPlayedAtWhere } : undefined;
    if (!statsMediaType) {
      summaryPayload.totalPagesRead = await sumAllPagesReadForStats(userId, highlightWhere);
      summaryPayload.boardGamesWon = await countBoardGameWinsForStats(
        userId,
        highlightWhere,
        boardGameWinsOpts
      );
    } else {
      if (isReadingMediaType(statsMediaType)) {
        summaryPayload.totalPagesRead = await sumPagesReadForStats(
          userId,
          statsMediaType,
          highlightWhere
        );
      }
      if (statsMediaType === "boardgames") {
        summaryPayload.boardGamesWon = await countBoardGameWinsForStats(
          userId,
          highlightWhere,
          boardGameWinsOpts
        );
      }
    }
    res.json({
      group: "summary",
      data: summaryPayload,
    });
    return;
  }

  if (group === "gamePlatforms") {
    if (statsMediaType != null && statsMediaType !== "games") {
      res.json({ group: "gamePlatforms", data: [] });
      return;
    }
    const platformWhere = freeMonthWhere ?? undefined;
    const entries = await gamePlatformStatsForUser(userId, platformWhere);
    res.json({ group: "gamePlatforms", data: entries });
    return;
  }

  if (group === "recentBoardGames") {
    if (statsMediaType != null && statsMediaType !== "boardgames") {
      res.json({ group: "recentBoardGames", data: [] });
      return;
    }
    const periodRaw = typeof req.query.period === "string" ? req.query.period.trim() : "month";
    let period: "month" | "year" = periodRaw === "year" ? "year" : "month";
    if (!fullStatsAccess) period = "month";
    const range = purchaseLogCreatedAtRange(period, tzOffsetMinutes);
    const playedAtWhere = range
      ? { playedAt: { gte: range.gte, lte: range.lte } }
      : undefined;
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort.trim() : "recent";
    const sort =
      sortRaw === "mostPlayed" ? "mostPlayed" : sortRaw === "leastPlayed" ? "leastPlayed" : "recent";
    const entries = await recentBoardGamesForStats(userId, playedAtWhere, sort);
    res.json({ group: "recentBoardGames", period, sort, data: entries });
    return;
  }

  if (group === "genre") {
    const genreBase: Prisma.LogWhereInput = applyStatsMediaFilter(
      { userId, genres: { not: null } },
      statsMediaType
    );
    const logs = await prisma.log.findMany({
      where: freeMonthWhere ? mergeLogWhere(genreBase, freeMonthWhere) : genreBase,
      select: { id: true, genres: true },
    });
    const byGenre: Record<string, Set<string>> = {};
    for (const log of logs) {
      const genres = parseGenresJson(log.genres);
      if (!genres) continue;
      for (const g of genres) {
        const name = g.trim();
        if (!name) continue;
        if (!byGenre[name]) byGenre[name] = new Set();
        byGenre[name].add(log.id);
      }
    }
    const entries = Object.entries(byGenre)
      .sort(([, a], [, b]) => b.size - a.size)
      .map(([period, set]) => {
        const count = set.size;
        return { period, hours: count, count };
      });
    res.json({ group: "genre", data: entries });
    return;
  }

  if (group === "completedByMonth" || group === "completedByYear") {
    const completedTimeWhere: Prisma.LogWhereInput = applyStatsMediaFilter(
      freeMonthRange
        ? { userId, completedAt: { gte: freeMonthRange.gte, lte: freeMonthRange.lte } }
        : { userId, completedAt: { not: null } },
      statsMediaType
    );
    const logs = await prisma.log.findMany({
      where: completedTimeWhere,
      select: { completedAt: true },
    });
    const byPeriod: Record<string, number> = {};
    for (const log of logs) {
      const d = log.completedAt!;
      const key =
        group === "completedByYear"
          ? `${d.getUTCFullYear()}`
          : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      byPeriod[key] = (byPeriod[key] ?? 0) + 1;
    }
    const entries = Object.entries(byPeriod)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, hours: count, count }));
    res.json({ group, data: entries });
    return;
  }

  if (group === "categoryByMonth" || group === "categoryByYear") {
    const catTimeWhere: Prisma.LogWhereInput = applyStatsMediaFilter(
      freeMonthRange
        ? { userId, completedAt: { gte: freeMonthRange.gte, lte: freeMonthRange.lte } }
        : { userId, completedAt: { not: null } },
      statsMediaType
    );
    const logs = await prisma.log.findMany({
      where: catTimeWhere,
      select: { completedAt: true, mediaType: true },
    });
    const byPeriodCategory: Record<string, Record<string, number>> = {};
    for (const log of logs) {
      const d = log.completedAt!;
      const period =
        group === "categoryByYear"
          ? `${d.getUTCFullYear()}`
          : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const mt = log.mediaType as string;
      if (statsMediaType && mt !== statsMediaType) continue;
      if (!byPeriodCategory[period]) byPeriodCategory[period] = {};
      byPeriodCategory[period][mt] = (byPeriodCategory[period][mt] ?? 0) + 1;
    }
    const entries: Array<{ period: string; mediaType: string; hours: number; count: number }> = [];
    for (const [period, byCat] of Object.entries(byPeriodCategory)) {
      for (const [mediaType, count] of Object.entries(byCat)) {
        entries.push({ period, mediaType, hours: count, count });
      }
    }
    entries.sort((a, b) => a.period.localeCompare(b.period) || a.mediaType.localeCompare(b.mediaType));
    res.json({ group, data: entries });
    return;
  }

  if (group === "boardGameWeight") {
    if (statsMediaType != null && statsMediaType !== "boardgames") {
      res.json({ group, data: [] });
      return;
    }
    const weightScope = parseBoardGameWeightScope(req.query.weightScope);
    const scopeWhere = boardGameWeightScopeWhere(weightScope);
    await ensureBoardGameWeightsForSort(prisma, userId, "boardgames");
    let weightBase: Prisma.LogWhereInput = applyStatsMediaFilter(
      {
        userId,
        mediaType: "boardgames",
        averageWeight: { gt: 0 },
      },
      statsMediaType ?? "boardgames"
    );
    if (scopeWhere) weightBase = mergeLogWhere(weightBase, scopeWhere);
    const logs = await prisma.log.findMany({
      where: weightBase,
      select: { averageWeight: true },
    });
    const weights = logs.map((log) => log.averageWeight);
    res.json({ group, data: boardGameWeightHistogramEntries(weights) });
    return;
  }

  if (group === "pagesReadByMonth" || group === "pagesReadByYear") {
    if (statsMediaType != null && !isReadingMediaType(statsMediaType)) {
      res.json({ group, data: [] });
      return;
    }
    const readingTypes = statsMediaType
      ? [statsMediaType]
      : [...READING_MEDIA_TYPES];
    const pagesBase: Prisma.LogWhereInput = {
      userId,
      mediaType: { in: readingTypes },
      pagesRead: { gt: 0 },
      completedAt: freeMonthRange
        ? { gte: freeMonthRange.gte, lte: freeMonthRange.lte }
        : { not: null },
    };
    const logs = await prisma.log.findMany({
      where: pagesBase,
      select: { completedAt: true, pagesRead: true },
    });
    const granularity = group === "pagesReadByYear" ? "year" : "month";
    const entries = sumMetricByPeriod(
      logs
        .filter((l): l is { completedAt: Date; pagesRead: number } => l.completedAt != null && l.pagesRead != null)
        .map((l) => ({ at: l.completedAt, value: l.pagesRead })),
      granularity
    );
    res.json({ group, data: entries });
    return;
  }

  if (group === "episodesByMonth" || group === "episodesByYear") {
    if (statsMediaType != null && statsMediaType !== "tv") {
      res.json({ group, data: [] });
      return;
    }
    const episodesBase: Prisma.LogWhereInput = {
      userId,
      mediaType: "tv",
      episode: { gt: 0 },
      completedAt: freeMonthRange
        ? { gte: freeMonthRange.gte, lte: freeMonthRange.lte }
        : { not: null },
    };
    const logs = await prisma.log.findMany({
      where: episodesBase,
      select: { completedAt: true, episode: true },
    });
    const granularity = group === "episodesByYear" ? "year" : "month";
    const entries = sumMetricByPeriod(
      logs
        .filter((l): l is { completedAt: Date; episode: number } => l.completedAt != null && l.episode != null)
        .map((l) => ({ at: l.completedAt, value: l.episode })),
      granularity
    );
    res.json({ group, data: entries });
    return;
  }

  const hoursRollupWhere: Prisma.LogWhereInput = applyStatsMediaFilter(
    freeMonthRange
      ? { userId, completedAt: { gte: freeMonthRange.gte, lte: freeMonthRange.lte } }
      : { userId, completedAt: { not: null } },
    statsMediaType
  );
  const logs = await prisma.log.findMany({
    where: hoursRollupWhere,
    select: {
      id: true,
      completedAt: true,
      contentHours: true,
      startedAt: true,
      mediaType: true,
      hoursToBeat: true,
      matchesPlayed: true,
    },
  });
  const logsWithSessionHours = await attachBoardGameSessionHours(logs);
  const byKeyHours: Record<string, number> = {};
  const byKeyCount: Record<string, number> = {};
  for (const log of logsWithSessionHours) {
    const hours = hoursFromCompletedLogForStats(log);
    if (hours === null) continue;
    const completedAt = log.completedAt;
    if (!completedAt) continue;
    const key =
      group === "category"
        ? (log.mediaType as string)
        : group === "year"
          ? `${completedAt.getUTCFullYear()}`
          : `${completedAt.getUTCFullYear()}-${String(completedAt.getUTCMonth() + 1).padStart(2, "0")}`;
    byKeyHours[key] = (byKeyHours[key] ?? 0) + hours;
    byKeyCount[key] = (byKeyCount[key] ?? 0) + 1;
  }
  const entries = Object.keys(byKeyHours)
    .sort((a, b) => a.localeCompare(b))
    .map((period) => ({
      period,
      hours: Math.round((byKeyHours[period] ?? 0) * 10) / 10,
      count: byKeyCount[period] ?? 0,
    }));
  res.json({ group, data: entries });
});

/** GET /logs/by-date?date=YYYY-MM-DD&timezoneOffsetMinutes=? - Logs completed or started on the given date (in user's local time). Pro: any date. Free: only days in the current calendar month (same window as statistics). */
logsRouter.get("/by-date", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  const hasProAccess = user != null && tierHasProFeatures(user.tier);
  const dateParam = typeof req.query.date === "string" ? req.query.date.trim() : "";
  const tzOffsetMinutes = typeof req.query.timezoneOffsetMinutes === "string"
    ? parseInt(req.query.timezoneOffsetMinutes, 10)
    : 0;
  const tz = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;
  const bounds = localDayBoundsFromDateString(dateParam, tz);
  if (!bounds) {
    res.status(400).json({ error: "Invalid date; use YYYY-MM-DD" });
    return;
  }
  if (!hasProAccess) {
    const monthRange = freeTierStatisticsMonthRange(tz);
    if (!monthRange || bounds.lte < monthRange.gte || bounds.gte > monthRange.lte) {
      res.json({ data: [] });
      return;
    }
  }
  const { gte: start, lte: end } = bounds;
  const byDateMediaType = parseStatsMediaTypeFilter(req.query as Record<string, unknown>);
  const logs = await prisma.log.findMany({
    where: applyStatsMediaFilter(
      {
        userId,
        OR: [
          { completedAt: { gte: start, lte: end } },
          { startedAt: { gte: start, lte: end } },
        ],
      },
      byDateMediaType
    ),
    orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }, { updatedAt: "desc" }],
  });
  const enriched = await enrichLogsForClient(prisma, logs.map(serializeLog));
  res.json({ data: enriched });
});

/** GET /logs/by-weight?weightBin=2.5&weightScope=all|planToPlay|played|inCollection|wantToBuy */
logsRouter.get("/by-weight", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const weightBin = parseBoardGameWeightBin(req.query.weightBin);
  if (weightBin == null) {
    res.status(400).json({ error: "Invalid weightBin; use a value from 0.5 to 5 in 0.5 steps" });
    return;
  }
  const weightScope = parseBoardGameWeightScope(req.query.weightScope);
  const scopeWhere = boardGameWeightScopeWhere(weightScope);
  await ensureBoardGameWeightsForSort(prisma, userId, "boardgames");
  let where: Prisma.LogWhereInput = {
    userId,
    mediaType: "boardgames",
    averageWeight: { gt: 0 },
  };
  if (scopeWhere) where = mergeLogWhere(where, scopeWhere);
  const logs = await prisma.log.findMany({
    where,
    orderBy: [{ title: "asc" }, { updatedAt: "desc" }],
  });
  const matched = logs.filter((log) => binBoardGameWeight(log.averageWeight ?? 0) === weightBin);
  const enriched = await enrichLogsForClient(prisma, matched.map(serializeLog));
  res.json({ data: enriched });
});

/** GET /logs/by-period?period=YYYY-MM|YYYY&granularity=month|year - Logs completed in that stats period (same buckets as completedByMonth/Year). */
logsRouter.get("/by-period", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  const hasProAccess = user != null && tierHasProFeatures(user.tier);
  const periodParam = typeof req.query.period === "string" ? req.query.period.trim() : "";
  const granularity = req.query.granularity === "year" ? "year" : "month";
  const bounds = completedAtBoundsForStatsPeriod(periodParam, granularity);
  if (!bounds) {
    res.status(400).json({ error: "Invalid period; use YYYY-MM for month or YYYY for year" });
    return;
  }
  const tzOffsetMinutes = typeof req.query.timezoneOffsetMinutes === "string"
    ? parseInt(req.query.timezoneOffsetMinutes, 10)
    : 0;
  const tz = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;
  const freeMonthRange = hasProAccess ? undefined : freeTierStatisticsMonthRange(tz);
  if (!hasProAccess) {
    if (!freeMonthRange || bounds.lte < freeMonthRange.gte || bounds.gte > freeMonthRange.lte) {
      res.json({ data: [] });
      return;
    }
  }
  let completedGte = bounds.gte;
  let completedLte = bounds.lte;
  if (freeMonthRange) {
    completedGte = new Date(Math.max(completedGte.getTime(), freeMonthRange.gte.getTime()));
    completedLte = new Date(Math.min(completedLte.getTime(), freeMonthRange.lte.getTime()));
  }
  const byPeriodMediaType = parseStatsMediaTypeFilter(req.query as Record<string, unknown>);
  const logs = await prisma.log.findMany({
    where: applyStatsMediaFilter(
      {
        userId,
        completedAt: { gte: completedGte, lte: completedLte },
      },
      byPeriodMediaType
    ),
    orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
  });
  const enriched = await enrichLogsForClient(prisma, logs.map(serializeLog));
  res.json({ data: enriched });
});

/** GET /logs/calendar?year=YYYY&month=M - Activity counts per day. Pro: any month. Free: only the current calendar month in the user's timezone (same as statistics). */
logsRouter.get("/calendar", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  const hasProAccess = user != null && tierHasProFeatures(user.tier);
  const yearParam = typeof req.query.year === "string" ? parseInt(req.query.year, 10) : new Date().getFullYear();
  const monthParam = typeof req.query.month === "string" ? parseInt(req.query.month, 10) : new Date().getMonth() + 1;
  const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();
  const month = Number.isFinite(monthParam) ? Math.max(1, Math.min(12, monthParam)) : new Date().getMonth() + 1;
  const tzOffsetMinutes = typeof req.query.timezoneOffsetMinutes === "string"
    ? parseInt(req.query.timezoneOffsetMinutes, 10)
    : 0;
  const offsetMs = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes * 60 * 1000 : 0;
  if (!hasProAccess) {
    const shifted = new Date(Date.now() + offsetMs);
    const cy = shifted.getUTCFullYear();
    const cm = shifted.getUTCMonth() + 1;
    if (year !== cy || month !== cm) {
      res.json({ year, month, dates: {} });
      return;
    }
  }
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const calendarMediaType = parseStatsMediaTypeFilter(req.query as Record<string, unknown>);
  const logs = await prisma.log.findMany({
    where: applyStatsMediaFilter(
      {
        userId,
        OR: [
          { startedAt: { gte: start, lte: end } },
          { completedAt: { gte: start, lte: end } },
        ],
      },
      calendarMediaType
    ),
    select: { startedAt: true, completedAt: true },
  });
  const dates: Record<string, number> = {};
  const toKey = (d: Date) => {
    const localMs = d.getTime() + offsetMs;
    const local = new Date(localMs);
    return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
  };
  for (const log of logs) {
    if (log.startedAt && log.startedAt >= start && log.startedAt <= end) {
      const key = toKey(log.startedAt);
      dates[key] = (dates[key] ?? 0) + 1;
    }
    if (log.completedAt && log.completedAt >= start && log.completedAt <= end) {
      const key = toKey(log.completedAt);
      dates[key] = (dates[key] ?? 0) + 1;
    }
  }
  res.json({ year, month, dates });
});

/** Column keys for CSV export. When single category, only relevant columns; when all, include mediaType. */
const EXPORT_COLUMNS_ALL: readonly string[] = [
  "mediaType", "externalId", "title", "grade", "status", "season", "episode", "chapter", "volume",
  "startedAt", "completedAt", "contentHours", "hoursToBeat", "own", "wantToBuy", "sold", "matchesPlayed",
  "purchaseAmountMinor", "purchaseCurrency", "saleAmountMinor", "saleCurrency", "review", "createdAt", "updatedAt",
];
const EXPORT_COLUMNS_BY_MEDIA: Record<MediaType, readonly string[]> = {
  movies: ["externalId", "title", "grade", "status", "startedAt", "completedAt", "review", "createdAt", "updatedAt"],
  tv: ["externalId", "title", "grade", "status", "season", "episode", "contentHours", "startedAt", "completedAt", "review", "createdAt", "updatedAt"],
  anime: ["externalId", "title", "grade", "status", "season", "episode", "contentHours", "startedAt", "completedAt", "review", "createdAt", "updatedAt"],
  books: ["externalId", "title", "grade", "status", "chapter", "volume", "pagesRead", "contentHours", "startedAt", "completedAt", "review", "createdAt", "updatedAt"],
  manga: [
    "externalId", "title", "grade", "status", "chapter", "volume", "pagesRead", "contentHours", "purchaseAmountMinor",
    "purchaseCurrency", "saleAmountMinor", "saleCurrency", "sold", "startedAt", "completedAt", "review", "createdAt", "updatedAt",
  ],
  comics: [
    "externalId", "title", "grade", "status", "chapter", "volume", "pagesRead", "contentHours", "purchaseAmountMinor",
    "purchaseCurrency", "saleAmountMinor", "saleCurrency", "sold", "startedAt", "completedAt", "review", "createdAt", "updatedAt",
  ],
  games: [
    "externalId", "title", "grade", "status", "contentHours", "hoursToBeat", "gamePlatform", "own", "wantToBuy", "sold",
    "purchaseAmountMinor", "purchaseCurrency", "saleAmountMinor", "saleCurrency", "startedAt", "completedAt", "review", "createdAt", "updatedAt",
  ],
  boardgames: [
    "externalId", "title", "grade", "status", "own", "wantToBuy", "sold", "matchesPlayed", "averageWeight",
    "purchaseAmountMinor", "purchaseCurrency", "saleAmountMinor", "saleCurrency", "startedAt", "completedAt", "review", "createdAt", "updatedAt",
  ],
};

function getExportValue(
  log: {
    mediaType: string;
    externalId: string;
    title: string;
    grade: number | null;
    status: string | null;
    season: number | null;
    episode: number | null;
    chapter: number | null;
    volume: number | null;
    pagesRead: number | null;
    gamePlatform: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    contentHours: number | null;
    hoursToBeat: number | null;
    own: boolean | null;
    wantToBuy: boolean | null;
    sold: boolean | null;
    matchesPlayed: number | null;
    averageWeight: number | null;
    review: string | null;
    createdAt: Date;
    updatedAt: Date;
    affinityContext?: string | null;
    purchaseAmountMinor?: number | null;
    purchaseCurrency?: string | null;
    saleAmountMinor?: number | null;
    saleCurrency?: string | null;
  },
  key: string
): string | number | null | undefined {
  switch (key) {
    case "mediaType": return log.mediaType;
    case "externalId": return log.externalId;
    case "title": return log.title;
    case "grade": return log.grade;
    case "status": return log.status;
    case "season": return log.season;
    case "episode": return log.episode;
    case "chapter": return log.chapter;
    case "volume": return log.volume;
    case "pagesRead": return log.pagesRead;
    case "gamePlatform": return log.gamePlatform;
    case "startedAt": return log.startedAt?.toISOString() ?? null;
    case "completedAt": return log.completedAt?.toISOString() ?? null;
    case "contentHours": return log.contentHours;
    case "hoursToBeat": return log.hoursToBeat;
    case "own": return log.own == null ? null : log.own ? "true" : "false";
    case "wantToBuy": return log.wantToBuy == null ? null : log.wantToBuy ? "true" : "false";
    case "sold": return log.sold == null ? null : log.sold ? "true" : "false";
    case "matchesPlayed": return log.matchesPlayed;
    case "averageWeight":
      return (
        log.averageWeight ??
        boardGameAverageWeightFromAffinity(parseLogAffinityContextJson(log.affinityContext ?? null))
      );
    case "review": return log.review;
    case "createdAt": return log.createdAt.toISOString();
    case "updatedAt": return log.updatedAt.toISOString();
    case "purchaseAmountMinor": return log.purchaseAmountMinor ?? null;
    case "purchaseCurrency": return log.purchaseCurrency ?? null;
    case "saleAmountMinor": return log.saleAmountMinor ?? null;
    case "saleCurrency": return log.saleCurrency ?? null;
    default: return undefined;
  }
}

/**
 * GET /logs/export - Pro only; returns user logs as CSV.
 * Optional filters: ?mediaType, ?status, ?own=true, ?wantToBuy=true, ?genre, ?sort.
 * Filters mirror GET /logs (so the user gets exactly the list they're seeing).
 */
logsRouter.get("/export", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  const hasProAccess = user != null && tierHasProFeatures(user.tier);
  if (!hasProAccess) {
    res.status(403).json({ error: "Export is available on Pro only", code: "PRO_REQUIRED" });
    return;
  }
  const mediaTypeParam = req.query.mediaType as string | undefined;
  const mediaTypeFilter =
    mediaTypeParam && MEDIA_TYPES.includes(mediaTypeParam as (typeof MEDIA_TYPES)[number])
      ? (mediaTypeParam as (typeof MEDIA_TYPES)[number])
      : null;

  const sortParam = typeof req.query.sort === "string" ? req.query.sort : "";
  const validSorts = ["dateAsc", "dateDesc", "gradeAsc", "gradeDesc"] as const;
  const boardgameSorts = ["matchesPlayedAsc", "matchesPlayedDesc", "weightAsc", "weightDesc"] as const;
  const gameSorts = ["timeToBeatAsc", "timeToBeatDesc"] as const;
  let sort: string = validSorts.includes(sortParam as (typeof validSorts)[number])
    ? sortParam
    : "dateDesc";
  if (
    mediaTypeFilter === "boardgames" &&
    boardgameSorts.includes(sortParam as (typeof boardgameSorts)[number])
  ) {
    sort = sortParam;
  } else if (
    mediaTypeFilter === "games" &&
    gameSorts.includes(sortParam as (typeof gameSorts)[number])
  ) {
    sort = sortParam;
  }

  const where: Prisma.LogWhereInput = { userId };
  if (mediaTypeFilter) where.mediaType = mediaTypeFilter;

  const statusParam = typeof req.query.status === "string" ? req.query.status : "";
  if (statusParam) {
    if (mediaTypeFilter) {
      const allowed = LOG_STATUS_OPTIONS[mediaTypeFilter];
      if (allowed.includes(statusParam)) where.status = statusParam;
    } else {
      where.status = statusParam;
    }
  }

  if (mediaTypeFilter && isSpendTrackedMediaType(mediaTypeFilter)) {
    if (req.query.own === "true") where.own = true;
    if (req.query.wantToBuy === "true") where.wantToBuy = true;
  }

  const genreFilter = sanitizeText(
    typeof req.query.genre === "string" ? req.query.genre : "",
    LOG_GENRE_FILTER_MAX_LENGTH
  );

  const orderBy: Prisma.LogOrderByWithRelationInput[] | Prisma.LogOrderByWithRelationInput =
    sort === "matchesPlayedDesc"
      ? [{ matchesPlayed: "desc" }, { updatedAt: "desc" }]
      : sort === "matchesPlayedAsc"
        ? [{ matchesPlayed: "asc" }, { updatedAt: "desc" }]
        : sort === "weightDesc"
          ? [{ averageWeight: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }]
          : sort === "weightAsc"
            ? [{ averageWeight: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }]
            : sort === "timeToBeatDesc"
          ? [{ hoursToBeat: "desc" }, { updatedAt: "desc" }]
          : sort === "timeToBeatAsc"
            ? [{ hoursToBeat: "asc" }, { updatedAt: "desc" }]
            : sort === "gradeDesc"
              ? [{ grade: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }]
              : sort === "gradeAsc"
                ? [{ grade: { sort: "asc", nulls: "last" } }, { updatedAt: "asc" }]
                : sort === "dateAsc"
                  ? { updatedAt: "asc" }
                  : { updatedAt: "desc" };

  const allLogs = await prisma.log.findMany({ where, orderBy });
  const logs = genreFilter
    ? allLogs.filter((row) => logHasGenreExact({ genres: row.genres }, genreFilter))
    : allLogs;

  const columns = mediaTypeFilter ? EXPORT_COLUMNS_BY_MEDIA[mediaTypeFilter] : EXPORT_COLUMNS_ALL;
  const header = (columns as readonly string[]).join(",") + "\n";
  const escape = (v: string | number | null | undefined): string => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = logs.map((l) =>
    (columns as readonly string[]).map((key) => escape(getExportValue(l, key))).join(",")
  );
  const csv = header + rows.join("\n");
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = mediaTypeFilter ? `logs-${mediaTypeFilter}-${dateStr}.csv` : `logs-export-${dateStr}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

logsRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = createLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.user!.userId;
  const {
    mediaType: mediaTypeRaw,
    externalId,
    title,
    image,
    grade: gradeInput,
    review,
    listType,
    status,
    season,
    episode,
    chapter,
    volume,
    pagesRead: bodyPagesRead,
    gamePlatform: bodyGamePlatform,
    startedAt: bodyStartedAt,
    completedAt: bodyCompletedAt,
    contentHours,
    hoursToBeat,
    genres: genresInput,
    mechanics: mechanicsInput,
    affinityContext: affinityInput,
    boardGameSource: bodyBoardGameSource,
    own: bodyOwn,
    wantToBuy: bodyWantToBuy,
    sold: bodySold,
    matchesPlayed: bodyMatchesPlayed,
    purchaseAmountMinor: bodyPurchaseAmountMinor,
    purchaseCurrency: bodyPurchaseCurrency,
    saleAmountMinor: bodySaleAmountMinor,
    saleCurrency: bodySaleCurrency,
  } = parsed.data;
  const genresJson =
    genresInput && genresInput.length > 0
      ? JSON.stringify(genresInput.slice(0, 20))
      : null;
  const mechanicsJson =
    mechanicsInput && mechanicsInput.length > 0
      ? JSON.stringify(mechanicsInput.slice(0, 20))
      : null;
  const affinityStored =
    affinityInput === undefined ? undefined : stringifyLogAffinityContext(affinityInput);
  const averageWeightStored =
    mediaTypeRaw === "boardgames" && affinityInput !== undefined
      ? boardGameAverageWeightFromAffinity(affinityInput)
      : undefined;
  const mediaType = mediaTypeRaw as MediaType;
  if (!validateStatus(mediaType, status)) {
    res.status(400).json({ error: { status: ["Invalid status for this media type"] } });
    return;
  }
  let boardGameSource: string | null = null;
  if (mediaType === "boardgames") {
    if (bodyBoardGameSource === "bgg" || bodyBoardGameSource === "ludopedia") {
      boardGameSource = bodyBoardGameSource;
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { boardGameProvider: true },
      });
      boardGameSource = user?.boardGameProvider === "ludopedia" ? "ludopedia" : "bgg";
    }
  }
  const sanitizedTitle = sanitizeText(decodeHtmlEntities(title), TITLE_MAX_LENGTH);
  const sanitizedExternalId = sanitizeText(externalId, EXTERNAL_ID_MAX_LENGTH);
  if (!sanitizedTitle || !sanitizedExternalId) {
    res.status(400).json({ error: "Invalid title or externalId" });
    return;
  }
  const sanitizedImage = image != null ? sanitizeUrl(image) : null;
  const sanitizedReview = sanitizeReview(review ?? null);
  const sanitizedGamePlatform =
    bodyGamePlatform !== undefined && bodyGamePlatform != null
      ? sanitizeText(bodyGamePlatform, GAME_PLATFORM_MAX_LENGTH)
      : undefined;
  const now = new Date();
  const createStartedAt =
    bodyStartedAt !== undefined
      ? bodyStartedAt == null
        ? null
        : parseManualLogDate(bodyStartedAt)
      : isInProgress(status)
        ? now
        : null;
  const createCompletedAt =
    bodyCompletedAt !== undefined
      ? bodyCompletedAt == null
        ? null
        : parseManualLogDate(bodyCompletedAt)
      : isCompleted(status)
        ? now
        : null;
  const grade = gradeInput ?? null;
  try {
    const existing = await prisma.log.findUnique({
      where: { userId_mediaType_externalId: { userId, mediaType, externalId: sanitizedExternalId } },
    });
    // Enforce free-tier log limit server-side (cannot be bypassed by client / modified frontend)
    if (!existing) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tier: true },
      });
      if (!tierHasUnlimitedLogs(user?.tier ?? "free")) {
        const count = await prisma.log.count({ where: { userId } });
        if (count >= FREE_LOG_LIMIT) {
          res.status(403).json({
            error: "Log limit reached",
            code: "LOG_LIMIT_REACHED",
            limit: FREE_LOG_LIMIT,
          });
          return;
        }
      }
    }

    let purchaseResolved: { purchaseAmountMinor: number | null; purchaseCurrency: string | null };
    if (!existing) {
      const pn = normalizePurchaseFields(mediaType, bodyPurchaseAmountMinor, bodyPurchaseCurrency);
      if (!pn.ok) {
        res.status(400).json({ error: pn.error });
        return;
      }
      purchaseResolved = pn;
    } else {
      if (bodyPurchaseAmountMinor !== undefined || bodyPurchaseCurrency !== undefined) {
        const pn = normalizePurchaseFields(mediaType, bodyPurchaseAmountMinor, bodyPurchaseCurrency);
        if (!pn.ok) {
          res.status(400).json({ error: pn.error });
          return;
        }
        purchaseResolved = pn;
      } else {
        purchaseResolved = {
          purchaseAmountMinor: existing.purchaseAmountMinor,
          purchaseCurrency: existing.purchaseCurrency,
        };
      }
    }

    const ownershipNext = reconcileSpendTrackedOwnership(
      mediaType,
      { own: bodyOwn, wantToBuy: bodyWantToBuy, sold: bodySold },
      existing ?? null
    );
    const soldActive =
      ownershipNext != null ? ownershipNext.sold === true : (existing?.sold === true);

    let saleResolved: { saleAmountMinor: number | null; saleCurrency: string | null };
    if (!soldActive) {
      saleResolved = { saleAmountMinor: null, saleCurrency: null };
    } else if (!existing) {
      const sn = normalizeSaleFields(mediaType, bodySaleAmountMinor, bodySaleCurrency);
      if (!sn.ok) {
        res.status(400).json({ error: sn.error });
        return;
      }
      saleResolved = sn;
    } else {
      if (bodySaleAmountMinor !== undefined || bodySaleCurrency !== undefined) {
        const sn = normalizeSaleFields(mediaType, bodySaleAmountMinor, bodySaleCurrency);
        if (!sn.ok) {
          res.status(400).json({ error: sn.error });
          return;
        }
        saleResolved = sn;
      } else {
        saleResolved = {
          saleAmountMinor: existing.saleAmountMinor,
          saleCurrency: existing.saleCurrency,
        };
      }
    }

    let log;
    if (existing) {
      const hadStatsReview = countsAsReviewForGamification(existing.grade, existing.review);
      const updateData: {
        title: string;
        image?: string | null;
        grade: number | null;
        review: string | null;
        listType: string | null;
        status: string | null;
        startedAt?: Date | null;
        completedAt?: Date | null;
        contentHours: number | null;
        hoursToBeat: number | null;
        season: number | null;
        episode: number | null;
        chapter: number | null;
        volume: number | null;
        pagesRead?: number | null;
        gamePlatform?: string | null;
        genres?: string | null;
        mechanics?: string | null;
        affinityContext?: string | null;
        own?: boolean | null;
        wantToBuy?: boolean | null;
        sold?: boolean | null;
        matchesPlayed?: number | null;
        averageWeight?: number | null;
        purchaseAmountMinor?: number | null;
        purchaseCurrency?: string | null;
        saleAmountMinor?: number | null;
        saleCurrency?: string | null;
        spendFieldsAt?: Date | null;
      } = {
        title: sanitizedTitle,
        grade: grade ?? null,
        review: sanitizedReview,
        listType: listType ?? null,
        status: status ?? null,
        contentHours: contentHours ?? null,
        hoursToBeat: hoursToBeat ?? null,
        season: season ?? null,
        episode: episode ?? null,
        chapter: chapter ?? null,
        volume: volume ?? null,
        purchaseAmountMinor: purchaseResolved.purchaseAmountMinor,
        purchaseCurrency: purchaseResolved.purchaseCurrency,
        saleAmountMinor: saleResolved.saleAmountMinor,
        saleCurrency: saleResolved.saleCurrency,
      };
      if (image !== undefined) updateData.image = sanitizedImage ?? null;
      if (genresJson !== undefined) updateData.genres = genresJson;
      if (mechanicsJson !== undefined) updateData.mechanics = mechanicsJson;
      if (affinityStored !== undefined) {
        updateData.affinityContext = affinityStored;
        if (mediaType === "boardgames") {
          updateData.averageWeight =
            affinityInput !== undefined
              ? boardGameAverageWeightFromAffinity(affinityInput)
              : boardGameAverageWeightFromAffinity(parseLogAffinityContextJson(affinityStored));
        }
      }
      if (ownershipNext != null && isSpendTrackedMediaType(mediaType)) {
        updateData.own = ownershipNext.own;
        updateData.wantToBuy = ownershipNext.wantToBuy;
        updateData.sold = ownershipNext.sold;
      }
      if (bodyMatchesPlayed !== undefined && mediaType === "boardgames") {
        updateData.matchesPlayed = bodyMatchesPlayed ?? null;
      }
      if (bodyPagesRead !== undefined) {
        updateData.pagesRead = bodyPagesRead;
      }
      if (bodyGamePlatform !== undefined) {
        updateData.gamePlatform = sanitizedGamePlatform ?? null;
      }
      if (bodyStartedAt !== undefined) {
        updateData.startedAt =
          bodyStartedAt == null ? null : parseManualLogDate(bodyStartedAt);
      } else if (isInProgress(status) && existing.startedAt == null) {
        updateData.startedAt = now;
      }
      if (bodyCompletedAt !== undefined) {
        updateData.completedAt =
          bodyCompletedAt == null ? null : parseManualLogDate(bodyCompletedAt);
      } else if (isCompleted(status)) {
        updateData.completedAt = now;
      }
      const prevSpendSnap = spendMonetarySnapshotFromLog(existing);
      const nextSpendSnap = spendMonetarySnapshotFromLog({
        purchaseAmountMinor: updateData.purchaseAmountMinor ?? null,
        purchaseCurrency: updateData.purchaseCurrency ?? null,
        saleAmountMinor: updateData.saleAmountMinor ?? null,
        saleCurrency: updateData.saleCurrency ?? null,
      });
      const spendAtNext = spendFieldsAtAfterSnapshotChange(prevSpendSnap, nextSpendSnap, now);
      if (spendAtNext !== undefined) updateData.spendFieldsAt = spendAtNext;
      log = await prisma.log.update({
        where: { id: existing.id },
        data: updateData,
      });
      await persistUserDefaultPurchaseCurrency(userId, log.purchaseAmountMinor, log.purchaseCurrency);
      await persistUserDefaultPurchaseCurrency(userId, log.saleAmountMinor, log.saleCurrency);
      let newBadges: NewBadge[] = [];
      const hasStatsReview = countsAsReviewForGamification(log.grade, log.review);
      if (!hadStatsReview && hasStatsReview) {
        try {
          newBadges = await handleReviewCreated(userId, log.id, log.mediaType, {
            grade: log.grade,
            review: log.review,
          });
        } catch (err) {
          console.error("Gamification (review stats added on upsert):", err);
        }
      } else if (hadStatsReview && !hasStatsReview) {
        try {
          await handleReviewRemoved(userId, log.mediaType);
        } catch (err) {
          console.error("Gamification (review stats removed on upsert):", err);
        }
      }
      const enrichedLog = await attachItemEnrichmentSingle(prisma, serializeLog(log));
      const body = enrichedLog as Record<string, unknown>;
      if (newBadges.length > 0) body.newBadges = newBadges;
      res.status(201).json(body);
      return;
    } else {
      // Enforce free-tier limit again immediately before create (prevents race conditions / bypass)
      const userForCreate = await prisma.user.findUnique({
        where: { id: userId },
        select: { tier: true },
      });
      if (!tierHasUnlimitedLogs(userForCreate?.tier ?? "free")) {
        const countBeforeCreate = await prisma.log.count({ where: { userId } });
        if (countBeforeCreate >= FREE_LOG_LIMIT) {
          res.status(403).json({
            error: "Log limit reached",
            code: "LOG_LIMIT_REACHED",
            limit: FREE_LOG_LIMIT,
          });
          return;
        }
      }
      log = await prisma.log.create({
        data: {
          userId,
          mediaType,
          externalId: sanitizedExternalId,
          title: sanitizedTitle,
          image: sanitizedImage ?? null,
          grade: grade ?? null,
          review: sanitizedReview,
          listType: listType ?? null,
          status: status ?? null,
          startedAt: createStartedAt,
          completedAt: createCompletedAt,
          contentHours: contentHours ?? null,
          hoursToBeat: hoursToBeat ?? null,
          season: season ?? null,
          episode: episode ?? null,
          chapter: chapter ?? null,
          volume: volume ?? null,
          pagesRead: bodyPagesRead ?? null,
          gamePlatform: sanitizedGamePlatform ?? null,
          genres: genresJson,
          mechanics: mechanicsJson,
          affinityContext: affinityStored !== undefined ? affinityStored : null,
          boardGameSource,
          own: ownershipNext != null && isSpendTrackedMediaType(mediaType) ? ownershipNext.own : null,
          wantToBuy:
            ownershipNext != null && isSpendTrackedMediaType(mediaType) ? ownershipNext.wantToBuy : null,
          sold: ownershipNext != null && isSpendTrackedMediaType(mediaType) ? ownershipNext.sold : null,
          matchesPlayed: mediaType === "boardgames" ? (bodyMatchesPlayed ?? null) : null,
          averageWeight:
            mediaType === "boardgames"
              ? averageWeightStored ?? boardGameAverageWeightFromAffinity(affinityInput ?? null)
              : null,
          purchaseAmountMinor: purchaseResolved.purchaseAmountMinor,
          purchaseCurrency: purchaseResolved.purchaseCurrency,
          saleAmountMinor: saleResolved.saleAmountMinor,
          saleCurrency: saleResolved.saleCurrency,
          spendFieldsAt: spendMonetaryHasAny(
            spendMonetarySnapshotFromLog({
              purchaseAmountMinor: purchaseResolved.purchaseAmountMinor,
              purchaseCurrency: purchaseResolved.purchaseCurrency,
              saleAmountMinor: saleResolved.saleAmountMinor,
              saleCurrency: saleResolved.saleCurrency,
            })
          )
            ? now
            : null,
        },
      });
      await persistUserDefaultPurchaseCurrency(userId, log.purchaseAmountMinor, log.purchaseCurrency);
      await persistUserDefaultPurchaseCurrency(userId, log.saleAmountMinor, log.saleCurrency);
      const newBadges: NewBadge[] = [];
      try {
        const fromLog = await handleLogCreated(userId);
        newBadges.push(...fromLog);
        if (countsAsReviewForGamification(log.grade, sanitizedReview)) {
          const fromReview = await handleReviewCreated(userId, log.id, mediaType, {
            grade: log.grade,
            review: sanitizedReview,
          });
          const seen = new Set(newBadges.map((b) => b.id));
          for (const b of fromReview) {
            if (!seen.has(b.id)) {
              seen.add(b.id);
              newBadges.push(b);
            }
          }
        }
      } catch (err) {
        console.error("Gamification:", err);
      }
      const enrichedLog = await attachItemEnrichmentSingle(prisma, serializeLog(log));
      const body = enrichedLog as Record<string, unknown>;
      if (newBadges.length > 0) body.newBadges = newBadges;
      res.status(201).json(body);
    }
  } catch (e) {
    res.status(500).json({ error: "Failed to save log" });
  }
});

const scopedReviewBodySchema = z.object({
  scope: z.enum(["show", "season", "episode"]),
  season: optionalInt,
  episode: optionalInt,
  grade: optionalInt,
  review: z.string().max(10_000).optional().nullable(),
});

function isTvOrAnime(mediaType: string): boolean {
  return mediaType === "tv" || mediaType === "anime";
}

/** GET /logs/:id/scoped-reviews — TV/anime granular reviews for this log. */
logsRouter.get("/:id/scoped-reviews", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const logId = req.params.id;
  const log = await prisma.log.findFirst({
    where: { id: logId, userId },
    select: { id: true, mediaType: true },
  });
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  if (!isTvOrAnime(log.mediaType)) {
    res.status(400).json({ error: "Scoped reviews are only for TV and anime" });
    return;
  }
  const rows = await prisma.scopedReview.findMany({
    where: { logId },
    orderBy: [{ seasonNum: "asc" }, { episodeNum: "asc" }],
  });
  const { serializeScopedReview } = await import("../lib/scopedReview.js");
  res.json({ data: rows.map(serializeScopedReview) });
});

/** PUT /logs/:id/scoped-reviews — upsert a season or episode review (show-level stays on the log). */
logsRouter.put("/:id/scoped-reviews", async (req: AuthenticatedRequest, res) => {
  const parsed = scopedReviewBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid scoped review body" });
    return;
  }
  if (parsed.data.scope === "show") {
    res.status(400).json({ error: "Use the main log form for the series review" });
    return;
  }
  const userId = req.user!.userId;
  const logId = req.params.id;
  const log = await prisma.log.findFirst({
    where: { id: logId, userId },
    select: { id: true, mediaType: true },
  });
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  if (!isTvOrAnime(log.mediaType)) {
    res.status(400).json({ error: "Scoped reviews are only for TV and anime" });
    return;
  }
  const { parseScopedScopeInput, serializeScopedReview } = await import("../lib/scopedReview.js");
  const scopeParsed = parseScopedScopeInput(
    parsed.data.scope,
    parsed.data.season,
    parsed.data.episode
  );
  if (!scopeParsed.ok) {
    res.status(400).json({ error: scopeParsed.error });
    return;
  }
  const grade = parsed.data.grade ?? null;
  const review = sanitizeReview(parsed.data.review ?? null);
  const hasContent = grade != null || (review != null && review.trim() !== "");
  const { seasonNum, episodeNum, scope } = scopeParsed;

  if (!hasContent) {
    await prisma.scopedReview.deleteMany({
      where: { logId, scope, seasonNum, episodeNum },
    });
    res.json({ data: null });
    return;
  }

  const row = await prisma.scopedReview.upsert({
    where: {
      logId_scope_seasonNum_episodeNum: { logId, scope, seasonNum, episodeNum },
    },
    create: {
      logId,
      scope,
      seasonNum,
      episodeNum,
      grade,
      review,
    },
    update: { grade, review },
  });
  res.json({ data: serializeScopedReview(row) });
});

/** List play sessions for a board-game log. */
logsRouter.get("/:id/board-game-matches", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const logId = req.params.id;
  const log = await prisma.log.findFirst({
    where: { id: logId, userId },
    select: { id: true, mediaType: true },
  });
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  if (log.mediaType !== "boardgames") {
    res.status(400).json({ error: "Matches are only for board game logs" });
    return;
  }
  const rows = await prisma.boardGameMatch.findMany({
    where: { logId },
    orderBy: [{ playedAt: "desc" }, { createdAt: "desc" }],
  });
  res.json({ data: rows.map(serializeBoardGameMatchRow) });
});

/** Add a play session; bumps log.matchesPlayed by 1 and sets status to played when it was not already. */
logsRouter.post("/:id/board-game-matches", async (req: AuthenticatedRequest, res) => {
  const parsed = createBoardGameMatchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.user!.userId;
  const logId = req.params.id;
  const log = await prisma.log.findFirst({
    where: { id: logId, userId },
    select: {
      id: true,
      mediaType: true,
      matchesPlayed: true,
      status: true,
      externalId: true,
      title: true,
      image: true,
      boardGameSource: true,
      genres: true,
      mechanics: true,
    },
  });
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  if (log.mediaType !== "boardgames") {
    res.status(400).json({ error: "Matches are only for board game logs" });
    return;
  }
  const playedAt = new Date(parsed.data.playedAt);
  if (Number.isNaN(playedAt.getTime())) {
    res.status(400).json({ error: { playedAt: ["Invalid date"] } });
    return;
  }
  const durationHoursRaw = parsed.data.durationHours ?? DEFAULT_BOARD_GAME_SESSION_DURATION_HOURS;
  if (!isBoardGameSessionDurationHours(durationHoursRaw)) {
    res.status(400).json({ error: { durationHours: ["Invalid session duration"] } });
    return;
  }
  const durationHours = durationHoursRaw;

  const playersPayload: BoardGameMatchPlayer[] = [];
  for (const p of parsed.data.players) {
    const appId = p.appUserId?.trim();
    if (appId) {
      const linked = await prisma.user.findFirst({
        where: { id: appId, username: { not: null } },
        select: { id: true, username: true },
      });
      if (!linked?.username) {
        res.status(400).json({ error: { players: ["Unknown or invalid app user for a player row"] } });
        return;
      }
      playersPayload.push({
        name: sanitizeText(linked.username.trim(), PLAYER_NAME_MAX) || linked.username,
        score: p.score === undefined ? null : p.score,
        winner: p.winner,
        appUserId: linked.id,
      });
    } else {
      playersPayload.push({
        name: sanitizeText(p.name.trim(), PLAYER_NAME_MAX) || "Player",
        score: p.score === undefined ? null : p.score,
        winner: p.winner,
      });
    }
  }
  const notes = sanitizeReview(parsed.data.notes ?? null);

  try {
    const now = new Date();
    const bumpToPlayed = log.status !== "played";
    const [match, updatedLog, createdTaggedLogUserIds] = await prisma.$transaction(async (tx) => {
      for (const pl of playersPayload) {
        if (pl.appUserId) continue;
        const rawLabel = pl.name.trim();
        const labelKey = rawLabel.toLowerCase();
        if (!labelKey) continue;
        const label = sanitizeText(rawLabel, PLAYER_NAME_MAX) || "Player";
        await tx.userBoardGameCustomOpponent.upsert({
          where: { userId_labelKey: { userId, labelKey } },
          create: { userId, label, labelKey },
          update: { label, lastUsedAt: now },
        });
      }
      const playersJson = JSON.stringify(
        playersPayload.map((pl) => ({
          name: pl.name,
          score: pl.score,
          winner: pl.winner,
          ...(pl.appUserId ? { appUserId: pl.appUserId } : {}),
        }))
      );
      const m = await tx.boardGameMatch.create({
        data: {
          logId,
          playedAt,
          durationHours,
          players: playersJson,
          notes,
        },
      });
      const nextCount = (log.matchesPlayed ?? 0) + 1;
      const ul = await tx.log.update({
        where: { id: logId },
        data: {
          matchesPlayed: nextCount,
          ...(bumpToPlayed
            ? {
                status: "played",
                completedAt: now,
              }
            : {}),
        },
      });
      const createdTaggedLogUserIds = await syncTaggedPlayersBoardGameLogs(tx, {
        hostUserId: userId,
        hostLog: {
          externalId: log.externalId,
          title: log.title,
          image: log.image,
          boardGameSource: log.boardGameSource,
          genres: log.genres,
          mechanics: log.mechanics,
        },
        playersPayload,
        playedAt,
        durationHours,
        playersJson,
        notes,
      });
      return [m, ul, createdTaggedLogUserIds] as const;
    });
    for (const taggedUserId of createdTaggedLogUserIds) {
      handleLogCreated(taggedUserId).catch((err) => {
        console.error("Gamification (tagged player log):", err);
      });
    }
    res.status(201).json({
      match: serializeBoardGameMatchRow(match),
      log: serializeLog(updatedLog),
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to save match" });
  }
});

/** Remove a play session; decrements log.matchesPlayed (min 0). */
logsRouter.delete("/:id/board-game-matches/:matchId", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const logId = req.params.id;
  const matchId = req.params.matchId;
  const log = await prisma.log.findFirst({
    where: { id: logId, userId },
    select: { id: true, mediaType: true, matchesPlayed: true },
  });
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  if (log.mediaType !== "boardgames") {
    res.status(400).json({ error: "Matches are only for board game logs" });
    return;
  }
  const existing = await prisma.boardGameMatch.findFirst({
    where: { id: matchId, logId },
  });
  if (!existing) {
    res.status(404).json({ error: "Match not found" });
    return;
  }
  try {
    const updatedLog = await prisma.$transaction(async (tx) => {
      await tx.boardGameMatch.delete({ where: { id: matchId } });
      const nextCount = Math.max(0, (log.matchesPlayed ?? 0) - 1);
      return tx.log.update({
        where: { id: logId },
        data: { matchesPlayed: nextCount },
      });
    });
    res.json({ log: serializeLog(updatedLog) });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete match" });
  }
});

logsRouter.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const parsed = updateLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.user!.userId;
  const log = await prisma.log.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  if (!validateStatus(log.mediaType as MediaType, parsed.data.status)) {
    res.status(400).json({ error: { status: ["Invalid status for this media type"] } });
    return;
  }
  const data: {
    image?: string | null;
    grade?: number | null;
    review?: string | null;
    listType?: string | null;
    status?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    contentHours?: number | null;
    hoursToBeat?: number | null;
    season?: number | null;
    episode?: number | null;
    chapter?: number | null;
    volume?: number | null;
    pagesRead?: number | null;
    gamePlatform?: string | null;
    genres?: string | null;
    mechanics?: string | null;
    affinityContext?: string | null;
    own?: boolean | null;
    wantToBuy?: boolean | null;
    sold?: boolean | null;
    matchesPlayed?: number | null;
    averageWeight?: number | null;
    purchaseAmountMinor?: number | null;
    purchaseCurrency?: string | null;
    saleAmountMinor?: number | null;
    saleCurrency?: string | null;
    spendFieldsAt?: Date | null;
  } = {};
  if (parsed.data.image !== undefined) data.image = sanitizeUrl(parsed.data.image) ?? null;
  if (parsed.data.grade !== undefined) data.grade = parsed.data.grade;
  if (parsed.data.review !== undefined) data.review = sanitizeReview(parsed.data.review);
  if (parsed.data.listType !== undefined) data.listType = parsed.data.listType;
  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
    const now = new Date();
    if (parsed.data.startedAt === undefined && isInProgress(parsed.data.status) && log.startedAt == null) {
      data.startedAt = now;
    }
    if (parsed.data.completedAt === undefined && isCompleted(parsed.data.status)) {
      data.completedAt = now;
    }
  }
  if (parsed.data.startedAt !== undefined) {
    data.startedAt =
      parsed.data.startedAt == null ? null : parseManualLogDate(parsed.data.startedAt);
  }
  if (parsed.data.completedAt !== undefined) {
    data.completedAt =
      parsed.data.completedAt == null ? null : parseManualLogDate(parsed.data.completedAt);
  }
  if (parsed.data.contentHours !== undefined) data.contentHours = parsed.data.contentHours;
  if (parsed.data.hoursToBeat !== undefined) data.hoursToBeat = parsed.data.hoursToBeat;
  if (parsed.data.season !== undefined) data.season = parsed.data.season;
  if (parsed.data.episode !== undefined) data.episode = parsed.data.episode;
  if (parsed.data.chapter !== undefined) data.chapter = parsed.data.chapter;
  if (parsed.data.volume !== undefined) data.volume = parsed.data.volume;
  if (parsed.data.pagesRead !== undefined) data.pagesRead = parsed.data.pagesRead;
  if (parsed.data.gamePlatform !== undefined) {
    data.gamePlatform =
      parsed.data.gamePlatform == null
        ? null
        : sanitizeText(parsed.data.gamePlatform, GAME_PLATFORM_MAX_LENGTH);
  }
  if (parsed.data.genres !== undefined) {
    data.genres = parsed.data.genres && parsed.data.genres.length > 0 ? JSON.stringify(parsed.data.genres.slice(0, 20)) : null;
  }
  if (parsed.data.mechanics !== undefined) {
    data.mechanics =
      parsed.data.mechanics && parsed.data.mechanics.length > 0
        ? JSON.stringify(parsed.data.mechanics.slice(0, 20))
        : null;
  }
  const logMediaType = log.mediaType as MediaType;
  if (parsed.data.affinityContext !== undefined) {
    data.affinityContext =
      parsed.data.affinityContext == null
        ? null
        : stringifyLogAffinityContext(parsed.data.affinityContext);
    if (logMediaType === "boardgames") {
      data.averageWeight = boardGameAverageWeightFromAffinity(parsed.data.affinityContext);
    }
  }
  const ownPatch = reconcileSpendTrackedOwnership(
    logMediaType,
    {
      own: parsed.data.own,
      wantToBuy: parsed.data.wantToBuy,
      sold: parsed.data.sold,
    },
    log
  );
  if (ownPatch != null) {
    data.own = ownPatch.own;
    data.wantToBuy = ownPatch.wantToBuy;
    data.sold = ownPatch.sold;
  }
  if (parsed.data.matchesPlayed !== undefined && logMediaType === "boardgames") {
    data.matchesPlayed = parsed.data.matchesPlayed ?? null;
  }
  if (parsed.data.purchaseAmountMinor !== undefined || parsed.data.purchaseCurrency !== undefined) {
    const pn = normalizePurchaseFields(
      logMediaType,
      parsed.data.purchaseAmountMinor,
      parsed.data.purchaseCurrency
    );
    if (!pn.ok) {
      res.status(400).json({ error: pn.error });
      return;
    }
    data.purchaseAmountMinor = pn.purchaseAmountMinor;
    data.purchaseCurrency = pn.purchaseCurrency;
  }
  const mergedSold = ownPatch != null ? ownPatch.sold === true : log.sold === true;
  if (
    parsed.data.saleAmountMinor !== undefined ||
    parsed.data.saleCurrency !== undefined ||
    ownPatch != null
  ) {
    if (!mergedSold) {
      data.saleAmountMinor = null;
      data.saleCurrency = null;
    } else if (parsed.data.saleAmountMinor !== undefined || parsed.data.saleCurrency !== undefined) {
      const sn = normalizeSaleFields(
        logMediaType,
        parsed.data.saleAmountMinor,
        parsed.data.saleCurrency
      );
      if (!sn.ok) {
        res.status(400).json({ error: sn.error });
        return;
      }
      data.saleAmountMinor = sn.saleAmountMinor;
      data.saleCurrency = sn.saleCurrency;
    }
  }
  const mergedPurchaseMinor =
    data.purchaseAmountMinor !== undefined ? data.purchaseAmountMinor : log.purchaseAmountMinor;
  const mergedPurchaseCurrency =
    data.purchaseCurrency !== undefined ? data.purchaseCurrency : log.purchaseCurrency;
  const mergedSaleMinor = data.saleAmountMinor !== undefined ? data.saleAmountMinor : log.saleAmountMinor;
  const mergedSaleCurrency =
    data.saleCurrency !== undefined ? data.saleCurrency : log.saleCurrency;
  const prevSpendSnapPatch = spendMonetarySnapshotFromLog(log);
  const nextSpendSnapPatch = spendMonetarySnapshotFromLog({
    purchaseAmountMinor: mergedPurchaseMinor,
    purchaseCurrency: mergedPurchaseCurrency,
    saleAmountMinor: mergedSaleMinor,
    saleCurrency: mergedSaleCurrency,
  });
  const spendAtPatch = spendFieldsAtAfterSnapshotChange(
    prevSpendSnapPatch,
    nextSpendSnapPatch,
    new Date()
  );
  if (spendAtPatch !== undefined) data.spendFieldsAt = spendAtPatch;
  const updated = await prisma.log.update({
    where: { id: log.id },
    data,
  });
  await persistUserDefaultPurchaseCurrency(userId, updated.purchaseAmountMinor, updated.purchaseCurrency);
  await persistUserDefaultPurchaseCurrency(userId, updated.saleAmountMinor, updated.saleCurrency);
  const hadStatsReview = countsAsReviewForGamification(log.grade, log.review);
  const hasStatsReview = countsAsReviewForGamification(updated.grade, updated.review);
  let newBadges: NewBadge[] = [];
  if (!hadStatsReview && hasStatsReview) {
    try {
      newBadges = await handleReviewCreated(userId, updated.id, log.mediaType, {
        grade: updated.grade,
        review: updated.review,
      });
    } catch (err) {
      console.error("Gamification (review stats added on PATCH):", err);
    }
  } else if (hadStatsReview && !hasStatsReview) {
    try {
      await handleReviewRemoved(userId, log.mediaType);
    } catch (err) {
      console.error("Gamification (review stats removed on PATCH):", err);
    }
  }
  const enrichedUpdated = await attachItemEnrichmentSingle(prisma, serializeLog(updated));
  const body = enrichedUpdated as Record<string, unknown>;
  if (newBadges.length > 0) body.newBadges = newBadges;
  res.json(body);
});

logsRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const log = await prisma.log.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  const hadStatsReview = countsAsReviewForGamification(log.grade, log.review);
  if (hadStatsReview) {
    try {
      await handleReviewRemoved(userId, log.mediaType);
    } catch (err) {
      console.error("Gamification (review stats removed on log delete):", err);
    }
  }
  await prisma.log.delete({ where: { id: log.id } });
  res.status(204).send();
});
