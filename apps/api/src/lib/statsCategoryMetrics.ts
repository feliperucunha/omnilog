import type { BoardGameMatchPlayer, BoardGameProvider, MediaType } from "@geeklogs/shared";
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
};

export type BoardGameMatchStatsSort = "recent" | "mostPlayed" | "leastPlayed";

export async function recentBoardGamesForStats(
  userId: string,
  playedAtWhere?: Prisma.BoardGameMatchWhereInput,
  sort: BoardGameMatchStatsSort = "recent",
  limit = 24
): Promise<RecentBoardGameStatEntry[]> {
  const base: Prisma.BoardGameMatchWhereInput = {
    log: { userId, mediaType: "boardgames" },
  };
  const where = playedAtWhere ? { AND: [base, playedAtWhere] } : base;
  const rows = await prisma.boardGameMatch.findMany({
    where,
    select: {
      playedAt: true,
      players: true,
      log: {
        select: {
          id: true,
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
  };
  const byLog = new Map<string, Acc>();

  for (const row of rows) {
    const logId = row.log.id;
    const players = parseBoardGamePlayersJson(row.players);
    let acc = byLog.get(logId);
    if (!acc) {
      acc = {
        log: row.log,
        matchCount: 0,
        wins: 0,
        lastPlayedAt: row.playedAt,
        lastScore: userScoreFromMatch(players, userId),
      };
      byLog.set(logId, acc);
    }
    acc.matchCount += 1;
    if (matchCountsAsWinForUser(players, userId)) acc.wins += 1;
  }

  const sorted = [...byLog.values()].sort((a, b) => {
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
  logWhere?: Prisma.LogWhereInput
): Promise<number> {
  const base: Prisma.LogWhereInput = { userId, mediaType: "boardgames" };
  const where = logWhere ? { AND: [base, logWhere] } : base;
  const matches = await prisma.boardGameMatch.findMany({
    where: { log: where },
    select: { players: true },
  });
  let wins = 0;
  for (const row of matches) {
    const players = parseBoardGamePlayersJson(row.players);
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

export { READING_MEDIA_TYPES };
