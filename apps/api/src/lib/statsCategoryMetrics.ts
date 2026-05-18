import type { BoardGameMatchPlayer, MediaType } from "@geeklogs/shared";
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
