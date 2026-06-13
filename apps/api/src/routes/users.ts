import { Router, type Request, type Response } from "express";
import { LOG_STATUS_OPTIONS, MEDIA_TYPES, SPEND_TRACKED_MEDIA_TYPES } from "@geeklogs/shared";
import type { MediaType } from "@geeklogs/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { serializeLog } from "../lib/serializeLog.js";
import { attachItemEnrichment } from "../lib/itemDetailEnrichment.js";
import { getMilestoneProgress } from "../services/milestone.service.js";
import {
  localDayBoundsFromDateString,
  logSpendStatsDateWhere,
  purchaseLogCreatedAtRange,
  type PurchasePeriod,
} from "../lib/purchaseFields.js";
import { sanitizeText, SEARCH_QUERY_MAX_LENGTH } from "../lib/sanitize.js";
import { computeGenreFacets, fetchLogsWithGenreFilter, LOG_GENRE_FILTER_MAX_LENGTH } from "../lib/logGenreList.js";
import {
  applyProfileVisibilityToPublicLog,
  getProfileVisibilityFromUser,
} from "../lib/profileVisibility.js";
import { attachBoardGameSessionHours } from "../lib/boardGameSessionHours.js";
import { hoursFromCompletedLogForStats } from "../lib/completedLogHours.js";

/** Public (no auth) read-only profile and logs for sharing. */

export const usersRouter = Router();

function looksLikeCuid(id: string): boolean {
  return id.length >= 20 && id.length <= 30 && /^[a-z0-9]+$/i.test(id);
}

/** Resolve identifier (username or id) to user. Returns null if not found. */
async function getUserByIdentifier(identifier: string) {
  if (!identifier || identifier.length > 100) return null;
  if (looksLikeCuid(identifier)) {
    return prisma.user.findUnique({
      where: { id: identifier },
      select: {
        id: true,
        username: true,
        visibleMediaTypes: true,
        selectedBadgeIds: true,
        profileVisibility: true,
      },
    });
  }
  return prisma.user.findUnique({
    where: { username: identifier },
    select: {
      id: true,
      username: true,
      visibleMediaTypes: true,
      selectedBadgeIds: true,
      profileVisibility: true,
    },
  });
}

function parseVisibleMediaTypes(user: { visibleMediaTypes: string | null }): MediaType[] {
  let visibleMediaTypes: MediaType[] = [...MEDIA_TYPES];
  if (user.visibleMediaTypes) {
    try {
      const parsed = JSON.parse(user.visibleMediaTypes) as string[];
      const valid = parsed.filter((t): t is MediaType =>
        MEDIA_TYPES.includes(t as MediaType)
      );
      if (valid.length > 0) visibleMediaTypes = valid;
    } catch {
      // keep default
    }
  }
  return visibleMediaTypes;
}

function redactPublicLogs<T extends Record<string, unknown>>(
  logs: T[],
  visibility: ReturnType<typeof getProfileVisibilityFromUser>
): T[] {
  return logs.map((log) => applyProfileVisibilityToPublicLog(log, visibility) as T);
}

/** GET /users/:identifier - Public profile by username or id. No email or secrets. */
usersRouter.get("/:identifier", async (req: Request<{ identifier: string }>, res: Response) => {
  const { identifier } = req.params;
  const user = await getUserByIdentifier(identifier);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const visibility = getProfileVisibilityFromUser(user);
  if (!visibility.showPublicProfile) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const visibleMediaTypes = parseVisibleMediaTypes(user);
  const [logCount, selectedBadges] = await Promise.all([
    prisma.log.count({ where: { userId: user.id } }),
    (async () => {
      let badgeIds: string[] = [];
      if (user.selectedBadgeIds) {
        try {
          const parsed = JSON.parse(user.selectedBadgeIds) as unknown;
          badgeIds = Array.isArray(parsed) ? parsed.slice(0, 3) : [];
        } catch {
          // ignore
        }
      }
      if (badgeIds.length === 0 || !visibility.showPinnedBadges) return [];
      const badges = await prisma.badge.findMany({
        where: { id: { in: badgeIds } },
        select: { id: true, name: true, icon: true, medium: true },
      });
      const order = new Map(badgeIds.map((id, i) => [id, i]));
      return badges.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    })(),
  ]);
  res.json({
    id: user.id,
    username: user.username ?? null,
    visibleMediaTypes,
    logCount: visibility.showLogCount ? logCount : 0,
    selectedBadges: selectedBadges.map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      medium: b.medium,
    })),
  });
});

/** GET /users/:identifier/milestones/progress - Public milestone progress (earned badges, next). No auth. Same shape as GET /me/milestones/progress. */
usersRouter.get("/:identifier/milestones/progress", async (req: Request<{ identifier: string }>, res: Response) => {
  const { identifier } = req.params;
  const user = await getUserByIdentifier(identifier);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const visibility = getProfileVisibilityFromUser(user);
  if (!visibility.showPublicProfile || !visibility.showMilestoneBadges) {
    res.json({ perMedium: [], global: { reviews: { current: 0, next: null, progressPct: 0, earned: [] }, logs: { current: 0, next: null, progressPct: 0, earned: [] } } });
    return;
  }
  const data = await getMilestoneProgress(user.id);
  res.json(data);
});

async function requirePublicUser(identifier: string) {
  const user = await getUserByIdentifier(identifier);
  if (!user) return null;
  const visibility = getProfileVisibilityFromUser(user);
  if (!visibility.showPublicProfile) return null;
  return { user, visibility, visibleMediaTypes: parseVisibleMediaTypes(user) };
}

/** GET /users/:identifier/logs/stats?group=category|month|year - Public stats. No auth. */
usersRouter.get("/:identifier/logs/stats", async (req: Request<{ identifier: string }>, res: Response) => {
  const { identifier } = req.params;
  const ctx = await requirePublicUser(identifier);
  if (!ctx) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { user } = ctx;
  const groupParam = req.query.group as string;
  const group = groupParam === "year" ? "year" : groupParam === "category" ? "category" : "month";
  const logs = await prisma.log.findMany({
    where: {
      userId: user.id,
      completedAt: { not: null },
    },
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
  const byKey: Record<string, number> = {};
  for (const log of logsWithSessionHours) {
    if (log.completedAt == null) continue;
    const hours = hoursFromCompletedLogForStats(log);
    if (hours === null) continue;
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
  const ctx = await requirePublicUser(identifier);
  if (!ctx) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { user, visibleMediaTypes } = ctx;
  const counts = await prisma.log.groupBy({
    by: ["mediaType"],
    where: { userId: user.id },
    _count: { id: true },
  });
  const data = Object.fromEntries(
    visibleMediaTypes.map((t) => [t, counts.find((c) => c.mediaType === t)?._count.id ?? 0])
  ) as Record<MediaType, number>;
  res.json({ data });
});

/** GET /users/:identifier/logs/status-counts?mediaType=X - Public per-status counts for one category. Returns { data: { total, byStatus } }. */
usersRouter.get("/:identifier/logs/status-counts", async (req: Request<{ identifier: string }>, res: Response) => {
  const { identifier } = req.params;
  const ctx = await requirePublicUser(identifier);
  if (!ctx) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { user, visibility, visibleMediaTypes } = ctx;
  const mediaType = req.query.mediaType as MediaType | undefined;
  if (!mediaType || !MEDIA_TYPES.includes(mediaType)) {
    res.status(400).json({ error: "mediaType required and must be a valid media type" });
    return;
  }
  if (!visibleMediaTypes.includes(mediaType)) {
    res.json({ data: { total: 0, byStatus: {}, byGenre: {} } });
    return;
  }
  const [rows, genreRows] = await Promise.all([
    prisma.log.groupBy({
      by: ["status"],
      where: { userId: user.id, mediaType },
      _count: { id: true },
    }),
    prisma.log.findMany({
      where: {
        userId: user.id,
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
  if (
    visibility.showCollectionTags &&
    (SPEND_TRACKED_MEDIA_TYPES as readonly string[]).includes(mediaType)
  ) {
    const [owned, wantToBuy] = await Promise.all([
      prisma.log.count({ where: { userId: user.id, mediaType, own: true } }),
      prisma.log.count({ where: { userId: user.id, mediaType, wantToBuy: true } }),
    ]);
    res.json({ data: { total, byStatus, owned, wantToBuy, byGenre } });
    return;
  }
  res.json({ data: { total, byStatus, byGenre } });
});

/** GET /users/:identifier/logs - Public list of logs (same shape as GET /logs). Supports ?limit=&cursor= for pagination. No auth. */
usersRouter.get("/:identifier/logs", async (req: Request<{ identifier: string }>, res: Response) => {
  const { identifier } = req.params;
  const ctx = await requirePublicUser(identifier);
  if (!ctx) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { user, visibility, visibleMediaTypes } = ctx;
  const mediaType = req.query.mediaType as MediaType | undefined;
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

  let where: Prisma.LogWhereInput = {
    userId: user.id,
    mediaType: { in: [...visibleMediaTypes] },
  };
  if (mediaType && MEDIA_TYPES.includes(mediaType)) {
    if (!visibleMediaTypes.includes(mediaType)) {
      if (usePagination && takeSize != null) {
        res.json({ data: [], nextCursor: null });
        return;
      }
      res.json([]);
      return;
    }
    where = { userId: user.id, mediaType };
  }
  if (status != null && status !== "") {
    if (mediaType && MEDIA_TYPES.includes(mediaType)) {
      const allowed = LOG_STATUS_OPTIONS[mediaType];
      if (allowed.includes(status)) where.status = status;
    } else {
      where.status = status;
    }
  }
  if (
    mediaType &&
    (SPEND_TRACKED_MEDIA_TYPES as readonly string[]).includes(mediaType)
  ) {
    if (ownFilter) where.own = true;
    if (wantToBuyFilter) where.wantToBuy = true;
  }
  if (purchasedFilter) {
    where.OR = [
      { AND: [{ purchaseAmountMinor: { not: null } }, { purchaseCurrency: { not: null } }] },
      { AND: [{ saleAmountMinor: { not: null } }, { saleCurrency: { not: null } }] },
    ];
    const dateRaw = typeof req.query.purchaseDate === "string" ? req.query.purchaseDate.trim() : "";
    if (dateRaw !== "") {
      const tzRaw = req.query.timezoneOffsetMinutes;
      const tzOffsetMinutes =
        typeof tzRaw === "string" && tzRaw !== "" && Number.isFinite(parseInt(tzRaw, 10))
          ? parseInt(tzRaw, 10)
          : 0;
      const bounds = localDayBoundsFromDateString(dateRaw, tzOffsetMinutes);
      if (bounds) where = { AND: [where, logSpendStatsDateWhere(bounds)] };
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
        if (range) where = { AND: [where, logSpendStatsDateWhere(range)] };
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
      if (!Array.isArray(result)) {
        const enriched = redactPublicLogs(
          await attachItemEnrichment(prisma, result.data),
          visibility
        );
        res.json({ data: enriched, nextCursor: result.nextCursor });
        return;
      }
    }
    const data = await fetchLogsWithGenreFilter(prisma, {
      where,
      sort,
      genre: genreFilter,
      takeSize: PAGINATION_LIMIT_MAX,
      cursorId: undefined,
      usePagination: false,
    });
    const list = Array.isArray(data) ? data : data.data;
    const enriched = redactPublicLogs(await attachItemEnrichment(prisma, list), visibility);
    res.json(enriched);
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
    const enriched = redactPublicLogs(await attachItemEnrichment(prisma, data), visibility);
    res.json({ data: enriched, nextCursor });
    return;
  }

  const logs = await prisma.log.findMany({
    where,
    orderBy,
  });
  const enriched = redactPublicLogs(
    await attachItemEnrichment(prisma, logs.map(serializeLog)),
    visibility
  );
  res.json(enriched);
});
