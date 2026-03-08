import { prisma } from "./prisma.js";

export type ReactionType = "like" | "dislike";

export interface ReactionStats {
  likesCount: number;
  dislikesCount: number;
  userReaction: ReactionType | null;
}

/**
 * Get reaction counts and current user's reaction for a list of log IDs.
 * Pass currentUserId when the request is authenticated to get userReaction.
 */
export async function getReactionsForLogs(
  logIds: string[],
  currentUserId?: string | null
): Promise<Map<string, ReactionStats>> {
  if (logIds.length === 0) return new Map();

  const [counts, userReactions] = await Promise.all([
    prisma.logReaction.groupBy({
      by: ["logId", "type"],
      where: { logId: { in: logIds } },
      _count: { id: true },
    }),
    currentUserId
      ? prisma.logReaction.findMany({
          where: { logId: { in: logIds }, userId: currentUserId },
          select: { logId: true, type: true },
        })
      : Promise.resolve([]),
  ]);

  const map = new Map<string, ReactionStats>();
  for (const id of logIds) {
    map.set(id, { likesCount: 0, dislikesCount: 0, userReaction: null });
  }
  for (const row of counts) {
    const stats = map.get(row.logId);
    if (stats) {
      if (row.type === "like") stats.likesCount = row._count.id;
      if (row.type === "dislike") stats.dislikesCount = row._count.id;
    }
  }
  for (const r of userReactions) {
    const stats = map.get(r.logId);
    if (stats && (r.type === "like" || r.type === "dislike")) {
      stats.userReaction = r.type;
    }
  }
  return map;
}
