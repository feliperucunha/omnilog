/**
 * Milestone progress: simple progress toward next milestone per scope (global + per medium).
 * Single source of truth for dashboard progress; no condition-type branching.
 */

import type { BadgeMedium } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const APP_MEDIA_TYPES = ["movies", "tv", "anime", "manga", "comics", "books", "games", "boardgames"] as const;
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

const REVIEW_COLUMNS: Record<BadgeMedium, keyof { movieReviews: number; tvShowReviews: number; animeReviews: number; mangaReviews: number; comicReviews: number; bookReviews: number; gameReviews: number; boardGameReviews: number }> = {
  MOVIE: "movieReviews",
  TV_SHOW: "tvShowReviews",
  ANIME: "animeReviews",
  MANGA: "mangaReviews",
  COMIC: "comicReviews",
  BOOK: "bookReviews",
  GAME: "gameReviews",
  BOARD_GAME: "boardGameReviews",
};

const LOG_KEYS: Record<BadgeMedium, string> = {
  MOVIE: "movieLogs",
  TV_SHOW: "tvShowLogs",
  ANIME: "animeLogs",
  MANGA: "mangaLogs",
  COMIC: "comicLogs",
  BOOK: "bookLogs",
  GAME: "gameLogs",
  BOARD_GAME: "boardGameLogs",
};

export interface MilestoneInfo {
  threshold: number;
  label: string;
  icon: string;
}

export interface ScopeProgress {
  current: number;
  next: MilestoneInfo | null;
  progressPct: number; // 0–100, capped
  earned: MilestoneInfo[]; // milestones already reached
}

export interface PerMediumProgress {
  mediaType: string;
  reviews: ScopeProgress;
  logs: ScopeProgress;
}

export interface MilestoneProgressResponse {
  perMedium: PerMediumProgress[];
  global: {
    reviews: ScopeProgress;
    logs: ScopeProgress;
  };
}

async function getReviewStats(userId: string) {
  const row = await prisma.userReviewStats.findUnique({
    where: { userId },
  });
  if (!row)
    return {
      movieReviews: 0,
      tvShowReviews: 0,
      animeReviews: 0,
      mangaReviews: 0,
      comicReviews: 0,
      bookReviews: 0,
      gameReviews: 0,
      boardGameReviews: 0,
      totalReviews: 0,
    };
  return {
    movieReviews: row.movieReviews,
    tvShowReviews: row.tvShowReviews,
    animeReviews: row.animeReviews,
    mangaReviews: row.mangaReviews,
    comicReviews: row.comicReviews,
    bookReviews: row.bookReviews,
    gameReviews: row.gameReviews ?? 0,
    boardGameReviews: row.boardGameReviews ?? 0,
    totalReviews: row.totalReviews,
  };
}

async function getLogStats(userId: string): Promise<Record<string, number> & { totalLogs: number }> {
  const rows = await prisma.log.groupBy({
    by: ["mediaType"],
    where: { userId, mediaType: { in: [...APP_MEDIA_TYPES] } },
    _count: { id: true },
  });
  const out: Record<string, number> = {
    movieLogs: 0,
    tvShowLogs: 0,
    animeLogs: 0,
    mangaLogs: 0,
    comicLogs: 0,
    bookLogs: 0,
    gameLogs: 0,
    boardGameLogs: 0,
    totalLogs: 0,
  };
  let total = 0;
  for (const r of rows) {
    const key = LOG_KEYS[MEDIA_TO_BADGE[r.mediaType]];
    if (key) {
      out[key] = r._count.id;
      total += r._count.id;
    }
  }
  out.totalLogs = total;
  return out as Record<string, number> & { totalLogs: number };
}

function buildScopeProgress(
  current: number,
  milestones: { threshold: number; label: string; icon: string }[]
): ScopeProgress {
  const sorted = [...milestones].sort((a, b) => a.threshold - b.threshold);
  const earned = sorted.filter((m) => current >= m.threshold).map((m) => ({ threshold: m.threshold, label: m.label, icon: m.icon }));
  const nextMilestone = sorted.find((m) => m.threshold > current) ?? null;
  const next = nextMilestone
    ? { threshold: nextMilestone.threshold, label: nextMilestone.label, icon: nextMilestone.icon }
    : null;
  const progressPct =
    next && next.threshold > 0
      ? Math.min(100, Math.round((current / next.threshold) * 100))
      : 100;
  return {
    current,
    next,
    progressPct,
    earned,
  };
}

/** Build scope progress with no milestones (next: null, earned: []). Used when table is missing or empty. */
function scopeProgressNoMilestones(current: number): ScopeProgress {
  return {
    current,
    next: null,
    progressPct: current > 0 ? 100 : 0,
    earned: [],
  };
}

/**
 * Get milestone progress for the current user. Used by dashboard and MediaLogs.
 * Returns empty progress if Milestone table is missing (e.g. migration not run in Supabase).
 */
export async function getMilestoneProgress(userId: string): Promise<MilestoneProgressResponse> {
  try {
    const [reviewStats, logStats, allMilestones] = await Promise.all([
      getReviewStats(userId),
      getLogStats(userId),
      prisma.milestone.findMany({ orderBy: [{ sortOrder: "asc" }, { threshold: "asc" }] }),
    ]);

    if (allMilestones.length === 0) {
      const reviewStats = await getReviewStats(userId);
      const logStats = await getLogStats(userId);
      const r = reviewStats as Record<string, number>;
      const l = logStats as Record<string, number> & { totalLogs: number };
      return {
        perMedium: APP_MEDIA_TYPES.map((mediaType) => {
          const medium = MEDIA_TO_BADGE[mediaType];
          return {
            mediaType,
            reviews: scopeProgressNoMilestones(r[REVIEW_COLUMNS[medium]] ?? 0),
            logs: scopeProgressNoMilestones(l[LOG_KEYS[medium]] ?? 0),
          };
        }),
        global: {
          reviews: scopeProgressNoMilestones(r.totalReviews ?? 0),
          logs: scopeProgressNoMilestones(l.totalLogs ?? 0),
        },
      };
    }

    const byKey = (metric: string, scope: string, medium: BadgeMedium | null) =>
      allMilestones.filter(
        (m) =>
          m.metric === metric &&
          m.scope === scope &&
          (medium === null ? m.medium === null : m.medium === medium)
      );

    const perMedium: PerMediumProgress[] = APP_MEDIA_TYPES.map((mediaType) => {
      const medium = MEDIA_TO_BADGE[mediaType];
      const reviewCount = (reviewStats as Record<string, number>)[REVIEW_COLUMNS[medium]] ?? 0;
      const logCount = (logStats as Record<string, number>)[LOG_KEYS[medium]] ?? 0;
      return {
        mediaType,
        reviews: buildScopeProgress(reviewCount, byKey("reviews", "per_medium", medium)),
        logs: buildScopeProgress(logCount, byKey("logs", "per_medium", medium)),
      };
    });

    const global = {
      reviews: buildScopeProgress(reviewStats.totalReviews, byKey("reviews", "global", null)),
      logs: buildScopeProgress(logStats.totalLogs, byKey("logs", "global", null)),
    };

    return { perMedium, global };
  } catch (err) {
    console.error("Milestone progress failed (is Milestone table created? run supabase-milestones.sql):", err);
    try {
      const reviewStats = await getReviewStats(userId);
      const logStats = await getLogStats(userId);
      const r = reviewStats as Record<string, number>;
      const l = logStats as Record<string, number> & { totalLogs: number };
      return {
        perMedium: APP_MEDIA_TYPES.map((mediaType) => {
          const medium = MEDIA_TO_BADGE[mediaType];
          return {
            mediaType,
            reviews: scopeProgressNoMilestones(r[REVIEW_COLUMNS[medium]] ?? 0),
            logs: scopeProgressNoMilestones(l[LOG_KEYS[medium]] ?? 0),
          };
        }),
        global: {
          reviews: scopeProgressNoMilestones(r.totalReviews ?? 0),
          logs: scopeProgressNoMilestones(l.totalLogs ?? 0),
        },
      };
    } catch (fallbackErr) {
      console.error("Milestone fallback failed:", fallbackErr);
      return {
        perMedium: APP_MEDIA_TYPES.map((mediaType) => ({
          mediaType,
          reviews: scopeProgressNoMilestones(0),
          logs: scopeProgressNoMilestones(0),
        })),
        global: {
          reviews: scopeProgressNoMilestones(0),
          logs: scopeProgressNoMilestones(0),
        },
      };
    }
  }
}

export interface ReviewerMilestoneInfo {
  label: string;
  icon: string;
  /** 1-based level (position in sorted milestones) for display as Roman numeral */
  level: number;
}

export interface ReviewerMilestonesWithCount {
  badges: ReviewerMilestoneInfo[];
  /** Review count in this category (for tooltip: "X has N reviews in Y") */
  count: number;
}

/**
 * Get the highest earned review milestone for a given medium for multiple users.
 * Used when a single badge is needed (e.g. backward compat).
 */
export async function getReviewerMilestoneForMediumBatch(
  userIds: string[],
  mediaType: string
): Promise<Map<string, ReviewerMilestoneInfo | null>> {
  const allMap = await getAllReviewerMilestonesForMediumBatch(userIds, mediaType);
  const map = new Map<string, ReviewerMilestoneInfo | null>();
  for (const [userId, { badges }] of allMap) {
    map.set(userId, badges.length > 0 ? badges[badges.length - 1]! : null);
  }
  return map;
}

/**
 * Get all earned review milestones for a given medium for multiple users.
 * Used on item pages so reviews can show every badge the reviewer has earned in that medium.
 * Also returns each reviewer's review count in that category for tooltips.
 */
export async function getAllReviewerMilestonesForMediumBatch(
  userIds: string[],
  mediaType: string
): Promise<Map<string, ReviewerMilestonesWithCount>> {
  const medium = MEDIA_TO_BADGE[mediaType];
  if (!medium)
    return new Map(userIds.map((id) => [id, { badges: [], count: 0 }]));

  try {
    const [milestones, statsRows] = await Promise.all([
      prisma.milestone.findMany({
        where: { metric: "reviews", scope: "per_medium", medium },
        orderBy: { threshold: "asc" },
      }),
      prisma.userReviewStats.findMany({
        where: { userId: { in: userIds } },
      }),
    ]);
    const countKey = REVIEW_COLUMNS[medium];
    const sorted = [...milestones].sort((a, b) => a.threshold - b.threshold);
    const map = new Map<string, ReviewerMilestonesWithCount>();
    for (const userId of userIds) {
      const row = statsRows.find((r) => r.userId === userId);
      const count = (row?.[countKey] as number) ?? 0;
      const earned = sorted.filter((m) => count >= m.threshold);
      const badges: ReviewerMilestoneInfo[] = earned.map((m) => ({
        label: m.label,
        icon: m.icon,
        level: sorted.findIndex((mil) => mil.id === m.id) + 1,
      }));
      map.set(userId, { badges, count });
    }
    return map;
  } catch {
    return new Map(userIds.map((id) => [id, { badges: [], count: 0 }]));
  }
}
