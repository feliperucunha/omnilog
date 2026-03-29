import { Router } from "express";
import { z } from "zod";
import {
  COMPLETED_STATUSES,
  IN_PROGRESS_STATUSES,
  LIST_TYPES,
  LOG_STATUS_OPTIONS,
  MEDIA_TYPES,
  SPEND_TRACKED_MEDIA_TYPES,
} from "@geeklogs/shared";
import type { MediaType } from "@geeklogs/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  sanitizeReview,
  sanitizeText,
  sanitizeUrl,
  TITLE_MAX_LENGTH,
  EXTERNAL_ID_MAX_LENGTH,
} from "../lib/sanitize.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js";
import type { NewBadge } from "../services/gamification.service.js";

export const logsRouter = Router();
logsRouter.use(authMiddleware);

const optionalInt = z.number().int().min(0).nullable().optional();

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
  contentHours: optionalFloat,
  hoursToBeat: optionalFloat,
  genres: genresSchema,
  mechanics: mechanicsSchema,
  affinityContext: affinityContextSchema,
  boardGameSource: z.enum(["bgg", "ludopedia"]).nullable().optional(),
  own: z.boolean().nullable().optional(),
  wantToBuy: z.boolean().nullable().optional(),
  matchesPlayed: z.number().int().min(0).nullable().optional(),
  purchaseAmountMinor: z.number().int().min(0).max(999_999_999_999).nullable().optional(),
  purchaseCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Za-z]{3}$/)
    .nullable()
    .optional()
    .transform((s) => (s == null ? null : s.toUpperCase())),
});

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
  contentHours: optionalFloat,
  hoursToBeat: optionalFloat,
  genres: genresSchema,
  mechanics: mechanicsSchema,
  affinityContext: affinityContextSchema,
  own: z.boolean().nullable().optional(),
  wantToBuy: z.boolean().nullable().optional(),
  matchesPlayed: z.number().int().min(0).nullable().optional(),
  purchaseAmountMinor: z.number().int().min(0).max(999_999_999_999).nullable().optional(),
  purchaseCurrency: z
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

import { persistUserDefaultPurchaseCurrency } from "../lib/userPurchasePreference.js";
import { parseGenresJson, serializeLog } from "../lib/serializeLog.js";
import { stringifyLogAffinityContext, logAffinityContextSchema } from "../lib/logAffinityContext.js";
import { hoursFromCompletedLogForStats, rollupHoursFromCompletedLogs } from "../lib/completedLogHours.js";
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
  purchaseLogCreatedAtRange,
  localDayBoundsFromDateString,
  type PurchasePeriod,
} from "../lib/purchaseFields.js";

const FREE_LOG_LIMIT = 500;

const PAGINATION_LIMIT_DEFAULT = 25;
const PAGINATION_LIMIT_MAX = 100;

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
  const rows = await prisma.log.groupBy({
    by: ["status"],
    where: { userId, mediaType },
    _count: { id: true },
  });
  let total = 0;
  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    const key = row.status ?? "";
    byStatus[key] = row._count.id;
    total += row._count.id;
  }
  res.json({ data: { total, byStatus } });
});

logsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const mediaType = req.query.mediaType as MediaType | undefined;
  const externalId = req.query.externalId as string | undefined;
  const status = req.query.status as string | undefined;
  const sortParam = req.query.sort as string;
  const validSorts = ["dateAsc", "dateDesc", "gradeAsc", "gradeDesc"] as const;
  const boardgameSorts = ["matchesPlayedAsc", "matchesPlayedDesc"] as const;
  const gameSorts = ["timeToBeatAsc", "timeToBeatDesc"] as const;
  let sort = validSorts.includes(sortParam as (typeof validSorts)[number]) ? sortParam : "dateDesc";
  if (mediaType === "boardgames" && boardgameSorts.includes(sortParam as (typeof boardgameSorts)[number])) sort = sortParam;
  else if (mediaType === "games" && gameSorts.includes(sortParam as (typeof gameSorts)[number])) sort = sortParam;
  const ownFilter = req.query.own === "true";
  const wantToBuyFilter = req.query.wantToBuy === "true";
  const purchasedFilter = req.query.purchased === "true" || req.query.purchased === "1";
  const limitParam = req.query.limit != null ? parseInt(String(req.query.limit), 10) : NaN;
  const usePagination = Number.isInteger(limitParam) && limitParam >= 1 && limitParam <= PAGINATION_LIMIT_MAX;
  const takeSize = usePagination ? Math.min(limitParam, PAGINATION_LIMIT_MAX) : undefined;
  const cursorId = typeof req.query.cursor === "string" && req.query.cursor.length > 0 ? req.query.cursor : undefined;

  const where: Prisma.LogWhereInput = { userId };
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
    where.purchaseAmountMinor = { not: null };
    where.purchaseCurrency = { not: null };
    const dateRaw = typeof req.query.purchaseDate === "string" ? req.query.purchaseDate.trim() : "";
    if (dateRaw !== "") {
      const tzRaw = req.query.timezoneOffsetMinutes;
      const tzOffsetMinutes =
        typeof tzRaw === "string" && tzRaw !== "" && Number.isFinite(parseInt(tzRaw, 10))
          ? parseInt(tzRaw, 10)
          : 0;
      const bounds = localDayBoundsFromDateString(dateRaw, tzOffsetMinutes);
      if (bounds) where.createdAt = { gte: bounds.gte, lte: bounds.lte };
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
        if (range) where.createdAt = { gte: range.gte, lte: range.lte };
      }
    }
  }

  const orderBy: Prisma.LogOrderByWithRelationInput[] | Prisma.LogOrderByWithRelationInput =
    sort === "matchesPlayedDesc"
      ? [{ matchesPlayed: "desc" }, { updatedAt: "desc" }]
      : sort === "matchesPlayedAsc"
        ? [{ matchesPlayed: "asc" }, { updatedAt: "desc" }]
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
    res.json({ data, nextCursor });
    return;
  }

  const logs = await prisma.log.findMany({
    where,
    orderBy,
  });
  res.json(logs.map(serializeLog));
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
  const data = rows.map((row) => {
    const { user, ...log } = row;
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
    return {
      log: serialized,
      user: {
        id: user.id,
        username: user.username ?? null,
      },
    };
  });
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

/** GET /logs/stats?group=summary|category|month|year|genre|completedByMonth|completedByYear|categoryByMonth|categoryByYear - summary = account totals; category/month/year rows include { hours, count }; genre uses unique log counts per genre name */
logsRouter.get("/stats", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const groupParam = req.query.group as string;
  const group =
    groupParam === "summary"
      ? "summary"
      : groupParam === "year"
        ? "year"
        : groupParam === "genre"
          ? "genre"
          : groupParam === "category"
            ? "category"
            : groupParam === "completedByYear"
              ? "completedByYear"
              : groupParam === "completedByMonth"
                ? "completedByMonth"
                : groupParam === "categoryByYear"
                  ? "categoryByYear"
                  : groupParam === "categoryByMonth"
                    ? "categoryByMonth"
                    : groupParam === "purchaseSpending"
                      ? "purchaseSpending"
                      : groupParam === "month"
                        ? "month"
                        : "month";

  if (group === "purchaseSpending") {
    const periodRaw = typeof req.query.period === "string" ? req.query.period.trim() : "month";
    const period: PurchasePeriod =
      periodRaw === "year" || periodRaw === "all" ? periodRaw : "month";
    const tzRaw = req.query.timezoneOffsetMinutes;
    const tzOffsetMinutes =
      typeof tzRaw === "string" && tzRaw !== "" && Number.isFinite(parseInt(tzRaw, 10))
        ? parseInt(tzRaw, 10)
        : 0;
    const range = purchaseLogCreatedAtRange(period, tzOffsetMinutes);
    const logs = await prisma.log.findMany({
      where: {
        userId,
        purchaseAmountMinor: { not: null },
        purchaseCurrency: { not: null },
        mediaType: { in: [...SPEND_TRACKED_MEDIA_TYPES] },
        ...(range ? { createdAt: { gte: range.gte, lte: range.lte } } : {}),
      },
      select: { mediaType: true, purchaseAmountMinor: true, purchaseCurrency: true },
    });
    const data: Record<string, Record<string, number>> = Object.fromEntries(
      SPEND_TRACKED_MEDIA_TYPES.map((mt) => [mt, {} as Record<string, number>])
    );
    const counts: Record<string, number> = Object.fromEntries(
      SPEND_TRACKED_MEDIA_TYPES.map((mt) => [mt, 0])
    );
    for (const row of logs) {
      const n = row.purchaseAmountMinor;
      const cur = row.purchaseCurrency;
      if (n == null || cur == null) continue;
      const k = row.mediaType as string;
      if (!(k in data)) continue;
      const bucket = data[k];
      bucket[cur] = (bucket[cur] ?? 0) + n;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    res.json({ group: "purchaseSpending", period, data, counts });
    return;
  }

  if (group === "summary") {
    const [totalLogs, completedLogCount, reviewedLogs, completedLogs] = await Promise.all([
      prisma.log.count({ where: { userId } }),
      prisma.log.count({ where: { userId, completedAt: { not: null } } }),
      prisma.log.count({ where: { userId, grade: { not: null } } }),
      prisma.log.findMany({
        where: { userId, completedAt: { not: null } },
        select: {
          completedAt: true,
          contentHours: true,
          startedAt: true,
          mediaType: true,
          hoursToBeat: true,
          matchesPlayed: true,
        },
      }),
    ]);
    const { totalHours, logsWithPositiveHours } = rollupHoursFromCompletedLogs(completedLogs);
    res.json({
      group: "summary",
      data: {
        totalLogs,
        completedLogs: completedLogCount,
        reviewedLogs,
        totalContentHours: totalHours,
        completedLogsWithHours: logsWithPositiveHours,
      },
    });
    return;
  }

  if (group === "genre") {
    const logs = await prisma.log.findMany({
      where: { userId, genres: { not: null } },
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
    const logs = await prisma.log.findMany({
      where: { userId, completedAt: { not: null } },
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
    const logs = await prisma.log.findMany({
      where: { userId, completedAt: { not: null } },
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

  const logs = await prisma.log.findMany({
    where: {
      userId,
      completedAt: { not: null },
    },
    select: { completedAt: true, contentHours: true, startedAt: true, mediaType: true, hoursToBeat: true, matchesPlayed: true },
  });
  const byKeyHours: Record<string, number> = {};
  const byKeyCount: Record<string, number> = {};
  for (const log of logs) {
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

/** GET /logs/by-date?date=YYYY-MM-DD&timezoneOffsetMinutes=? - Logs completed or started on the given date (in user's local time). Pro only. Returns { data: Log[] }. */
logsRouter.get("/by-date", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  const hasProAccess = user != null && tierHasProFeatures(user.tier);
  if (!hasProAccess) {
    res.json({ data: [] });
    return;
  }
  const dateParam = typeof req.query.date === "string" ? req.query.date.trim() : "";
  const tzOffsetMinutes = typeof req.query.timezoneOffsetMinutes === "string"
    ? parseInt(req.query.timezoneOffsetMinutes, 10)
    : 0;
  const bounds = localDayBoundsFromDateString(dateParam, Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0);
  if (!bounds) {
    res.status(400).json({ error: "Invalid date; use YYYY-MM-DD" });
    return;
  }
  const { gte: start, lte: end } = bounds;
  const logs = await prisma.log.findMany({
    where: {
      userId,
      OR: [
        { completedAt: { gte: start, lte: end } },
        { startedAt: { gte: start, lte: end } },
      ],
    },
    orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }, { updatedAt: "desc" }],
  });
  res.json({ data: logs.map(serializeLog) });
});

/** GET /logs/calendar?year=YYYY&month=M - Start and end dates per day for a month. Pro only; free accounts get no data. */
logsRouter.get("/calendar", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  const hasProAccess = user != null && tierHasProFeatures(user.tier);
  if (!hasProAccess) {
    const year = typeof req.query.year === "string" ? parseInt(req.query.year, 10) : new Date().getFullYear();
    const month = typeof req.query.month === "string" ? parseInt(req.query.month, 10) : new Date().getMonth() + 1;
    res.json({ year: Number.isFinite(year) ? year : new Date().getFullYear(), month: Number.isFinite(month) ? month : new Date().getMonth() + 1, dates: {} });
    return;
  }
  const yearParam = typeof req.query.year === "string" ? parseInt(req.query.year, 10) : new Date().getFullYear();
  const monthParam = typeof req.query.month === "string" ? parseInt(req.query.month, 10) : new Date().getMonth() + 1;
  const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();
  const month = Number.isFinite(monthParam) ? Math.max(1, Math.min(12, monthParam)) : new Date().getMonth() + 1;
  const tzOffsetMinutes = typeof req.query.timezoneOffsetMinutes === "string"
    ? parseInt(req.query.timezoneOffsetMinutes, 10)
    : 0;
  const offsetMs = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes * 60 * 1000 : 0;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const logs = await prisma.log.findMany({
    where: {
      userId,
      OR: [
        { startedAt: { gte: start, lte: end } },
        { completedAt: { gte: start, lte: end } },
      ],
    },
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
  "startedAt", "completedAt", "contentHours", "hoursToBeat", "own", "wantToBuy", "matchesPlayed",
  "purchaseAmountMinor", "purchaseCurrency", "review", "createdAt", "updatedAt",
];
const EXPORT_COLUMNS_BY_MEDIA: Record<MediaType, readonly string[]> = {
  movies: ["externalId", "title", "grade", "status", "startedAt", "completedAt", "review", "createdAt", "updatedAt"],
  tv: ["externalId", "title", "grade", "status", "season", "episode", "contentHours", "startedAt", "completedAt", "review", "createdAt", "updatedAt"],
  anime: ["externalId", "title", "grade", "status", "season", "episode", "contentHours", "startedAt", "completedAt", "review", "createdAt", "updatedAt"],
  books: ["externalId", "title", "grade", "status", "chapter", "volume", "contentHours", "startedAt", "completedAt", "review", "createdAt", "updatedAt"],
  manga: [
    "externalId", "title", "grade", "status", "chapter", "volume", "contentHours", "purchaseAmountMinor",
    "purchaseCurrency", "startedAt", "completedAt", "review", "createdAt", "updatedAt",
  ],
  comics: [
    "externalId", "title", "grade", "status", "chapter", "volume", "contentHours", "purchaseAmountMinor",
    "purchaseCurrency", "startedAt", "completedAt", "review", "createdAt", "updatedAt",
  ],
  games: [
    "externalId", "title", "grade", "status", "contentHours", "hoursToBeat", "own", "wantToBuy",
    "purchaseAmountMinor", "purchaseCurrency", "startedAt", "completedAt", "review", "createdAt", "updatedAt",
  ],
  boardgames: [
    "externalId", "title", "grade", "status", "own", "wantToBuy", "matchesPlayed",
    "purchaseAmountMinor", "purchaseCurrency", "startedAt", "completedAt", "review", "createdAt", "updatedAt",
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
    startedAt: Date | null;
    completedAt: Date | null;
    contentHours: number | null;
    hoursToBeat: number | null;
    own: boolean | null;
    wantToBuy: boolean | null;
    matchesPlayed: number | null;
    review: string | null;
    createdAt: Date;
    updatedAt: Date;
    purchaseAmountMinor?: number | null;
    purchaseCurrency?: string | null;
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
    case "startedAt": return log.startedAt?.toISOString() ?? null;
    case "completedAt": return log.completedAt?.toISOString() ?? null;
    case "contentHours": return log.contentHours;
    case "hoursToBeat": return log.hoursToBeat;
    case "own": return log.own == null ? null : log.own ? "true" : "false";
    case "wantToBuy": return log.wantToBuy == null ? null : log.wantToBuy ? "true" : "false";
    case "matchesPlayed": return log.matchesPlayed;
    case "review": return log.review;
    case "createdAt": return log.createdAt.toISOString();
    case "updatedAt": return log.updatedAt.toISOString();
    case "purchaseAmountMinor": return log.purchaseAmountMinor ?? null;
    case "purchaseCurrency": return log.purchaseCurrency ?? null;
    default: return undefined;
  }
}

/** GET /logs/export - Pro only; returns user logs as CSV. Optional ?mediaType= for single category (then only relevant columns). */
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

  const where = { userId } as { userId: string; mediaType?: string };
  if (mediaTypeFilter) where.mediaType = mediaTypeFilter;

  const logs = await prisma.log.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });
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
    contentHours,
    hoursToBeat,
    genres: genresInput,
    mechanics: mechanicsInput,
    affinityContext: affinityInput,
    boardGameSource: bodyBoardGameSource,
    own: bodyOwn,
    wantToBuy: bodyWantToBuy,
    matchesPlayed: bodyMatchesPlayed,
    purchaseAmountMinor: bodyPurchaseAmountMinor,
    purchaseCurrency: bodyPurchaseCurrency,
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
  const sanitizedTitle = sanitizeText(title, TITLE_MAX_LENGTH);
  const sanitizedExternalId = sanitizeText(externalId, EXTERNAL_ID_MAX_LENGTH);
  if (!sanitizedTitle || !sanitizedExternalId) {
    res.status(400).json({ error: "Invalid title or externalId" });
    return;
  }
  const sanitizedImage = image != null ? sanitizeUrl(image) : null;
  const sanitizedReview = sanitizeReview(review ?? null);
  const now = new Date();
  const createStartedAt = isInProgress(status) ? now : null;
  const createCompletedAt = isCompleted(status) ? now : null;
  const grade = isInProgress(status) ? null : (gradeInput ?? null);
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
        genres?: string | null;
        mechanics?: string | null;
        affinityContext?: string | null;
        own?: boolean | null;
        wantToBuy?: boolean | null;
        matchesPlayed?: number | null;
        purchaseAmountMinor?: number | null;
        purchaseCurrency?: string | null;
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
      };
      if (image !== undefined) updateData.image = sanitizedImage ?? null;
      if (genresJson !== undefined) updateData.genres = genresJson;
      if (mechanicsJson !== undefined) updateData.mechanics = mechanicsJson;
      if (affinityStored !== undefined) updateData.affinityContext = affinityStored;
      if (bodyOwn !== undefined && isSpendTrackedMediaType(mediaType)) {
        updateData.own = bodyOwn ?? null;
      }
      if (bodyWantToBuy !== undefined && isSpendTrackedMediaType(mediaType)) {
        updateData.wantToBuy = bodyWantToBuy ?? null;
      }
      if (bodyMatchesPlayed !== undefined && mediaType === "boardgames") {
        updateData.matchesPlayed = bodyMatchesPlayed ?? null;
      }
      if (isInProgress(status) && existing.startedAt == null) updateData.startedAt = now;
      if (isCompleted(status)) updateData.completedAt = now;
      log = await prisma.log.update({
        where: { id: existing.id },
        data: updateData,
      });
      await persistUserDefaultPurchaseCurrency(userId, log.purchaseAmountMinor, log.purchaseCurrency);
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
      const body = serializeLog(log) as Record<string, unknown>;
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
          genres: genresJson,
          mechanics: mechanicsJson,
          affinityContext: affinityStored !== undefined ? affinityStored : null,
          boardGameSource,
          own: isSpendTrackedMediaType(mediaType) ? (bodyOwn ?? null) : null,
          wantToBuy: isSpendTrackedMediaType(mediaType) ? (bodyWantToBuy ?? null) : null,
          matchesPlayed: mediaType === "boardgames" ? (bodyMatchesPlayed ?? null) : null,
          purchaseAmountMinor: purchaseResolved.purchaseAmountMinor,
          purchaseCurrency: purchaseResolved.purchaseCurrency,
        },
      });
      await persistUserDefaultPurchaseCurrency(userId, log.purchaseAmountMinor, log.purchaseCurrency);
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
      const body = serializeLog(log) as Record<string, unknown>;
      if (newBadges.length > 0) body.newBadges = newBadges;
      res.status(201).json(body);
    }
  } catch (e) {
    res.status(500).json({ error: "Failed to save log" });
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
    genres?: string | null;
    mechanics?: string | null;
    affinityContext?: string | null;
    own?: boolean | null;
    wantToBuy?: boolean | null;
    matchesPlayed?: number | null;
    purchaseAmountMinor?: number | null;
    purchaseCurrency?: string | null;
  } = {};
  if (parsed.data.image !== undefined) data.image = sanitizeUrl(parsed.data.image) ?? null;
  if (parsed.data.grade !== undefined) data.grade = parsed.data.grade;
  if (parsed.data.review !== undefined) data.review = sanitizeReview(parsed.data.review);
  if (parsed.data.listType !== undefined) data.listType = parsed.data.listType;
  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
    const now = new Date();
    if (isInProgress(parsed.data.status) && log.startedAt == null) data.startedAt = now;
    if (isCompleted(parsed.data.status)) data.completedAt = now;
  }
  if (parsed.data.contentHours !== undefined) data.contentHours = parsed.data.contentHours;
  if (parsed.data.hoursToBeat !== undefined) data.hoursToBeat = parsed.data.hoursToBeat;
  if (parsed.data.season !== undefined) data.season = parsed.data.season;
  if (parsed.data.episode !== undefined) data.episode = parsed.data.episode;
  if (parsed.data.chapter !== undefined) data.chapter = parsed.data.chapter;
  if (parsed.data.volume !== undefined) data.volume = parsed.data.volume;
  if (parsed.data.genres !== undefined) {
    data.genres = parsed.data.genres && parsed.data.genres.length > 0 ? JSON.stringify(parsed.data.genres.slice(0, 20)) : null;
  }
  if (parsed.data.mechanics !== undefined) {
    data.mechanics =
      parsed.data.mechanics && parsed.data.mechanics.length > 0
        ? JSON.stringify(parsed.data.mechanics.slice(0, 20))
        : null;
  }
  if (parsed.data.affinityContext !== undefined) {
    data.affinityContext =
      parsed.data.affinityContext == null
        ? null
        : stringifyLogAffinityContext(parsed.data.affinityContext);
  }
  const logMediaType = log.mediaType as MediaType;
  if (parsed.data.own !== undefined && isSpendTrackedMediaType(logMediaType)) {
    data.own = parsed.data.own ?? null;
  }
  if (parsed.data.wantToBuy !== undefined && isSpendTrackedMediaType(logMediaType)) {
    data.wantToBuy = parsed.data.wantToBuy ?? null;
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
  if (isInProgress(parsed.data.status)) data.grade = null;
  const updated = await prisma.log.update({
    where: { id: log.id },
    data,
  });
  await persistUserDefaultPurchaseCurrency(userId, updated.purchaseAmountMinor, updated.purchaseCurrency);
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
  const body = serializeLog(updated) as Record<string, unknown>;
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
