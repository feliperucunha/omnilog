import { Router } from "express";
import { z } from "zod";
import {
  COMPLETED_STATUSES,
  IN_PROGRESS_STATUSES,
  LIST_TYPES,
  LOG_STATUS_OPTIONS,
  MEDIA_TYPES,
} from "@logeverything/shared";
import type { MediaType } from "@logeverything/shared";
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

export const logsRouter = Router();
logsRouter.use(authMiddleware);

const optionalInt = z.number().int().min(0).nullable().optional();

const optionalFloat = z.number().min(0).nullable().optional();

const genresSchema = z.array(z.string().min(1).max(80)).max(20).optional().nullable();

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
  boardGameSource: z.enum(["bgg", "ludopedia"]).nullable().optional(),
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

import { parseGenresJson, serializeLog } from "../lib/serializeLog.js";
import { getReactionsForLogs } from "../lib/reactions.js";
import {
  handleLogCreated,
  handleReviewCreated,
  handleReviewLiked,
} from "../services/gamification.service.js";

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
  const sort = (req.query.sort as string) === "grade" ? "grade" : "date";
  const limitParam = req.query.limit != null ? parseInt(String(req.query.limit), 10) : NaN;
  const usePagination = Number.isInteger(limitParam) && limitParam >= 1 && limitParam <= PAGINATION_LIMIT_MAX;
  const takeSize = usePagination ? Math.min(limitParam, PAGINATION_LIMIT_MAX) : undefined;
  const cursorId = typeof req.query.cursor === "string" && req.query.cursor.length > 0 ? req.query.cursor : undefined;

  const where = { userId } as { userId: string; mediaType?: string; externalId?: string; status?: string };
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

  const orderBy: Prisma.LogOrderByWithRelationInput[] | Prisma.LogOrderByWithRelationInput =
    sort === "grade"
      ? [{ grade: "desc" }, { updatedAt: "desc" }]
      : { updatedAt: "desc" };

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

/** GET /logs/feed - Up to 5 recent logs from followed users, ordered by startedAt desc (for Social section). */
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
  const rows = await prisma.log.findMany({
    where: { userId: { in: followingIds } },
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

/** GET /logs/stats?group=category|month|year|genre|completedByMonth|completedByYear - hours (or count for genre/completedBy*) per category/period/genre */
logsRouter.get("/stats", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const groupParam = req.query.group as string;
  const group =
    groupParam === "year"
      ? "year"
      : groupParam === "genre"
        ? "genre"
        : groupParam === "category"
          ? "category"
          : groupParam === "completedByYear"
            ? "completedByYear"
            : groupParam === "completedByMonth"
              ? "completedByMonth"
              : groupParam === "month"
                ? "month"
                : "month";

  if (group === "genre") {
    const logs = await prisma.log.findMany({
      where: { userId, genres: { not: null } },
      select: { genres: true },
    });
    const byGenre: Record<string, number> = {};
    for (const log of logs) {
      const genres = parseGenresJson(log.genres);
      if (!genres) continue;
      for (const g of genres) {
        const name = g.trim();
        if (name) byGenre[name] = (byGenre[name] ?? 0) + 1;
      }
    }
    const entries = Object.entries(byGenre)
      .sort(([, a], [, b]) => b - a)
      .map(([period, count]) => ({ period, hours: count }));
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
      .map(([period, count]) => ({ period, hours: count }));
    res.json({ group, data: entries });
    return;
  }

  const logs = await prisma.log.findMany({
    where: {
      userId,
      completedAt: { not: null },
    },
    select: { completedAt: true, contentHours: true, startedAt: true, mediaType: true },
  });
  const byKey: Record<string, number> = {};
  const MS_PER_HOUR = 60 * 60 * 1000;
  const FALLBACK_MAX_HOURS = 24; // cap derived hours (start→finish) so multi-day completions don't inflate stats
  for (const log of logs) {
    if (log.completedAt == null) continue;
    let hours: number;
    if (log.contentHours != null && log.contentHours > 0) {
      hours = log.contentHours;
    } else if (log.startedAt != null) {
      const elapsedMs = log.completedAt.getTime() - log.startedAt.getTime();
      hours = Math.min(elapsedMs / MS_PER_HOUR, FALLBACK_MAX_HOURS);
      if (hours <= 0) continue;
    } else {
      continue;
    }
    const key =
      group === "category"
        ? (log.mediaType as string)
        : group === "year"
          ? `${log.completedAt.getUTCFullYear()}`
          : `${log.completedAt.getUTCFullYear()}-${String(log.completedAt.getUTCMonth() + 1).padStart(2, "0")}`;
    byKey[key] = (byKey[key] ?? 0) + hours;
  }
  const entries = Object.entries(byKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, hours]) => ({ period, hours: Math.round(hours * 10) / 10 }));
  res.json({ group, data: entries });
});

/** GET /logs/by-date?date=YYYY-MM-DD&timezoneOffsetMinutes=? - Logs completed or started on the given date (in user's local time). Pro only. Returns { data: Log[] }. */
logsRouter.get("/by-date", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  if (user?.tier !== "pro") {
    res.json({ data: [] });
    return;
  }
  const dateParam = typeof req.query.date === "string" ? req.query.date.trim() : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
  if (!match) {
    res.status(400).json({ error: "Invalid date; use YYYY-MM-DD" });
    return;
  }
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }
  const tzOffsetMinutes = typeof req.query.timezoneOffsetMinutes === "string"
    ? parseInt(req.query.timezoneOffsetMinutes, 10)
    : 0;
  const offsetMs = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes * 60 * 1000 : 0;
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMs);
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offsetMs);
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
  if (user?.tier !== "pro") {
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

/** GET /logs/export - Pro only; returns user logs as CSV. Optional ?mediaType= for single category. */
logsRouter.get("/export", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  if (user?.tier !== "pro") {
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
  const header =
    "mediaType,externalId,title,grade,status,season,episode,chapter,volume,startedAt,completedAt,contentHours,hoursToBeat,review,createdAt,updatedAt\n";
  const escape = (v: string | number | null | undefined): string => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = logs.map(
    (l) =>
      [
        escape(l.mediaType),
        escape(l.externalId),
        escape(l.title),
        escape(l.grade),
        escape(l.status),
        escape(l.season),
        escape(l.episode),
        escape(l.chapter),
        escape(l.volume),
        escape(l.startedAt?.toISOString()),
        escape(l.completedAt?.toISOString()),
        escape(l.contentHours),
        escape(l.hoursToBeat),
        escape(l.review),
        escape(l.createdAt?.toISOString()),
        escape(l.updatedAt?.toISOString()),
      ].join(",")
  );
  const csv = header + rows.join("\n");
  const filename = mediaTypeFilter ? `logs-${mediaTypeFilter}.csv` : "logs-export.csv";
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
    boardGameSource: bodyBoardGameSource,
  } = parsed.data;
  const genresJson =
    genresInput && genresInput.length > 0
      ? JSON.stringify(genresInput.slice(0, 20))
      : null;
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
      const tier = user?.tier === "pro" ? "pro" : "free";
      if (tier === "free") {
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
    let log;
    if (existing) {
      const hadReview = Boolean(existing.review && existing.review.trim().length > 0);
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
      };
      if (image !== undefined) updateData.image = sanitizedImage ?? null;
      if (genresJson !== undefined) updateData.genres = genresJson;
      if (isInProgress(status) && existing.startedAt == null) updateData.startedAt = now;
      if (isCompleted(status)) updateData.completedAt = now;
      log = await prisma.log.update({
        where: { id: existing.id },
        data: updateData,
      });
      if (!hadReview && sanitizedReview && sanitizedReview.trim().length > 0) {
        handleReviewCreated(userId, log.id, log.mediaType, sanitizedReview).catch(() => {});
      }
    } else {
      // Enforce free-tier limit again immediately before create (prevents race conditions / bypass)
      const userForCreate = await prisma.user.findUnique({
        where: { id: userId },
        select: { tier: true },
      });
      const tierForCreate = userForCreate?.tier === "pro" ? "pro" : "free";
      if (tierForCreate === "free") {
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
          boardGameSource,
        },
      });
      handleLogCreated(userId).catch(() => {});
      if (sanitizedReview && sanitizedReview.trim().length > 0) {
        handleReviewCreated(userId, log.id, mediaType, sanitizedReview).catch(() => {});
      }
    }
    res.status(201).json(serializeLog(log));
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
  if (isInProgress(parsed.data.status)) data.grade = null;
  const updated = await prisma.log.update({
    where: { id: log.id },
    data,
  });
  const hadReview = Boolean(log.review && log.review.trim().length > 0);
  const newReview =
    parsed.data.review !== undefined ? sanitizeReview(parsed.data.review) : null;
  if (
    parsed.data.review !== undefined &&
    !hadReview &&
    newReview &&
    newReview.trim().length > 0
  ) {
    handleReviewCreated(userId, updated.id, log.mediaType, newReview).catch(() => {});
  }
  res.json(serializeLog(updated));
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
  await prisma.log.delete({ where: { id: log.id } });
  res.status(204).send();
});
