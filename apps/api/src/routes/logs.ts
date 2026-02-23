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
import { prisma } from "../lib/prisma.js";
import { sanitizeReview } from "../lib/sanitize.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js";

export const logsRouter = Router();
logsRouter.use(authMiddleware);

const optionalInt = z.number().int().min(0).nullable().optional();

const optionalFloat = z.number().min(0).nullable().optional();

const createLogSchema = z.object({
  mediaType: z.enum(MEDIA_TYPES as unknown as [string, ...string[]]),
  externalId: z.string().min(1),
  title: z.string().min(1),
  image: z.string().url().max(2048).nullable().optional(),
  grade: z.number().min(0).max(10).optional(),
  review: z.string().optional(),
  listType: z.enum(LIST_TYPES as unknown as [string, ...string[]]).nullable().optional(),
  status: z.string().nullable().optional(),
  season: optionalInt,
  episode: optionalInt,
  chapter: optionalInt,
  volume: optionalInt,
  contentHours: optionalFloat,
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

logsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const mediaType = req.query.mediaType as MediaType | undefined;
  const externalId = req.query.externalId as string | undefined;
  const status = req.query.status as string | undefined;
  const sort = (req.query.sort as string) === "grade" ? "grade" : "date";

  const where = { userId } as { userId: string; mediaType?: string; externalId?: string; status?: string };
  if (mediaType && MEDIA_TYPES.includes(mediaType)) where.mediaType = mediaType;
  if (externalId) where.externalId = externalId;
  if (status != null && status !== "") {
    if (mediaType && MEDIA_TYPES.includes(mediaType)) {
      const allowed = LOG_STATUS_OPTIONS[mediaType];
      if (allowed.includes(status)) where.status = status;
    } else {
      where.status = status;
    }
  }

  const orderBy =
    sort === "grade"
      ? ([{ grade: "desc" }, { updatedAt: "desc" }] as const)
      : { updatedAt: "desc" as const };

  const logs = await prisma.log.findMany({
    where,
    orderBy,
  });
  res.json(logs);
});

/** GET /logs/stats?group=month|year - hours of content completed per period */
logsRouter.get("/stats", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const group = (req.query.group as string) === "year" ? "year" : "month";
  const logs = await prisma.log.findMany({
    where: {
      userId,
      completedAt: { not: null },
      contentHours: { not: null },
    },
    select: { completedAt: true, contentHours: true },
  });
  const byPeriod: Record<string, number> = {};
  for (const log of logs) {
    if (log.completedAt == null || log.contentHours == null) continue;
    const d = log.completedAt;
    const key = group === "year" ? `${d.getUTCFullYear()}` : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    byPeriod[key] = (byPeriod[key] ?? 0) + log.contentHours;
  }
  const entries = Object.entries(byPeriod)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, hours]) => ({ period, hours: Math.round(hours * 10) / 10 }));
  res.json({ group, data: entries });
});

logsRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = createLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.user!.userId;
  const {
    mediaType,
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
  } = parsed.data;
  if (!validateStatus(mediaType, status)) {
    res.status(400).json({ error: { status: ["Invalid status for this media type"] } });
    return;
  }
  const sanitizedReview = sanitizeReview(review ?? null);
  const now = new Date();
  const createStartedAt = isInProgress(status) ? now : null;
  const createCompletedAt = isCompleted(status) ? now : null;
  try {
    const existing = await prisma.log.findUnique({
      where: { userId_mediaType_externalId: { userId, mediaType, externalId } },
    });
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
        title,
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
      if (image !== undefined) updateData.image = image ?? null;
      if (isInProgress(status) && existing.startedAt == null) updateData.startedAt = now;
      if (isCompleted(status)) updateData.completedAt = now;
      log = await prisma.log.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      log = await prisma.log.create({
        data: {
          userId,
          mediaType,
          externalId,
          title,
          image: image ?? null,
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
  if (parsed.data.image !== undefined) data.image = parsed.data.image;
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
