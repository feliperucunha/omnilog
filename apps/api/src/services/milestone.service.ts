/**
 * Milestone progress: simple progress toward next milestone per scope (global + per medium).
 * Single source of truth for dashboard progress; no condition-type branching.
 */

import type { BadgeMedium } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const APP_MEDIA_TYPES = ["movies", "tv", "anime", "manga", "comics", "books"] as const;
const MEDIA_TO_BADGE: Record<string, BadgeMedium> = {
  movies: "MOVIE",
  tv: "TV_SHOW",
  anime: "ANIME",
  manga: "MANGA",
  comics: "COMIC",
  books: "BOOK",
};

const REVIEW_COLUMNS: Record<BadgeMedium, keyof { movieReviews: number; tvShowReviews: number; animeReviews: number; mangaReviews: number; comicReviews: number; bookReviews: number }> = {
  MOVIE: "movieReviews",
  TV_SHOW: "tvShowReviews",
  ANIME: "animeReviews",
  MANGA: "mangaReviews",
  COMIC: "comicReviews",
  BOOK: "bookReviews",
};

const LOG_KEYS: Record<BadgeMedium, string> = {
  MOVIE: "movieLogs",
  TV_SHOW: "tvShowLogs",
  ANIME: "animeLogs",
  MANGA: "mangaLogs",
  COMIC: "comicLogs",
  BOOK: "bookLogs",
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
      totalReviews: 0,
    };
  return {
    movieReviews: row.movieReviews,
    tvShowReviews: row.tvShowReviews,
    animeReviews: row.animeReviews,
    mangaReviews: row.mangaReviews,
    comicReviews: row.comicReviews,
    bookReviews: row.bookReviews,
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

/**
 * Get milestone progress for the current user. Used by dashboard and MediaLogs.
 */
export async function getMilestoneProgress(userId: string): Promise<MilestoneProgressResponse> {
  const [reviewStats, logStats, allMilestones] = await Promise.all([
    getReviewStats(userId),
    getLogStats(userId),
    prisma.milestone.findMany({ orderBy: [{ sortOrder: "asc" }, { threshold: "asc" }] }),
  ]);

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
}
