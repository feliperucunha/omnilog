import type { BoardGameMatchPlayer } from "@geeklogs/shared";
import type { Prisma } from "@prisma/client";
import { tierHasUnlimitedLogs } from "./userTier.js";

const FREE_LOG_LIMIT = 500;

export type HostBoardGameLogForTaggedSync = {
  externalId: string;
  title: string;
  image: string | null;
  boardGameSource: string | null;
  genres: string | null;
  mechanics: string | null;
};

async function canCreateOneMoreLogInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  tier: string
): Promise<boolean> {
  if (tierHasUnlimitedLogs(tier)) return true;
  const count = await tx.log.count({ where: { userId } });
  return count < FREE_LOG_LIMIT;
}

export async function syncTaggedPlayersBoardGameLogs(
  tx: Prisma.TransactionClient,
  opts: {
    hostUserId: string;
    hostLog: HostBoardGameLogForTaggedSync;
    playersPayload: BoardGameMatchPlayer[];
    playedAt: Date;
    durationHours: number;
    playersJson: string;
    notes: string | null;
  }
): Promise<string[]> {
  const taggedUserIds = [
    ...new Set(
      opts.playersPayload
        .map((p) => p.appUserId?.trim())
        .filter((id): id is string => !!id && id !== opts.hostUserId)
    ),
  ];
  if (taggedUserIds.length === 0) return [];

  const createdLogUserIds: string[] = [];

  for (const taggedUserId of taggedUserIds) {
    let taggedLog = await tx.log.findUnique({
      where: {
        userId_mediaType_externalId: {
          userId: taggedUserId,
          mediaType: "boardgames",
          externalId: opts.hostLog.externalId,
        },
      },
      select: { id: true, status: true, matchesPlayed: true },
    });

    if (!taggedLog) {
      const taggedUser = await tx.user.findUnique({
        where: { id: taggedUserId },
        select: { tier: true },
      });
      if (!(await canCreateOneMoreLogInTx(tx, taggedUserId, taggedUser?.tier ?? "free"))) {
        continue;
      }
      taggedLog = await tx.log.create({
        data: {
          userId: taggedUserId,
          mediaType: "boardgames",
          externalId: opts.hostLog.externalId,
          title: opts.hostLog.title,
          image: opts.hostLog.image,
          boardGameSource: opts.hostLog.boardGameSource,
          genres: opts.hostLog.genres,
          mechanics: opts.hostLog.mechanics,
          status: "played",
          completedAt: opts.playedAt,
          matchesPlayed: 1,
          grade: null,
          review: null,
          listType: null,
          startedAt: null,
          contentHours: null,
          hoursToBeat: null,
          season: null,
          episode: null,
          chapter: null,
          volume: null,
          pagesRead: null,
          gamePlatform: null,
          own: null,
          wantToBuy: null,
          sold: null,
          affinityContext: null,
          purchaseAmountMinor: null,
          purchaseCurrency: null,
          saleAmountMinor: null,
          saleCurrency: null,
          spendFieldsAt: null,
        },
        select: { id: true, status: true, matchesPlayed: true },
      });
      createdLogUserIds.push(taggedUserId);
    } else {
      const bumpToPlayed = taggedLog.status !== "played";
      const nextCount = (taggedLog.matchesPlayed ?? 0) + 1;
      taggedLog = await tx.log.update({
        where: { id: taggedLog.id },
        data: {
          matchesPlayed: nextCount,
          ...(bumpToPlayed
            ? {
                status: "played",
                completedAt: opts.playedAt,
              }
            : {}),
        },
        select: { id: true, status: true, matchesPlayed: true },
      });
    }

    await tx.boardGameMatch.create({
      data: {
        logId: taggedLog.id,
        playedAt: opts.playedAt,
        durationHours: opts.durationHours,
        players: opts.playersJson,
        notes: opts.notes,
      },
    });
  }

  return createdLogUserIds;
}
