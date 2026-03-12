/**
 * Reviewer level: single source of truth for "how serious to take this reviewer."
 * Used on review pages as a badge of honor. Based on total review count.
 */

import { prisma } from "../lib/prisma.js";

export interface ReviewerLevelInfo {
  level: number;
  label: string;
  icon: string;
}

/** Ordered by threshold ascending. First matching tier (totalReviews >= threshold) is used. */
const REVIEWER_LEVELS: { threshold: number; label: string; icon: string }[] = [
  { threshold: 0, label: "Novice", icon: "🌱" },
  { threshold: 1, label: "Reviewer", icon: "✍️" },
  { threshold: 5, label: "Reviewer II", icon: "📝" },
  { threshold: 10, label: "Critic", icon: "⭐" },
  { threshold: 25, label: "Expert", icon: "🏆" },
  { threshold: 50, label: "Veteran", icon: "👑" },
];

/**
 * Get reviewer level from total review count. Uses the highest tier whose threshold <= totalReviews.
 */
export function getReviewerLevelFromCount(totalReviews: number): ReviewerLevelInfo {
  let best = REVIEWER_LEVELS[0];
  for (const tier of REVIEWER_LEVELS) {
    if (totalReviews >= tier.threshold) best = tier;
    else break;
  }
  const index = REVIEWER_LEVELS.findIndex((t) => t.threshold === best.threshold);
  return {
    level: index >= 0 ? index + 1 : 1,
    label: best.label,
    icon: best.icon,
  };
}

/**
 * Get reviewer level for a user. Reads UserReviewStats.totalReviews (single source of truth).
 */
export async function getReviewerLevel(userId: string): Promise<ReviewerLevelInfo> {
  const stats = await prisma.userReviewStats.findUnique({
    where: { userId },
    select: { totalReviews: true },
  });
  const totalReviews = stats?.totalReviews ?? 0;
  return getReviewerLevelFromCount(totalReviews);
}

/**
 * Batch get reviewer levels for multiple user IDs. Returns a Map userId -> ReviewerLevelInfo.
 */
export async function getReviewerLevelsBatch(userIds: string[]): Promise<Map<string, ReviewerLevelInfo>> {
  if (userIds.length === 0) return new Map();
  const uniqueIds = [...new Set(userIds)];
  const rows = await prisma.userReviewStats.findMany({
    where: { userId: { in: uniqueIds } },
    select: { userId: true, totalReviews: true },
  });
  const map = new Map<string, ReviewerLevelInfo>();
  for (const id of uniqueIds) {
    const row = rows.find((r) => r.userId === id);
    map.set(id, getReviewerLevelFromCount(row?.totalReviews ?? 0));
  }
  return map;
}
