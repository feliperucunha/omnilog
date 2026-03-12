import type { BadgeConditionType, BadgeMedium } from "@prisma/client";
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

  let xp = XP_WRITE_REVIEW;
  const wordCount = reviewText.trim().split(/\s+/).length;
  if (wordCount >= REVIEW_LONG_WORDS) xp += XP_REVIEW_LONG_BONUS;
  await grantXp(userId, "WRITE_REVIEW", xp, logId);

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

  return checkAndGrantBadges(userId);
}

/** Call when a log receives a like (reaction type=like). Grants XP to the log owner. */
export async function handleReviewLiked(logId: string, recipientUserId: string): Promise<void> {
  await grantXp(recipientUserId, "REVIEW_LIKE", XP_REVIEW_LIKE, logId);
  await checkAndGrantBadges(recipientUserId);
}

/** Call when user adds a log (with or without review). Returns badges newly granted by this action. */
export async function handleLogCreated(userId: string): Promise<NewBadge[]> {
  await grantXp(userId, "LOG_ITEM", XP_LOG_ITEM);
  return checkAndGrantBadges(userId);
}

async function getStats(userId: string) {
  const row = await prisma.userReviewStats.findUnique({ where: { userId } });
  if (!row)
    return {
      movieReviews: 0,
      tvShowReviews: 0,
      animeReviews: 0,
      mangaReviews: 0,
      comicReviews: 0,
      bookReviews: 0,
      totalReviews: 0,
      distinctMediaReviewed: 0,
    };
  return row;
}

async function getReviewLikesCount(userId: string): Promise<number> {
  const logs = await prisma.log.findMany({
    where: { userId },
    select: { id: true },
  });
  const logIds = logs.map((l) => l.id);
  if (logIds.length === 0) return 0;
  const count = await prisma.logReaction.count({
    where: { logId: { in: logIds }, type: "like" },
  });
  return count;
}

/** Log counts per medium and total (for log-based badges). Uses actual Log table. */
type LogStats = {
  movieLogs: number;
  tvShowLogs: number;
  animeLogs: number;
  mangaLogs: number;
  comicLogs: number;
  bookLogs: number;
  totalLogs: number;
  distinctMediaLogged: number;
};

const LOG_STATS_KEYS: Record<BadgeMedium, keyof LogStats> = {
  MOVIE: "movieLogs",
  TV_SHOW: "tvShowLogs",
  ANIME: "animeLogs",
  MANGA: "mangaLogs",
  COMIC: "comicLogs",
  BOOK: "bookLogs",
};

async function getLogStats(userId: string): Promise<LogStats> {
  const mediaList = [...BADGE_MEDIA_TYPES];
  const logs = await prisma.log.findMany({
    where: { userId, mediaType: { in: mediaList } },
    select: { mediaType: true },
  });
  const zero: LogStats = {
    movieLogs: 0,
    tvShowLogs: 0,
    animeLogs: 0,
    mangaLogs: 0,
    comicLogs: 0,
    bookLogs: 0,
    totalLogs: 0,
    distinctMediaLogged: 0,
  };
  const seenMedia = new Set<string>();
  for (const log of logs) {
    const medium = MEDIA_TO_BADGE[log.mediaType];
    if (medium) {
      const key = LOG_STATS_KEYS[medium];
      if (key) {
        (zero as Record<string, number>)[key] = ((zero as Record<string, number>)[key] as number) + 1;
        seenMedia.add(log.mediaType);
      }
    }
  }
  zero.totalLogs = logs.length;
  zero.distinctMediaLogged = seenMedia.size;
  return zero;
}

function getCurrentValueForCondition(
  conditionType: BadgeConditionType,
  stats: Awaited<ReturnType<typeof getStats>>,
  logStats: LogStats,
  medium: BadgeMedium | null,
  reviewLikes: number,
  currentStreak: number
): number {
  switch (conditionType) {
    case "FIRST_REVIEW":
      return stats.totalReviews;
    case "REVIEW_COUNT_PER_MEDIA":
      if (!medium) return 0;
      return stats[getStatsColumn(medium)] as number;
    case "REVIEW_COUNT_GLOBAL":
      return stats.totalReviews;
    case "MEDIA_TYPES_REVIEWED":
      return stats.distinctMediaReviewed;
    case "REVIEW_LIKES":
      return reviewLikes;
    case "REVIEW_STREAK":
      return currentStreak;
    case "LOG_COUNT_PER_MEDIA":
      if (!medium) return 0;
      return logStats[LOG_STATS_KEYS[medium]];
    case "LOG_COUNT_GLOBAL":
      return logStats.totalLogs;
    case "LOG_MEDIA_TYPES_LOGGED":
      return logStats.distinctMediaLogged;
    default:
      return 0;
  }
}

function evaluateCondition(
  conditionType: BadgeConditionType,
  conditionValue: number,
  stats: Awaited<ReturnType<typeof getStats>>,
  logStats: LogStats,
  medium: BadgeMedium | null,
  reviewLikes: number,
  currentStreak: number
): boolean {
  const current = getCurrentValueForCondition(conditionType, stats, logStats, medium, reviewLikes, currentStreak);
  return current >= conditionValue;
}

export type NewBadge = { id: string; name: string; icon: string };

export async function checkAndGrantBadges(userId: string): Promise<NewBadge[]> {
  const [ownedBadgeIds, allBadges, stats, logStats, reviewLikes, user] = await Promise.all([
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }).then((r) => new Set(r.map((b) => b.badgeId))),
    prisma.badge.findMany({ where: { hidden: false } }),
    getStats(userId),
    getLogStats(userId),
    getReviewLikesCount(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { currentStreak: true, selectedBadgeIds: true } }),
  ]);

  const currentStreak = user?.currentStreak ?? 0;
  const selectedBadgeIds = user?.selectedBadgeIds ? (JSON.parse(user.selectedBadgeIds) as string[]) : null;
  const newlyGranted: NewBadge[] = [];

  for (const badge of allBadges) {
    if (ownedBadgeIds.has(badge.id)) continue;
    const pass = evaluateCondition(
      badge.conditionType,
      badge.conditionValue,
      stats,
      logStats,
      badge.medium,
      reviewLikes,
      currentStreak
    );
    if (pass) {
      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id },
      });
      newlyGranted.push({ id: badge.id, name: badge.name, icon: badge.icon });
      let newSelected: string[] = Array.isArray(selectedBadgeIds) ? selectedBadgeIds : [];
      if (newSelected.length < 3) {
        newSelected = [...newSelected, badge.id].slice(0, 3);
        await prisma.user.update({
          where: { id: userId },
          data: { selectedBadgeIds: JSON.stringify(newSelected) },
        });
      }
    }
  }
  return newlyGranted;
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

export type BadgeProgressItem = {
  badge: { id: string; name: string; icon: string; medium: BadgeMedium | null; rarity: string };
  current: number;
  target: number;
  progressPct: number;
};

export type PerMediumProgress = {
  mediaType: string;
  currentBadge: { id: string; name: string; icon: string } | null;
  nextBadge: BadgeProgressItem | null;
};

/** Get badge progress for dashboard: earned badges, next badges with progress, per-medium current/next. */
export async function getBadgeProgress(userId: string): Promise<{
  earnedBadges: Array<{ id: string; name: string; icon: string; medium: BadgeMedium | null; rarity: string }>;
  nextBadges: BadgeProgressItem[];
  perMedium: PerMediumProgress[];
  xpTotal: number;
  level: number;
}> {
  const [user, ownedBadges, allBadges, stats, logStats, reviewLikes] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { xpTotal: true, level: true, currentStreak: true },
    }),
    prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
    }),
    prisma.badge.findMany({ where: { hidden: false }, orderBy: [{ medium: "asc" }, { conditionValue: "asc" }] }),
    getStats(userId),
    getLogStats(userId),
    getReviewLikesCount(userId),
  ]);
  const currentStreak = user?.currentStreak ?? 0;
  const xpTotal = user?.xpTotal ?? 0;
  const level = user?.level ?? 1;
  const ownedSet = new Set(ownedBadges.map((b) => b.badgeId));

  const earnedBadges = ownedBadges.map((ub) => ({
    id: ub.badge.id,
    name: ub.badge.name,
    icon: ub.badge.icon,
    medium: ub.badge.medium,
    rarity: ub.badge.rarity,
  }));

  const nextBadges: BadgeProgressItem[] = [];
  for (const badge of allBadges) {
    if (ownedSet.has(badge.id)) continue;
    const current = getCurrentValueForCondition(
      badge.conditionType,
      stats,
      logStats,
      badge.medium,
      reviewLikes,
      currentStreak
    );
    const target = badge.conditionValue;
    const progressPct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    nextBadges.push({
      badge: {
        id: badge.id,
        name: badge.name,
        icon: badge.icon,
        medium: badge.medium,
        rarity: badge.rarity,
      },
      current,
      target,
      progressPct,
    });
  }
  nextBadges.sort((a, b) => b.progressPct - a.progressPct);

  const perMedium: PerMediumProgress[] = BADGE_MEDIA_TYPES.map((appMedia) => {
    const medium = MEDIA_TO_BADGE[appMedia];
    const earnedForMedium = ownedBadges
      .filter((ub) => ub.badge.medium === medium)
      .sort((a, b) => (b.badge.conditionValue ?? 0) - (a.badge.conditionValue ?? 0));
    const currentBadge = earnedForMedium[0]
      ? { id: earnedForMedium[0].badge.id, name: earnedForMedium[0].badge.name, icon: earnedForMedium[0].badge.icon }
      : null;
    const nextForMedium = nextBadges.find((n) => n.badge.medium === medium) ?? null;
    return {
      mediaType: appMedia,
      currentBadge,
      nextBadge: nextForMedium,
    };
  });

  return { earnedBadges, nextBadges, perMedium, xpTotal, level };
}
