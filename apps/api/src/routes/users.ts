import { Router, type Request, type Response } from "express";
import { MEDIA_TYPES } from "@logeverything/shared";
import type { MediaType } from "@logeverything/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { LOG_STATUS_OPTIONS } from "@logeverything/shared";

/** Public (no auth) read-only profile and logs for sharing. */

export const usersRouter = Router();

function looksLikeCuid(id: string): boolean {
  return id.length >= 20 && id.length <= 30 && /^[a-z0-9]+$/i.test(id);
}

/** GET /users/:userId - Public profile (username, visibleMediaTypes, logCount). No email or secrets. */
usersRouter.get("/:userId", async (req: Request<{ userId: string }>, res: Response) => {
  const { userId } = req.params;
  if (!userId || !looksLikeCuid(userId)) {
    res.status(400).json({ error: "Invalid user" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, visibleMediaTypes: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const logCount = await prisma.log.count({ where: { userId: user.id } });
  let visibleMediaTypes: string[] = [...MEDIA_TYPES];
  if (user.visibleMediaTypes) {
    try {
      const parsed = JSON.parse(user.visibleMediaTypes) as string[];
      const valid = parsed.filter((t): t is (typeof MEDIA_TYPES)[number] =>
        MEDIA_TYPES.includes(t as (typeof MEDIA_TYPES)[number])
      );
      if (valid.length > 0) visibleMediaTypes = valid;
    } catch {
      // keep default
    }
  }
  res.json({
    id: user.id,
    username: user.username ?? null,
    visibleMediaTypes,
    logCount,
  });
});

/** GET /users/:userId/logs/stats?group=category|month|year - Public stats. No auth. */
usersRouter.get("/:userId/logs/stats", async (req: Request<{ userId: string }>, res: Response) => {
  const { userId } = req.params;
  if (!userId || !looksLikeCuid(userId)) {
    res.status(400).json({ error: "Invalid user" });
    return;
  }
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }
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
  const FALLBACK_MAX_HOURS = 24;
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

/** GET /users/:userId/logs - Public list of logs (same shape as GET /logs). No auth. */
usersRouter.get("/:userId/logs", async (req: Request<{ userId: string }>, res: Response) => {
  const { userId } = req.params;
  if (!userId || !looksLikeCuid(userId)) {
    res.status(400).json({ error: "Invalid user" });
    return;
  }
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const mediaType = req.query.mediaType as MediaType | undefined;
  const status = req.query.status as string | undefined;
  const sort = (req.query.sort as string) === "grade" ? "grade" : "date";

  const where = { userId } as { userId: string; mediaType?: string; status?: string };
  if (mediaType && MEDIA_TYPES.includes(mediaType)) where.mediaType = mediaType;
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
