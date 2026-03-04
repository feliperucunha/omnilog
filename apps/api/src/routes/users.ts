import { Router, type Request, type Response } from "express";
import { MEDIA_TYPES } from "@logeverything/shared";
import type { MediaType } from "@logeverything/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { LOG_STATUS_OPTIONS } from "@logeverything/shared";
import { serializeLog } from "../lib/serializeLog.js";

/** Public (no auth) read-only profile and logs for sharing. */

export const usersRouter = Router();

function looksLikeCuid(id: string): boolean {
  return id.length >= 20 && id.length <= 30 && /^[a-z0-9]+$/i.test(id);
}

/** Resolve identifier (username or id) to user. Returns null if not found. */
async function getUserByIdentifier(identifier: string) {
  if (!identifier || identifier.length > 100) return null;
  if (looksLikeCuid(identifier)) {
    return prisma.user.findUnique({ where: { id: identifier }, select: { id: true, username: true, visibleMediaTypes: true } });
  }
  return prisma.user.findUnique({ where: { username: identifier }, select: { id: true, username: true, visibleMediaTypes: true } });
}

/** GET /users/:identifier - Public profile by username or id. No email or secrets. */
usersRouter.get("/:identifier", async (req: Request<{ identifier: string }>, res: Response) => {
  const { identifier } = req.params;
  const user = await getUserByIdentifier(identifier);
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

/** GET /users/:identifier/logs/stats?group=category|month|year - Public stats. No auth. */
usersRouter.get("/:identifier/logs/stats", async (req: Request<{ identifier: string }>, res: Response) => {
  const { identifier } = req.params;
  const user = await getUserByIdentifier(identifier);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const groupParam = req.query.group as string;
  const group = groupParam === "year" ? "year" : groupParam === "category" ? "category" : "month";
  const logs = await prisma.log.findMany({
    where: {
      userId: user.id,
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

const PAGINATION_LIMIT_MAX = 100;

/** GET /users/:identifier/logs/counts - Public per-category counts. Returns { data: { [mediaType]: number } }. */
usersRouter.get("/:identifier/logs/counts", async (req: Request<{ identifier: string }>, res: Response) => {
  const { identifier } = req.params;
  const user = await getUserByIdentifier(identifier);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const counts = await prisma.log.groupBy({
    by: ["mediaType"],
    where: { userId: user.id },
    _count: { id: true },
  });
  const data = Object.fromEntries(
    MEDIA_TYPES.map((t) => [t, counts.find((c) => c.mediaType === t)?._count.id ?? 0])
  ) as Record<MediaType, number>;
  res.json({ data });
});

/** GET /users/:identifier/logs/status-counts?mediaType=X - Public per-status counts for one category. Returns { data: { total, byStatus } }. */
usersRouter.get("/:identifier/logs/status-counts", async (req: Request<{ identifier: string }>, res: Response) => {
  const { identifier } = req.params;
  const user = await getUserByIdentifier(identifier);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const mediaType = req.query.mediaType as MediaType | undefined;
  if (!mediaType || !MEDIA_TYPES.includes(mediaType)) {
    res.status(400).json({ error: "mediaType required and must be a valid media type" });
    return;
  }
  const rows = await prisma.log.groupBy({
    by: ["status"],
    where: { userId: user.id, mediaType },
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

/** GET /users/:identifier/logs - Public list of logs (same shape as GET /logs). Supports ?limit=&cursor= for pagination. No auth. */
usersRouter.get("/:identifier/logs", async (req: Request<{ identifier: string }>, res: Response) => {
  const { identifier } = req.params;
  const user = await getUserByIdentifier(identifier);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const mediaType = req.query.mediaType as MediaType | undefined;
  const status = req.query.status as string | undefined;
  const sort = (req.query.sort as string) === "grade" ? "grade" : "date";
  const limitParam = req.query.limit != null ? parseInt(String(req.query.limit), 10) : NaN;
  const usePagination = Number.isInteger(limitParam) && limitParam >= 1 && limitParam <= PAGINATION_LIMIT_MAX;
  const takeSize = usePagination ? Math.min(limitParam, PAGINATION_LIMIT_MAX) : undefined;
  const cursorId = typeof req.query.cursor === "string" && req.query.cursor.length > 0 ? req.query.cursor : undefined;

  const where = { userId: user.id } as { userId: string; mediaType?: string; status?: string };
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
