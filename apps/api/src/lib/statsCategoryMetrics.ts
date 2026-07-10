import type { BoardGameMatchPlayer, BoardGameProvider, MediaType } from "@geeklogs/shared";
import { boardGameScoreTrend } from "@geeklogs/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
const READING_MEDIA_TYPES = ["books", "manga", "comics"] as const;

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

function matchCountsAsWinForUser(players: BoardGameMatchPlayer[], userId: string): boolean {
  if (players.some((p) => p.winner && p.appUserId === userId)) return true;
  const winners = players.filter((p) => p.winner);
  if (winners.length === 1 && !players.some((p) => p.appUserId)) return true;
  return false;
}

function userScoreFromMatch(players: BoardGameMatchPlayer[], userId: string): number | null {
  const row = players.find((p) => p.appUserId === userId);
  const score = row?.score;
  if (score == null || typeof score !== "number" || !Number.isFinite(score)) return null;
  return score;
}

function taggedPlayerJsonContains(userId: string): string {
  return `"appUserId":"${userId}"`;
}

function userTaggedInMatch(players: BoardGameMatchPlayer[], userId: string): boolean {
  return players.some((p) => p.appUserId === userId);
}

export function buildBoardGameMatchStatsWhere(
  userId: string,
  opts: {
    playedAtWhere?: Prisma.BoardGameMatchWhereInput;
    logWhere?: Prisma.LogWhereInput;
    taggedPlayedAtWhere?: Prisma.BoardGameMatchWhereInput;
    includeTaggedMatches?: boolean;
  } = {}
): Prisma.BoardGameMatchWhereInput {
  const ownLogFilter: Prisma.LogWhereInput = {
    userId,
    mediaType: "boardgames",
    ...(opts.logWhere ?? {}),
  };

  const ownBranch: Prisma.BoardGameMatchWhereInput = {
    log: ownLogFilter,
    ...(opts.playedAtWhere ?? {}),
  };

  if (opts.includeTaggedMatches === false) {
    return ownBranch;
  }

  const taggedParts: Prisma.BoardGameMatchWhereInput[] = [
    { players: { contains: taggedPlayerJsonContains(userId) } },
    { log: { mediaType: "boardgames", NOT: { userId } } },
  ];
  const taggedPlayedAt = opts.taggedPlayedAtWhere ?? opts.playedAtWhere;
  if (taggedPlayedAt) taggedParts.push(taggedPlayedAt);

  const branches: Prisma.BoardGameMatchWhereInput[] = [
    ownBranch,
    { AND: taggedParts },
  ];

  return { OR: branches };
}

export type RecentBoardGameStatEntry = {
  logId: string;
  externalId: string;
  title: string;
  image: string | null;
  boardGameSource: BoardGameProvider | null;
  matchCount: number;
  wins: number;
  lastPlayedAt: string;
  lastScore: number | null;
  lastScoreTrend: "higher" | "lower" | null;
};

export type BoardGameMatchStatsSort = "recent" | "mostPlayed" | "leastPlayed";

export async function recentBoardGamesForStats(
  userId: string,
  playedAtWhere?: Prisma.BoardGameMatchWhereInput,
  sort: BoardGameMatchStatsSort = "recent",
  limit = 24,
  opts?: { includeTaggedMatches?: boolean }
): Promise<RecentBoardGameStatEntry[]> {
  const where = buildBoardGameMatchStatsWhere(userId, {
    playedAtWhere,
    includeTaggedMatches: opts?.includeTaggedMatches,
  });
  const rows = await prisma.boardGameMatch.findMany({
    where,
    select: {
      playedAt: true,
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
    },
    orderBy: { playedAt: "desc" },
  });

  type Acc = {
    log: (typeof rows)[number]["log"];
    matchCount: number;
    wins: number;
    lastPlayedAt: Date;
    lastScore: number | null;
    lastScoreTrend: "higher" | "lower" | null;
  };

  const sessionRows = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const players = parseBoardGamePlayersJson(row.players);
    const isOwnLog = row.log.userId === userId;
    if (!isOwnLog && !userTaggedInMatch(players, userId)) continue;
    const sessionKey = `${row.log.externalId}:${row.playedAt.getTime()}`;
    const existing = sessionRows.get(sessionKey);
    if (!existing) {
      sessionRows.set(sessionKey, row);
      continue;
    }
    if (isOwnLog && existing.log.userId !== userId) {
      sessionRows.set(sessionKey, row);
    }
  }

  const byExternalId = new Map<string, Acc>();

  for (const row of sessionRows.values()) {
    const externalId = row.log.externalId;
    const players = parseBoardGamePlayersJson(row.players);
    let acc = byExternalId.get(externalId);
    if (!acc) {
      acc = {
        log: row.log,
        matchCount: 0,
        wins: 0,
        lastPlayedAt: row.playedAt,
        lastScore: null,
        lastScoreTrend: null,
      };
      byExternalId.set(externalId, acc);
    }
    acc.matchCount += 1;
    if (matchCountsAsWinForUser(players, userId)) acc.wins += 1;
    if (row.playedAt.getTime() > acc.lastPlayedAt.getTime()) {
      acc.lastPlayedAt = row.playedAt;
    }
    if (row.log.userId === userId) {
      acc.log = row.log;
    }
  }

  for (const [externalId, acc] of byExternalId) {
    const scoredSessions = [...sessionRows.values()]
      .filter((row) => row.log.externalId === externalId)
      .map((row) => ({
        playedAt: row.playedAt,
        score: userScoreFromMatch(parseBoardGamePlayersJson(row.players), userId),
      }))
      .filter((row): row is { playedAt: Date; score: number } => row.score != null)
      .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
    acc.lastScore = scoredSessions[0]?.score ?? null;
    acc.lastScoreTrend = boardGameScoreTrend(scoredSessions[0]?.score, scoredSessions[1]?.score);
  }

  const sorted = [...byExternalId.values()].sort((a, b) => {
    if (sort === "mostPlayed") {
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return b.lastPlayedAt.getTime() - a.lastPlayedAt.getTime();
    }
    if (sort === "leastPlayed") {
      if (a.matchCount !== b.matchCount) return a.matchCount - b.matchCount;
      return b.lastPlayedAt.getTime() - a.lastPlayedAt.getTime();
    }
    return b.lastPlayedAt.getTime() - a.lastPlayedAt.getTime();
  });

  return sorted.slice(0, limit)
    .map((entry) => ({
      logId: entry.log.id,
      externalId: entry.log.externalId,
      title: entry.log.title,
      image: entry.log.image,
      boardGameSource: entry.log.boardGameSource as BoardGameProvider | null,
      matchCount: entry.matchCount,
      wins: entry.wins,
      lastPlayedAt: entry.lastPlayedAt.toISOString(),
      lastScore: entry.lastScore,
      lastScoreTrend: entry.lastScoreTrend,
    }));
}

export async function sumAllPagesReadForStats(
  userId: string,
  logWhere?: Prisma.LogWhereInput
): Promise<number> {
  let total = 0;
  for (const mediaType of READING_MEDIA_TYPES) {
    total += await sumPagesReadForStats(userId, mediaType, logWhere);
  }
  return total;
}

export async function sumPagesReadForStats(
  userId: string,
  mediaType: MediaType,
  logWhere?: Prisma.LogWhereInput
): Promise<number> {
  if (!(READING_MEDIA_TYPES as readonly string[]).includes(mediaType)) return 0;
  const base: Prisma.LogWhereInput = {
    userId,
    mediaType,
    pagesRead: { not: null },
  };
  const where = logWhere ? { AND: [base, logWhere] } : base;
  const agg = await prisma.log.aggregate({
    where,
    _sum: { pagesRead: true },
  });
  return agg._sum.pagesRead ?? 0;
}

export async function countBoardGameWinsForStats(
  userId: string,
  logWhere?: Prisma.LogWhereInput,
  opts?: {
    taggedPlayedAtWhere?: Prisma.BoardGameMatchWhereInput;
    includeTaggedMatches?: boolean;
  }
): Promise<number> {
  const where = buildBoardGameMatchStatsWhere(userId, {
    logWhere,
    taggedPlayedAtWhere: opts?.taggedPlayedAtWhere,
    includeTaggedMatches: opts?.includeTaggedMatches,
  });
  const matches = await prisma.boardGameMatch.findMany({
    where,
    select: { players: true, playedAt: true, log: { select: { userId: true, externalId: true } } },
  });
  const seenSessions = new Set<string>();
  let wins = 0;
  for (const row of matches) {
    const players = parseBoardGamePlayersJson(row.players);
    const isOwnLog = row.log.userId === userId;
    if (!isOwnLog && !userTaggedInMatch(players, userId)) continue;
    const sessionKey = `${row.log.externalId}:${row.playedAt.getTime()}`;
    if (seenSessions.has(sessionKey)) continue;
    seenSessions.add(sessionKey);
    if (matchCountsAsWinForUser(players, userId)) wins += 1;
  }
  return wins;
}

export async function gamePlatformStatsForUser(
  userId: string,
  logWhere?: Prisma.LogWhereInput
): Promise<Array<{ period: string; hours: number; count: number }>> {
  const base: Prisma.LogWhereInput = {
    userId,
    mediaType: "games",
    gamePlatform: { not: null },
  };
  const where = logWhere ? { AND: [base, logWhere] } : base;
  const logs = await prisma.log.findMany({
    where,
    select: { gamePlatform: true },
  });
  const byPlatform: Record<string, number> = {};
  for (const row of logs) {
    const platform = row.gamePlatform?.trim();
    if (!platform) continue;
    byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
  }
  return Object.entries(byPlatform)
    .sort(([, a], [, b]) => b - a || 0)
    .map(([period, count]) => ({ period, hours: count, count }));
}

export function isReadingMediaType(mt: MediaType | undefined): boolean {
  return mt != null && (READING_MEDIA_TYPES as readonly string[]).includes(mt);
}

export type StatsBarEntry = { period: string; hours: number; count: number };

export const BOARD_GAME_WEIGHT_SCOPES = [
  "all",
  "planToPlay",
  "played",
  "inCollection",
  "wantToBuy",
] as const;

export type BoardGameWeightScope = (typeof BOARD_GAME_WEIGHT_SCOPES)[number];

export function parseBoardGameWeightScope(raw: unknown): BoardGameWeightScope {
  if (typeof raw === "string" && (BOARD_GAME_WEIGHT_SCOPES as readonly string[]).includes(raw)) {
    return raw as BoardGameWeightScope;
  }
  return "all";
}

export function boardGameWeightScopeWhere(scope: BoardGameWeightScope): Prisma.LogWhereInput | undefined {
  switch (scope) {
    case "planToPlay":
      return { status: "plan to play" };
    case "played":
      return { status: "played" };
    case "inCollection":
      return { own: true };
    case "wantToBuy":
      return { wantToBuy: true };
    default:
      return undefined;
  }
}

const WEIGHT_BINS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export function binBoardGameWeight(weight: number): number | null {
  if (!Number.isFinite(weight) || weight <= 0) return null;
  const rounded = Math.round(weight * 2) / 2;
  const clamped = Math.min(5, Math.max(0.5, rounded));
  return clamped;
}

export function parseBoardGameWeightBin(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  return binBoardGameWeight(n);
}

export function formatWeightBinLabel(bin: number): string {
  return Number.isInteger(bin) ? String(bin) : bin.toFixed(1);
}

export function boardGameWeightHistogramEntries(
  weights: Array<number | null | undefined>
): StatsBarEntry[] {
  const counts = new Map<number, number>();
  for (const bin of WEIGHT_BINS) counts.set(bin, 0);
  let any = false;
  for (const w of weights) {
    if (w == null) continue;
    const bin = binBoardGameWeight(w);
    if (bin == null) continue;
    any = true;
    counts.set(bin, (counts.get(bin) ?? 0) + 1);
  }
  if (!any) return [];
  return WEIGHT_BINS.map((bin) => {
    const count = counts.get(bin) ?? 0;
    return { period: formatWeightBinLabel(bin), hours: count, count };
  });
}

function periodKeyFromDate(d: Date, granularity: "month" | "year"): string {
  return granularity === "year"
    ? `${d.getUTCFullYear()}`
    : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function sumMetricByPeriod(
  rows: Array<{ at: Date; value: number }>,
  granularity: "month" | "year"
): StatsBarEntry[] {
  const byPeriod: Record<string, { sum: number; count: number }> = {};
  for (const row of rows) {
    if (!Number.isFinite(row.value) || row.value <= 0) continue;
    const key = periodKeyFromDate(row.at, granularity);
    const cur = byPeriod[key] ?? { sum: 0, count: 0 };
    cur.sum += row.value;
    cur.count += 1;
    byPeriod[key] = cur;
  }
  return Object.entries(byPeriod)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, { sum, count }]) => ({
      period,
      hours: Math.round(sum),
      count,
    }));
}

export { READING_MEDIA_TYPES };
