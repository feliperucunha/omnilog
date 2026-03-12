import type { BadgeMedium } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const XP_LOG_ITEM = 5;
const XP_WRITE_REVIEW = 20;
const XP_REVIEW_LONG_BONUS = 10;
const XP_REVIEW_LIKE = 5;
const XP_REVIEW_REPLY = 10;
const REVIEW_LONG_WORDS = 150;
const LEVEL_DIVISOR = 50;

/** App media types that count toward badge stats (maps to BadgeMedium). */
const BADGE_MEDIA_TYPES = ["movies", "tv", "anime", "manga", "comics", "books"] as const;
const MEDIA_TO_BADGE: Record<string, BadgeMedium> = {
  movies: "MOVIE",
  tv: "TV_SHOW",
  anime: "ANIME",
  manga: "MANGA",
  comics: "COMIC",
  books: "BOOK",
};

/** Reverse: BadgeMedium -> app media type for API responses. */
export const BADGE_MEDIUM_TO_APP: Record<BadgeMedium, string> = {
  MOVIE: "movies",
  TV_SHOW: "tv",
  ANIME: "anime",
  MANGA: "manga",
  COMIC: "comics",
  BOOK: "books",
};

type ReviewCountKey =
  | "movieReviews"
  | "tvShowReviews"
  | "animeReviews"
  | "mangaReviews"
  | "comicReviews"
  | "bookReviews";

function getStatsColumn(medium: BadgeMedium): ReviewCountKey {
  const map: Record<BadgeMedium, ReviewCountKey> = {
    MOVIE: "movieReviews",
    TV_SHOW: "tvShowReviews",
    ANIME: "animeReviews",
    MANGA: "mangaReviews",
    COMIC: "comicReviews",
    BOOK: "bookReviews",
  };
  return map[medium];
}

export async function grantXp(
  userId: string,
  actionType: string,
  xp: number,
  referenceId?: string | null
): Promise<void> {
  await prisma.userXp.create({
    data: { userId, actionType, xp, referenceId: referenceId ?? null },
  });
  const sum = await prisma.userXp.aggregate({
    where: { userId },
    _sum: { xp: true },
  });
  const xpTotal = sum._sum.xp ?? 0;
  const level = Math.max(1, Math.floor(Math.sqrt(xpTotal / LEVEL_DIVISOR)));
  await prisma.user.update({
    where: { id: userId },
    data: { xpTotal, level },
  });
}

async function ensureReviewStats(userId: string): Promise<{
  movieReviews: number;
  tvShowReviews: number;
  animeReviews: number;
  mangaReviews: number;
  comicReviews: number;
  bookReviews: number;
  totalReviews: number;
  distinctMediaReviewed: number;
}> {
  let row = await prisma.userReviewStats.findUnique({ where: { userId } });
  if (!row) {
    row = await prisma.userReviewStats.create({
      data: { userId },
    });
  }
  return row;
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
  if (!medium) return []; // boardgames, games don't count toward badge stats

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

  return [];
}

/**
 * Call when a review is removed (user clears review on PATCH, or deletes a log that had a review).
 * Keeps UserReviewStats in sync so reviewer level and milestone progress stay correct.
 */
export async function handleReviewRemoved(userId: string, mediaType: string): Promise<void> {
  const medium = MEDIA_TO_BADGE[mediaType];
  if (!medium) return; // boardgames, games not in stats

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
  const distinctMediaReviewed = [movieReviews, tvShowReviews, animeReviews, mangaReviews, comicReviews, bookReviews].filter(
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
      totalReviews: newTotal,
      distinctMediaReviewed,
    },
  });
}

/** Call when a log receives a like (reaction type=like). No longer grants XP or badges; kept for API compatibility. */
export async function handleReviewLiked(_logId: string, _recipientUserId: string): Promise<void> {}

/** Call when user adds a log (with or without review). Kept for API compatibility; no longer grants XP or badges. */
export async function handleLogCreated(_userId: string): Promise<NewBadge[]> {
  return [];
}

export type NewBadge = { id: string; name: string; icon: string };

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

