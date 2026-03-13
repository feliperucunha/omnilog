import type { BadgeConditionType, BadgeMedium } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

/** App media types that count toward badge stats (maps to BadgeMedium). */
const BADGE_MEDIA_TYPES = ["movies", "tv", "anime", "manga", "comics", "books", "games", "boardgames"] as const;
const APP_MEDIA_TYPES_LIST = [...BADGE_MEDIA_TYPES];
const MEDIA_TO_BADGE: Record<string, BadgeMedium> = {
  movies: "MOVIE",
  tv: "TV_SHOW",
  anime: "ANIME",
  manga: "MANGA",
  comics: "COMIC",
  books: "BOOK",
  games: "GAME",
  boardgames: "BOARD_GAME",
};

/** Reverse: BadgeMedium -> app media type for API responses. */
export const BADGE_MEDIUM_TO_APP: Record<BadgeMedium, string> = {
  MOVIE: "movies",
  TV_SHOW: "tv",
  ANIME: "anime",
  MANGA: "manga",
  COMIC: "comics",
  BOOK: "books",
  GAME: "games",
  BOARD_GAME: "boardgames",
};

type ReviewCountKey =
  | "movieReviews"
  | "tvShowReviews"
  | "animeReviews"
  | "mangaReviews"
  | "comicReviews"
  | "bookReviews"
  | "gameReviews"
  | "boardGameReviews";

function getStatsColumn(medium: BadgeMedium): ReviewCountKey {
  const map: Record<BadgeMedium, ReviewCountKey> = {
    MOVIE: "movieReviews",
    TV_SHOW: "tvShowReviews",
    ANIME: "animeReviews",
    MANGA: "mangaReviews",
    COMIC: "comicReviews",
    BOOK: "bookReviews",
    GAME: "gameReviews",
    BOARD_GAME: "boardGameReviews",
  };
  return map[medium];
}

async function ensureReviewStats(userId: string): Promise<{
  movieReviews: number;
  tvShowReviews: number;
  animeReviews: number;
  mangaReviews: number;
  comicReviews: number;
  bookReviews: number;
  gameReviews: number;
  boardGameReviews: number;
  totalReviews: number;
  distinctMediaReviewed: number;
}> {
  let row = await prisma.userReviewStats.findUnique({ where: { userId } });
  if (!row) {
    row = await prisma.userReviewStats.create({
      data: { userId },
    });
  }
  return {
    ...row,
    gameReviews: row.gameReviews ?? 0,
    boardGameReviews: row.boardGameReviews ?? 0,
  };
}

/** Call when a new review is added (log created with review, or log updated from no review to having review). Returns badges newly granted. */
export async function handleReviewCreated(
  userId: string,
  logId: string,
  mediaType: string,
  reviewText: string | null
): Promise<NewBadge[]> {
  if (!reviewText || reviewText.trim().length === 0) return [];
  const medium = MEDIA_TO_BADGE[mediaType];
  if (!medium) return [];

  const stats = await ensureReviewStats(userId);
  const column = getStatsColumn(medium);
  const prevValue = stats[column] as number;
  const newValue = prevValue + 1;

  const mediumIdx = BADGE_MEDIA_TYPES.indexOf(mediaType as (typeof BADGE_MEDIA_TYPES)[number]);
  const distinctMedia = [
    stats.movieReviews,
    stats.tvShowReviews,
    stats.animeReviews,
    stats.mangaReviews,
    stats.comicReviews,
    stats.bookReviews,
    stats.gameReviews,
    stats.boardGameReviews,
  ].map((v, i) => (i === mediumIdx ? newValue : v));
  const distinctCount = distinctMedia.filter((v) => v > 0).length;

  await prisma.userReviewStats.upsert({
    where: { userId },
    create: {
      userId,
      movieReviews: medium === "MOVIE" ? 1 : 0,
      tvShowReviews: medium === "TV_SHOW" ? 1 : 0,
      animeReviews: medium === "ANIME" ? 1 : 0,
      mangaReviews: medium === "MANGA" ? 1 : 0,
      comicReviews: medium === "COMIC" ? 1 : 0,
      bookReviews: medium === "BOOK" ? 1 : 0,
      gameReviews: medium === "GAME" ? 1 : 0,
      boardGameReviews: medium === "BOARD_GAME" ? 1 : 0,
      totalReviews: 1,
      distinctMediaReviewed: 1,
    },
    update: {
      movieReviews: distinctMedia[0],
      tvShowReviews: distinctMedia[1],
      animeReviews: distinctMedia[2],
      mangaReviews: distinctMedia[3],
      comicReviews: distinctMedia[4],
      bookReviews: distinctMedia[5],
      gameReviews: distinctMedia[6],
      boardGameReviews: distinctMedia[7],
      totalReviews: stats.totalReviews + 1,
      distinctMediaReviewed: distinctCount,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastReviewDate: true, currentStreak: true },
  });
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const lastReview = user?.lastReviewDate ? new Date(user.lastReviewDate).getTime() : null;
  let newStreak = 1;
  if (lastReview !== null) {
    const lastDay = new Date(lastReview).setHours(0, 0, 0, 0);
    if (lastDay === yesterday) newStreak = (user?.currentStreak ?? 0) + 1;
    else if (lastDay === today) newStreak = user?.currentStreak ?? 1;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { lastReviewDate: now, currentStreak: newStreak },
  });

  return grantEarnedBadges(userId);
}

/**
 * Call when a review is removed (user clears review on PATCH, or deletes a log that had a review).
 * Keeps UserReviewStats in sync so reviewer level and milestone progress stay correct.
 */
export async function handleReviewRemoved(userId: string, mediaType: string): Promise<void> {
  const medium = MEDIA_TO_BADGE[mediaType];
  if (!medium) return;

  const row = await prisma.userReviewStats.findUnique({ where: { userId } });
  if (!row) return; // no stats yet, nothing to decrement

  const column = getStatsColumn(medium);
  const prevPerMedium = (row[column] as number) ?? 0;
  const newPerMedium = Math.max(0, prevPerMedium - 1);
  const prevTotal = row.totalReviews ?? 0;
  const newTotal = Math.max(0, prevTotal - 1);

  const movieReviews = column === "movieReviews" ? newPerMedium : row.movieReviews;
  const tvShowReviews = column === "tvShowReviews" ? newPerMedium : row.tvShowReviews;
  const animeReviews = column === "animeReviews" ? newPerMedium : row.animeReviews;
  const mangaReviews = column === "mangaReviews" ? newPerMedium : row.mangaReviews;
  const comicReviews = column === "comicReviews" ? newPerMedium : row.comicReviews;
  const bookReviews = column === "bookReviews" ? newPerMedium : row.bookReviews;
  const gameReviews = column === "gameReviews" ? newPerMedium : (row.gameReviews ?? 0);
  const boardGameReviews = column === "boardGameReviews" ? newPerMedium : (row.boardGameReviews ?? 0);
  const distinctMediaReviewed = [movieReviews, tvShowReviews, animeReviews, mangaReviews, comicReviews, bookReviews, gameReviews, boardGameReviews].filter(
    (v) => v > 0
  ).length;

  await prisma.userReviewStats.update({
    where: { userId },
    data: {
      movieReviews,
      tvShowReviews,
      animeReviews,
      mangaReviews,
      comicReviews,
      bookReviews,
      gameReviews,
      boardGameReviews,
      totalReviews: newTotal,
      distinctMediaReviewed,
    },
  });
}

/** Call when a log receives a like (reaction type=like). No longer grants XP or badges; kept for API compatibility. */
export async function handleReviewLiked(_logId: string, _recipientUserId: string): Promise<void> {}

/** Call when user adds a log (with or without review). Grants any newly earned badges (e.g. First Movie Log). */
export async function handleLogCreated(userId: string): Promise<NewBadge[]> {
  return grantEarnedBadges(userId);
}

export type NewBadge = { id: string; name: string; icon: string };

const LOG_MEDIA_TO_BADGE: Record<string, BadgeMedium> = {
  movies: "MOVIE",
  tv: "TV_SHOW",
  anime: "ANIME",
  manga: "MANGA",
  comics: "COMIC",
  books: "BOOK",
  games: "GAME",
  boardgames: "BOARD_GAME",
};

/** Check badge conditions against current stats and grant any newly earned badges. Call after review or log changes. */
export async function grantEarnedBadges(userId: string): Promise<NewBadge[]> {
  const [allBadges, existingUserBadgeIds, reviewStats, logRows, user, likesReceived] = await Promise.all([
    prisma.badge.findMany({ select: { id: true, name: true, icon: true, medium: true, conditionType: true, conditionValue: true } }),
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }).then((r) => new Set(r.map((x) => x.badgeId))),
    prisma.userReviewStats.findUnique({ where: { userId } }),
    prisma.log.groupBy({
      by: ["mediaType"],
      where: { userId, mediaType: { in: APP_MEDIA_TYPES_LIST } },
      _count: { id: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { currentStreak: true } }),
    prisma.logReaction.count({ where: { type: "like", log: { userId } } }),
  ]);

  const reviewCountByMedium: Record<BadgeMedium, number> = {
    MOVIE: reviewStats?.movieReviews ?? 0,
    TV_SHOW: reviewStats?.tvShowReviews ?? 0,
    ANIME: reviewStats?.animeReviews ?? 0,
    MANGA: reviewStats?.mangaReviews ?? 0,
    COMIC: reviewStats?.comicReviews ?? 0,
    BOOK: reviewStats?.bookReviews ?? 0,
    GAME: reviewStats?.gameReviews ?? 0,
    BOARD_GAME: reviewStats?.boardGameReviews ?? 0,
  };
  const totalReviews = reviewStats?.totalReviews ?? 0;
  const distinctMediaReviewed = reviewStats?.distinctMediaReviewed ?? 0;
  const currentStreak = user?.currentStreak ?? 0;

  const logCountByMedium: Record<BadgeMedium, number> = {
    MOVIE: 0,
    TV_SHOW: 0,
    ANIME: 0,
    MANGA: 0,
    COMIC: 0,
    BOOK: 0,
    GAME: 0,
    BOARD_GAME: 0,
  };
  let totalLogs = 0;
  for (const r of logRows) {
    const medium = LOG_MEDIA_TO_BADGE[r.mediaType];
    if (medium) {
      logCountByMedium[medium] = r._count.id;
      totalLogs += r._count.id;
    }
  }
  const distinctMediaLogged = Object.values(logCountByMedium).filter((c) => c > 0).length;

  const newBadges: NewBadge[] = [];
  for (const badge of allBadges) {
    if (existingUserBadgeIds.has(badge.id)) continue;
    const cond = badge.conditionType as BadgeConditionType;
    const value = badge.conditionValue;
    let met = false;
    if (cond === "REVIEW_COUNT_PER_MEDIA" && badge.medium) {
      met = (reviewCountByMedium[badge.medium] ?? 0) >= value;
    } else if (cond === "REVIEW_COUNT_GLOBAL") {
      met = totalReviews >= value;
    } else if (cond === "MEDIA_TYPES_REVIEWED") {
      met = distinctMediaReviewed >= value;
    } else if (cond === "REVIEW_LIKES") {
      met = likesReceived >= value;
    } else if (cond === "REVIEW_STREAK") {
      met = currentStreak >= value;
    } else if (cond === "LOG_COUNT_PER_MEDIA" && badge.medium) {
      met = (logCountByMedium[badge.medium] ?? 0) >= value;
    } else if (cond === "LOG_COUNT_GLOBAL") {
      met = totalLogs >= value;
    } else if (cond === "LOG_MEDIA_TYPES_LOGGED") {
      met = distinctMediaLogged >= value;
    } else if (cond === "FIRST_REVIEW") {
      met = totalReviews >= 1;
    }
    if (!met) continue;
    await prisma.userBadge.create({
      data: { userId, badgeId: badge.id },
    });
    existingUserBadgeIds.add(badge.id);
    newBadges.push({ id: badge.id, name: badge.name, icon: badge.icon });
  }
  return newBadges;
}

export async function setSelectedBadges(userId: string, badgeIds: string[]): Promise<void> {
  if (badgeIds.length > 3) badgeIds = badgeIds.slice(0, 3);
  const owned = await prisma.userBadge.findMany({
    where: { userId, badgeId: { in: badgeIds } },
    select: { badgeId: true },
  });
  const ownedSet = new Set(owned.map((o) => o.badgeId));
  const valid = badgeIds.filter((id) => ownedSet.has(id));
  await prisma.user.update({
    where: { id: userId },
    data: { selectedBadgeIds: JSON.stringify(valid) },
  });
}

