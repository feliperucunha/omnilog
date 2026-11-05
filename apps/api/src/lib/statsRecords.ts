import {
  MEDIA_TYPES,
  decodeHtmlEntities,
  type MediaType,
} from "@geeklogs/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { effectiveCompletedAt } from "./logActivityDates.js";
import { hoursFromCompletedLogForStats } from "./completedLogHours.js";
import { completedAtBoundsForStatsPeriod } from "./statisticsScope.js";
import { parseGenresJson } from "./serializeLog.js";
import {
  boardGameMatchSessionKey,
  buildBoardGameMatchStatsWhere,
  matchCountsAsWinForUser,
  parseBoardGamePlayersJson,
  userTaggedInMatch,
} from "./statsCategoryMetrics.js";

export type StatsRecordScope = MediaType | "all";

export type StatsRecordUnit =
  | "rating"
  | "hours"
  | "pages"
  | "episodes"
  | "seasons"
  | "chapters"
  | "volumes"
  | "matches"
  | "wins"
  | "winRate"
  | "items"
  | "days"
  | "weight";

export type StatsRecordEntry = {
  key: string;
  rank: number;
  title: string;
  mediaType: StatsRecordScope;
  value: number;
  unit: StatsRecordUnit;
  externalId?: string;
  logId?: string;
  image?: string | null;
  boardGameSource?: string | null;
  date?: string;
  from?: string;
  to?: string;
  secondaryValue?: number;
  secondaryUnit?: StatsRecordUnit;
};

export type StatsRecord = {
  id: string;
  entries: StatsRecordEntry[];
};

const LOG_SELECT = {
  id: true,
  mediaType: true,
  externalId: true,
  title: true,
  image: true,
  status: true,
  grade: true,
  completedAt: true,
  startedAt: true,
  updatedAt: true,
  createdAt: true,
  contentHours: true,
  hoursToBeat: true,
  gamePlatform: true,
  season: true,
  episode: true,
  chapter: true,
  volume: true,
  pagesRead: true,
  matchesPlayed: true,
  averageWeight: true,
  genres: true,
  boardGameSource: true,
} satisfies Prisma.LogSelect;

const MATCH_SELECT = {
  playedAt: true,
  createdAt: true,
  durationHours: true,
  players: true,
  log: {
    select: {
      id: true,
      userId: true,
      externalId: true,
      title: true,
      image: true,
      boardGameSource: true,
    },
  },
} satisfies Prisma.BoardGameMatchSelect;

type RecordLog = Prisma.LogGetPayload<{ select: typeof LOG_SELECT }>;
type RecordMatch = Prisma.BoardGameMatchGetPayload<{ select: typeof MATCH_SELECT }>;
type PeriodRange = { gte: Date; lte: Date };

type Candidate = Omit<StatsRecordEntry, "rank" | "unit">;

type RecordContext = {
  scope: StatsRecordScope;
  periodRange: PeriodRange | null;
  logs: RecordLog[];
  matches: RecordMatch[];
  bookPages: Map<string, number>;
  boardGames: BoardGameAggregate[];
  limit: number;
  tzOffsetMinutes: number;
};

type BoardGameAggregate = {
  externalId: string;
  logId: string;
  title: string;
  image: string | null;
  boardGameSource: string | null;
  manualMatches: number | null;
  sessionCount: number;
  matchCount: number;
  wins: number;
  longestSessionHours: number;
  longestSessionAt: Date | null;
};

function recordActivityAt(log: RecordLog): Date {
  return (
    effectiveCompletedAt({
      status: log.status,
      completedAt: log.completedAt,
      updatedAt: log.updatedAt,
    }) ?? log.createdAt
  );
}

function inPeriod(at: Date | null, range: PeriodRange | null): boolean {
  if (at == null) return false;
  if (range == null) return true;
  return at.getTime() >= range.gte.getTime() && at.getTime() <= range.lte.getTime();
}

function logInPeriod(log: RecordLog, range: PeriodRange | null): boolean {
  return inPeriod(recordActivityAt(log), range);
}

function logCandidate(log: RecordLog, value: number, key = log.id): Candidate {
  return {
    key,
    title: decodeHtmlEntities(log.title),
    mediaType: log.mediaType as MediaType,
    value,
    externalId: log.externalId,
    logId: log.id,
    image: log.image,
    boardGameSource: log.boardGameSource,
  };
}

function makeRecord(
  id: string,
  unit: StatsRecordUnit,
  candidates: Candidate[],
  limit: number,
  options: { sortDirection?: "asc" | "desc"; includeZero?: boolean } = {}
): StatsRecord | null {
  const seen = new Set<string>();
  const sortDirection = options.sortDirection ?? "desc";
  const entries = candidates
    .filter(
      (candidate) =>
        Number.isFinite(candidate.value) &&
        (options.includeZero ? candidate.value >= 0 : candidate.value > 0)
    )
    .filter((candidate) => {
      if (seen.has(candidate.key)) return false;
      seen.add(candidate.key);
      return true;
    })
    .sort((a, b) => {
      const valueOrder = a.value === b.value ? 0 : a.value < b.value ? -1 : 1;
      return (
        (sortDirection === "asc" ? valueOrder : -valueOrder) ||
        a.title.localeCompare(b.title) ||
        a.key.localeCompare(b.key)
      );
    })
    .slice(0, Math.max(1, Math.min(limit, 10)))
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      unit,
    }));
  return entries.length > 0 ? { id, entries } : null;
}

function mediaLogs(ctx: RecordContext, mediaType: MediaType): RecordLog[] {
  return ctx.logs.filter(
    (log) => log.mediaType === mediaType && logInPeriod(log, ctx.periodRange)
  );
}

function topRatedRecord(
  id: string,
  ctx: RecordContext,
  mediaType: MediaType
): StatsRecord | null {
  const candidates = mediaLogs(ctx, mediaType)
    .filter((log) => (log.grade ?? 0) > 0)
    .map((log) => logCandidate(log, log.grade ?? 0));
  return makeRecord(id, "rating", candidates, ctx.limit);
}

function fieldRecord(
  id: string,
  ctx: RecordContext,
  mediaType: MediaType,
  field: "season" | "episode" | "chapter" | "volume" | "pagesRead",
  unit: StatsRecordUnit
): StatsRecord | null {
  const candidates = mediaLogs(ctx, mediaType)
    .filter((log) => (log[field] ?? 0) > 0)
    .map((log) => logCandidate(log, log[field] ?? 0));
  return makeRecord(id, unit, candidates, ctx.limit);
}

function genreRecord(
  id: string,
  ctx: RecordContext,
  mediaType: MediaType
): StatsRecord | null {
  const counts = new Map<string, number>();
  for (const log of mediaLogs(ctx, mediaType)) {
    for (const genre of parseGenresJson(log.genres) ?? []) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  const candidates: Candidate[] = [...counts.entries()].map(([genre, count]) => ({
    key: `genre:${genre}`,
    title: genre,
    mediaType,
    value: count,
  }));
  return makeRecord(id, "items", candidates, ctx.limit);
}

function hoursRecord(
  id: string,
  ctx: RecordContext,
  mediaType: MediaType
): StatsRecord | null {
  const candidates: Candidate[] = [];
  for (const log of mediaLogs(ctx, mediaType)) {
    const hours = hoursFromCompletedLogForStats(log);
    if (hours != null && hours > 0) candidates.push(logCandidate(log, hours));
  }
  return makeRecord(id, "hours", candidates, ctx.limit);
}

const DAY_MS = 86_400_000;

function completionDays(log: RecordLog): number | null {
  if (log.startedAt == null) return null;
  const finishedAt = effectiveCompletedAt({
    status: log.status,
    completedAt: log.completedAt,
    updatedAt: log.updatedAt,
  });
  if (finishedAt == null) return null;
  const elapsed = finishedAt.getTime() - log.startedAt.getTime();
  if (elapsed < 0) return null;
  return Math.round((elapsed / DAY_MS) * 10) / 10;
}

function completionTimeRecord(
  id: string,
  ctx: RecordContext,
  mediaType: MediaType | null,
  sortDirection: "asc" | "desc"
): StatsRecord | null {
  const logs =
    mediaType == null
      ? ctx.logs.filter((log) => logInPeriod(log, ctx.periodRange))
      : mediaLogs(ctx, mediaType);
  const candidates: Candidate[] = [];
  for (const log of logs) {
    const days = completionDays(log);
    if (days == null) continue;
    candidates.push(logCandidate(log, days, `completion:${log.id}`));
  }
  return makeRecord(id, "days", candidates, ctx.limit, {
    sortDirection,
    includeZero: true,
  });
}

function completionRecords(
  ctx: RecordContext,
  mediaType: MediaType | null
): StatsRecord[] {
  return [
    completionTimeRecord("fastest_completion", ctx, mediaType, "asc"),
    completionTimeRecord("slowest_completion", ctx, mediaType, "desc"),
  ].filter((record): record is StatsRecord => record != null);
}

function buildBoardGameAggregates(
  userId: string,
  ctx: Omit<RecordContext, "boardGames">
): BoardGameAggregate[] {
  const byExternalId = new Map<string, BoardGameAggregate>();
  const allBoardGameLogs = ctx.logs.filter((log) => log.mediaType === "boardgames");

  for (const log of allBoardGameLogs) {
    if (!logInPeriod(log, ctx.periodRange)) continue;
    byExternalId.set(log.externalId, {
      externalId: log.externalId,
      logId: log.id,
      title: decodeHtmlEntities(log.title),
      image: log.image,
      boardGameSource: log.boardGameSource,
      manualMatches: log.matchesPlayed,
      sessionCount: 0,
      matchCount: log.matchesPlayed ?? 0,
      wins: 0,
      longestSessionHours: 0,
      longestSessionAt: null,
    });
  }

  const sessionRows = new Map<string, RecordMatch>();
  for (const row of ctx.matches) {
    const players = parseBoardGamePlayersJson(row.players);
    const isOwnLog = row.log.userId === userId;
    if (!isOwnLog && !userTaggedInMatch(players, userId)) continue;
    const sessionKey = boardGameMatchSessionKey(row);
    const existing = sessionRows.get(sessionKey);
    if (!existing) {
      sessionRows.set(sessionKey, row);
      continue;
    }
    if (isOwnLog && existing.log.userId !== userId) sessionRows.set(sessionKey, row);
  }

  for (const row of sessionRows.values()) {
    const players = parseBoardGamePlayersJson(row.players);
    let aggregate = byExternalId.get(row.log.externalId);
    if (!aggregate) {
      const ownLog = allBoardGameLogs.find(
        (log) => log.externalId === row.log.externalId
      );
      aggregate = {
        externalId: row.log.externalId,
        logId: row.log.id,
        title: decodeHtmlEntities(ownLog?.title ?? row.log.title),
        image: ownLog?.image ?? row.log.image,
        boardGameSource: ownLog?.boardGameSource ?? row.log.boardGameSource,
        manualMatches: null,
        sessionCount: 0,
        matchCount: 0,
        wins: 0,
        longestSessionHours: 0,
        longestSessionAt: null,
      };
      byExternalId.set(row.log.externalId, aggregate);
    }
    aggregate.sessionCount += 1;
    if (matchCountsAsWinForUser(players, userId)) aggregate.wins += 1;
    if (row.durationHours > aggregate.longestSessionHours) {
      aggregate.longestSessionHours = row.durationHours;
      aggregate.longestSessionAt = row.playedAt;
    }
  }

  for (const aggregate of byExternalId.values()) {
    aggregate.matchCount = aggregate.manualMatches ?? aggregate.sessionCount;
  }

  return [...byExternalId.values()];
}

function boardGameCandidate(aggregate: BoardGameAggregate, value: number): Candidate {
  return {
    key: `boardgame:${aggregate.externalId}`,
    title: aggregate.title,
    mediaType: "boardgames",
    value,
    externalId: aggregate.externalId,
    logId: aggregate.logId,
    image: aggregate.image,
    boardGameSource: aggregate.boardGameSource,
  };
}

function boardGameRecords(ctx: RecordContext): StatsRecord[] {
  return [
    topRatedRecord("highest_rated", ctx, "boardgames"),
    makeRecord(
      "most_boardgame_matches",
      "matches",
      ctx.boardGames.map((aggregate) =>
        boardGameCandidate(aggregate, aggregate.matchCount)
      ),
      ctx.limit
    ),
    makeRecord(
      "most_boardgame_wins",
      "wins",
      ctx.boardGames.map((aggregate) => {
        const candidate = boardGameCandidate(aggregate, aggregate.wins);
        if (aggregate.sessionCount <= 0) return candidate;
        return {
          ...candidate,
          secondaryValue: (aggregate.wins / aggregate.sessionCount) * 100,
          secondaryUnit: "winRate" as const,
        };
      }),
      ctx.limit
    ),
    makeRecord(
      "longest_boardgame_session",
      "hours",
      ctx.boardGames
        .filter(
          (aggregate) =>
            aggregate.longestSessionHours > 0 && aggregate.longestSessionAt != null
        )
        .map((aggregate) => ({
          ...boardGameCandidate(aggregate, aggregate.longestSessionHours),
          date: aggregate.longestSessionAt!.toISOString(),
        })),
      ctx.limit
    ),
    makeRecord(
      "highest_boardgame_weight",
      "weight",
      mediaLogs(ctx, "boardgames")
        .filter((log) => (log.averageWeight ?? 0) > 0)
        .map((log) => logCandidate(log, log.averageWeight ?? 0)),
      ctx.limit
    ),
  ].filter((record): record is StatsRecord => record != null);
}

function categoryRecords(ctx: RecordContext, mediaType: MediaType): StatsRecord[] {
  switch (mediaType) {
    case "movies":
      return (
        [
          topRatedRecord("highest_rated", ctx, "movies"),
          hoursRecord("longest_movie", ctx, "movies"),
          genreRecord("top_movie_genre", ctx, "movies"),
        ] as Array<StatsRecord | null>
      ).filter((record): record is StatsRecord => record != null);
    case "tv":
      return (
        [
          topRatedRecord("highest_rated", ctx, "tv"),
          fieldRecord("most_tv_episodes", ctx, "tv", "episode", "episodes"),
          fieldRecord("most_tv_seasons", ctx, "tv", "season", "seasons"),
          hoursRecord("longest_tv", ctx, "tv"),
        ] as Array<StatsRecord | null>
      ).filter((record): record is StatsRecord => record != null);
    case "anime":
      return (
        [
          topRatedRecord("highest_rated", ctx, "anime"),
          fieldRecord("most_anime_episodes", ctx, "anime", "episode", "episodes"),
          fieldRecord("most_anime_seasons", ctx, "anime", "season", "seasons"),
          hoursRecord("longest_anime", ctx, "anime"),
        ] as Array<StatsRecord | null>
      ).filter((record): record is StatsRecord => record != null);
    case "manga":
      return (
        [
          topRatedRecord("highest_rated", ctx, "manga"),
          fieldRecord("most_manga_chapters", ctx, "manga", "chapter", "chapters"),
          fieldRecord("most_manga_volumes", ctx, "manga", "volume", "volumes"),
          fieldRecord("most_manga_pages", ctx, "manga", "pagesRead", "pages"),
        ] as Array<StatsRecord | null>
      ).filter((record): record is StatsRecord => record != null);
    case "comics":
      return (
        [
          topRatedRecord("highest_rated", ctx, "comics"),
          fieldRecord("most_comics_chapters", ctx, "comics", "chapter", "chapters"),
          fieldRecord("most_comics_volumes", ctx, "comics", "volume", "volumes"),
          fieldRecord("most_comics_pages", ctx, "comics", "pagesRead", "pages"),
        ] as Array<StatsRecord | null>
      ).filter((record): record is StatsRecord => record != null);
    case "books":
      return (
        [
          topRatedRecord("highest_rated", ctx, "books"),
          fieldRecord("most_book_pages", ctx, "books", "pagesRead", "pages"),
          makeRecord(
            "longest_book",
            "pages",
            mediaLogs(ctx, "books")
              .map((log) => {
                const pages = ctx.bookPages.get(log.externalId) ?? log.pagesRead ?? 0;
                return pages > 0 ? logCandidate(log, pages) : null;
              })
              .filter((candidate): candidate is Candidate => candidate != null),
            ctx.limit
          ),
          genreRecord("top_book_genre", ctx, "books"),
        ] as Array<StatsRecord | null>
      ).filter((record): record is StatsRecord => record != null);
    case "games":
      return (
        [
          topRatedRecord("highest_rated", ctx, "games"),
          hoursRecord("most_game_hours", ctx, "games"),
          makeRecord(
            "top_game_platform",
            "items",
            (() => {
              const counts = new Map<string, number>();
              for (const log of mediaLogs(ctx, "games")) {
                const platform = log.gamePlatform?.trim();
                if (!platform) continue;
                counts.set(platform, (counts.get(platform) ?? 0) + 1);
              }
              return [...counts.entries()].map(([platform, count]) => ({
                key: `platform:${platform}`,
                title: platform,
                mediaType: "games" as const,
                value: count,
              }));
            })(),
            ctx.limit
          ),
        ] as Array<StatsRecord | null>
      ).filter((record): record is StatsRecord => record != null);
    case "boardgames":
      return boardGameRecords(ctx);
  }
}

function mediaRecords(ctx: RecordContext, mediaType: MediaType): StatsRecord[] {
  return categoryRecords(ctx, mediaType).concat(completionRecords(ctx, mediaType));
}

function allRecords(ctx: RecordContext): StatsRecord[] {
  const records: StatsRecord[] = [];
  for (const mediaType of MEDIA_TYPES) {
    const record = topRatedRecord(`top_rated_${mediaType}`, ctx, mediaType);
    if (record) records.push(record);
  }
  return records.concat(completionRecords(ctx, null));
}

export async function getStatsRecordsForUser(opts: {
  userId: string;
  scope: StatsRecordScope;
  periodYear?: number | null;
  tzOffsetMinutes?: number;
  limit?: number;
}): Promise<StatsRecord[]> {
  const scope = opts.scope;
  const tzOffsetMinutes = opts.tzOffsetMinutes ?? 0;
  const periodRange =
    opts.periodYear == null
      ? null
      : completedAtBoundsForStatsPeriod(
          String(opts.periodYear),
          "year",
          tzOffsetMinutes
        );

  const logWhere: Prisma.LogWhereInput = {
    userId: opts.userId,
    ...(scope === "all" ? {} : { mediaType: scope }),
  };
  const needsMatches = scope === "all" || scope === "boardgames";

  const [logs, matches] = await Promise.all([
    prisma.log.findMany({
      where: logWhere,
      select: LOG_SELECT,
      orderBy: { createdAt: "asc" },
    }),
    needsMatches
      ? prisma.boardGameMatch.findMany({
          where: buildBoardGameMatchStatsWhere(opts.userId, {
            playedAtWhere: periodRange
              ? { playedAt: { gte: periodRange.gte, lte: periodRange.lte } }
              : undefined,
          }),
          select: MATCH_SELECT,
        })
      : Promise.resolve([] as RecordMatch[]),
  ]);

  const bookPages = new Map<string, number>();
  if (scope === "all" || scope === "books") {
    const externalIds = [
      ...new Set(
        logs.filter((log) => log.mediaType === "books").map((log) => log.externalId)
      ),
    ];
    if (externalIds.length > 0) {
      const rows = await prisma.itemDetailCache.findMany({
        where: { mediaType: "books", externalId: { in: externalIds } },
        select: { externalId: true, pagesCount: true },
      });
      for (const row of rows) {
        if (row.pagesCount != null && row.pagesCount > 0) {
          bookPages.set(row.externalId, row.pagesCount);
        }
      }
    }
  }

  const baseContext = {
    scope,
    periodRange,
    logs,
    matches,
    bookPages,
    limit: opts.limit ?? 10,
    tzOffsetMinutes,
  };
  const context: RecordContext = {
    ...baseContext,
    boardGames: buildBoardGameAggregates(opts.userId, baseContext),
  };

  return scope === "all" ? allRecords(context) : mediaRecords(context, scope);
}
