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

const createLogSchema = z.object({
  mediaType: z.enum(MEDIA_TYPES as unknown as [string, ...string[]]),
  externalId: z.string().min(1).max(EXTERNAL_ID_MAX_LENGTH),
  title: z.string().min(1).max(TITLE_MAX_LENGTH),
  image: z.string().url().max(2048).nullable().optional(),
  grade: z.number().min(0).max(10),
  review: z.string().nullable().optional(),
  listType: z.enum(LIST_TYPES as unknown as [string, ...string[]]).nullable().optional(),
  status: z.string().nullable().optional(),
  season: optionalInt,
  episode: optionalInt,
  chapter: optionalInt,
  volume: optionalInt,
  contentHours: optionalFloat,
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

const FREE_LOG_LIMIT = 500;

logsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const mediaType = req.query.mediaType as MediaType | undefined;
  const externalId = req.query.externalId as string | undefined;
  const status = req.query.status as string | undefined;
  const sort = (req.query.sort as string) === "grade" ? "grade" : "date";

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

  const logs = await prisma.log.findMany({
    where,
    orderBy,
  });
  res.json(logs);
});

/** GET /logs/stats?group=category|month|year - hours of content completed per category or per period */
logsRouter.get("/stats", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const groupParam = req.query.group as string;
  const group = groupParam === "year" ? "year" : groupParam === "category" ? "category" : "month";
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
    "mediaType,externalId,title,grade,status,season,episode,chapter,volume,startedAt,completedAt,contentHours,review,createdAt,updatedAt\n";
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
    grade,
    review,
    listType,
    status,
    season,
    episode,
    chapter,
    volume,
    contentHours,
    boardGameSource: bodyBoardGameSource,
  } = parsed.data;
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
        season: number | null;
        episode: number | null;
        chapter: number | null;
        volume: number | null;
      } = {
        title: sanitizedTitle,
        grade: grade ?? null,
        review: sanitizedReview,
        listType: listType ?? null,
        status: status ?? null,
        contentHours: contentHours ?? null,
        season: season ?? null,
        episode: episode ?? null,
        chapter: chapter ?? null,
        volume: volume ?? null,
      };
      if (image !== undefined) updateData.image = sanitizedImage ?? null;
      if (isInProgress(status) && existing.startedAt == null) updateData.startedAt = now;
      if (isCompleted(status)) updateData.completedAt = now;
      log = await prisma.log.update({
        where: { id: existing.id },
        data: updateData,
      });
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
          season: season ?? null,
          episode: episode ?? null,
          chapter: chapter ?? null,
          volume: volume ?? null,
          boardGameSource,
        },
      });
    }
    res.status(201).json(log);
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
    season?: number | null;
    episode?: number | null;
    chapter?: number | null;
    volume?: number | null;
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
  if (parsed.data.season !== undefined) data.season = parsed.data.season;
  if (parsed.data.episode !== undefined) data.episode = parsed.data.episode;
  if (parsed.data.chapter !== undefined) data.chapter = parsed.data.chapter;
  if (parsed.data.volume !== undefined) data.volume = parsed.data.volume;
  const updated = await prisma.log.update({
    where: { id: log.id },
    data,
  });
  res.json(updated);
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
