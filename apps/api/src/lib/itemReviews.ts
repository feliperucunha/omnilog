import type { MediaType } from "@geeklogs/shared";
import { groupItemReviewsByUser, pickPrimaryScopedReview, reviewScopeFromParts } from "@geeklogs/shared";
import type { PrismaClient } from "@prisma/client";
import { getReactionsForLogs } from "./reactions.js";
import { decodeHtmlEntities } from "@geeklogs/shared";
import { serializeScopedReview } from "./scopedReview.js";
import { tierHasProFeatures } from "./userTier.js";
import { getAllReviewerMilestonesForMediumBatch } from "../services/milestone.service.js";

type LogWithUser = {
  id: string;
  userId: string;
  grade: number | null;
  review: string | null;
  listType: string | null;
  status: string | null;
  season: number | null;
  episode: number | null;
  chapter: number | null;
  volume: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  contentHours: number | null;
  createdAt: Date;
  user: { id: string; email: string; username: string | null; tier: string };
};

function hasReviewContent(grade: number | null, review: string | null | undefined): boolean {
  return grade != null || (review != null && review.trim().length > 0);
}

const gradedLogOrReviewWhere = {
  OR: [{ grade: { not: null } }, { review: { not: null } }],
};

export function logRowToItemReview(
  l: LogWithUser,
  extras: {
    reviewerBadges: { label: string; icon: string; level: number }[];
    reviewerReviewsInCategory: number;
    likesCount: number;
    dislikesCount: number;
    userReaction: "like" | "dislike" | null;
    reviewScope?: "show" | "season" | "episode";
  }
) {
  const last = extras.reviewerBadges.length > 0 ? extras.reviewerBadges[extras.reviewerBadges.length - 1]! : null;
  return {
    id: l.id,
    userId: l.userId,
    reactionLogId: l.id,
    reviewScope: extras.reviewScope ?? "show",
    userEmail: l.user.email,
    reviewerUsername: l.user.username ?? null,
    isPro: tierHasProFeatures(l.user.tier),
    isAdmin: l.user.tier === "admin",
    reviewerBadges: last ? [last] : [],
    reviewerLevel: last?.level ?? undefined,
    reviewerLevelLabel: last?.label,
    reviewerLevelIcon: last?.icon,
    reviewerReviewsInCategory: extras.reviewerReviewsInCategory,
    grade: l.grade,
    review: l.review != null ? decodeHtmlEntities(l.review) : null,
    listType: l.listType,
    status: l.status,
    season: l.season,
    episode: l.episode,
    chapter: l.chapter,
    volume: l.volume,
    startedAt: l.startedAt?.toISOString() ?? null,
    completedAt: l.completedAt?.toISOString() ?? null,
    contentHours: l.contentHours,
    createdAt: l.createdAt.toISOString(),
    likesCount: extras.likesCount,
    dislikesCount: extras.dislikesCount,
    userReaction: extras.userReaction,
  };
}

export async function fetchGradedReviewsForItem(
  prisma: PrismaClient,
  mediaType: MediaType,
  externalId: string,
  logs: LogWithUser[],
  reactionMap: Map<string, { likesCount: number; dislikesCount: number; userReaction: "like" | "dislike" | null }>,
  reviewerBadgesMap: Map<string, { badges: { label: string; icon: string; level: number }[]; count: number }>
) {
  const fromLogs = logs.filter((l) => hasReviewContent(l.grade, l.review)).map((l) => {
    const stats = reactionMap.get(l.id);
    const { badges, count } = reviewerBadgesMap.get(l.userId) ?? { badges: [], count: 0 };
    return logRowToItemReview(l, {
      reviewerBadges: badges,
      reviewerReviewsInCategory: count,
      likesCount: stats?.likesCount ?? 0,
      dislikesCount: stats?.dislikesCount ?? 0,
      userReaction: stats?.userReaction ?? null,
      reviewScope: "show",
    });
  });

  if (mediaType !== "tv" && mediaType !== "anime") {
    return fromLogs;
  }

  const scopedRows = await prisma.scopedReview.findMany({
    where: {
      log: { mediaType, externalId },
      ...gradedLogOrReviewWhere,
    },
    include: {
      log: {
        include: { user: { select: { id: true, email: true, username: true, tier: true } } },
      },
    },
  });

  const scopedAsReviews = scopedRows.flatMap((sr) => {
    const l = sr.log;
    const serialized = serializeScopedReview(sr);
    if (!hasReviewContent(serialized.grade, serialized.review)) return [];
    const scope = reviewScopeFromParts(sr.scope, null, null);
    const stats = reactionMap.get(l.id);
    const { badges, count } = reviewerBadgesMap.get(l.userId) ?? { badges: [], count: 0 };
    const last = badges.length > 0 ? badges[badges.length - 1]! : null;
    return [
      {
        id: `scoped-${sr.id}`,
        userId: l.userId,
        reactionLogId: l.id,
        reviewScope: scope,
        userEmail: l.user.email,
        reviewerUsername: l.user.username ?? null,
        isPro: tierHasProFeatures(l.user.tier),
        isAdmin: l.user.tier === "admin",
        reviewerBadges: last ? [last] : [],
        reviewerLevel: last?.level ?? undefined,
        reviewerLevelLabel: last?.label,
        reviewerLevelIcon: last?.icon,
        reviewerReviewsInCategory: count,
        grade: serialized.grade,
        review: serialized.review,
        listType: l.listType,
        status: l.status,
        season: serialized.season,
        episode: serialized.episode,
        chapter: l.chapter,
        volume: l.volume,
        startedAt: l.startedAt?.toISOString() ?? null,
        completedAt: l.completedAt?.toISOString() ?? null,
        contentHours: l.contentHours,
        createdAt: serialized.createdAt,
        likesCount: stats?.likesCount ?? 0,
        dislikesCount: stats?.dislikesCount ?? 0,
        userReaction: stats?.userReaction ?? null,
      },
    ];
  });

  return [...fromLogs, ...scopedAsReviews];
}

type ItemReviewRow = ReturnType<typeof logRowToItemReview>;

function sortReviewGroupsByPrimary(
  groups: { userId: string; reviews: ItemReviewRow[]; primary: ItemReviewRow }[],
  sort: "recent" | "oldest" | "likes" | "dislikes"
) {
  const copy = [...groups];
  if (sort === "oldest") {
    copy.sort(
      (a, b) => new Date(a.primary.createdAt).getTime() - new Date(b.primary.createdAt).getTime()
    );
  } else if (sort === "likes") {
    copy.sort((a, b) => (b.primary.likesCount ?? 0) - (a.primary.likesCount ?? 0));
  } else if (sort === "dislikes") {
    copy.sort((a, b) => (b.primary.dislikesCount ?? 0) - (a.primary.dislikesCount ?? 0));
  } else {
    copy.sort(
      (a, b) => new Date(b.primary.createdAt).getTime() - new Date(a.primary.createdAt).getTime()
    );
  }
  return copy;
}

function paginateReviewsByUser(
  reviews: ItemReviewRow[],
  sort: "recent" | "oldest" | "likes" | "dislikes",
  skip: number,
  take: number
): { pageReviews: ItemReviewRow[]; reviewsTotal: number } {
  const byUser = groupItemReviewsByUser(reviews);
  const groups = [...byUser.entries()]
    .map(([userId, list]) => {
      const primary = pickPrimaryScopedReview(list);
      if (!primary) return null;
      return { userId, reviews: list, primary };
    })
    .filter((g): g is { userId: string; reviews: ItemReviewRow[]; primary: ItemReviewRow } => g != null);

  const sortedGroups = sortReviewGroupsByPrimary(groups, sort);
  const pageGroups = sortedGroups.slice(skip, skip + take);
  return {
    pageReviews: pageGroups.flatMap((g) => g.reviews),
    reviewsTotal: sortedGroups.length,
  };
}

export async function loadItemReviewsPaginated(
  prisma: PrismaClient,
  mediaType: MediaType,
  externalId: string,
  opts: {
    sort: "recent" | "oldest" | "likes" | "dislikes";
    skip: number;
    take: number;
    currentUserId: string | null;
  }
) {
  const logs = (
    await prisma.log.findMany({
      where: { mediaType, externalId, ...gradedLogOrReviewWhere },
      include: { user: { select: { id: true, email: true, username: true, tier: true } } },
    })
  ).filter((l) => hasReviewContent(l.grade, l.review));

  const logIds = logs.map((l) => l.id);
  const userIds = [...new Set(logs.map((l) => l.userId))];

  const scopedRows =
    mediaType === "tv" || mediaType === "anime"
      ? await prisma.scopedReview.findMany({
          where: { log: { mediaType, externalId }, ...gradedLogOrReviewWhere },
          include: {
            log: {
              include: { user: { select: { id: true, email: true, username: true, tier: true } } },
            },
          },
        })
      : [];

  for (const sr of scopedRows) {
    if (!userIds.includes(sr.log.userId)) userIds.push(sr.log.userId);
  }

  const allLogIdsForReactions = [...new Set([...logIds, ...scopedRows.map((s) => s.logId)])];
  const [reactionMap, reviewerBadgesMap] = await Promise.all([
    getReactionsForLogs(allLogIdsForReactions, opts.currentUserId),
    getAllReviewerMilestonesForMediumBatch(userIds, mediaType),
  ]);

  const merged = await fetchGradedReviewsForItem(
    prisma,
    mediaType,
    externalId,
    logs as LogWithUser[],
    reactionMap,
    reviewerBadgesMap
  );

  const { pageReviews, reviewsTotal } = paginateReviewsByUser(
    merged,
    opts.sort,
    opts.skip,
    opts.take
  );

  const allGrades = merged.map((r) => r.grade).filter((g): g is number => g != null);
  const meanGrade =
    allGrades.length > 0 ? allGrades.reduce((a, b) => a + b, 0) / allGrades.length : null;

  return { reviews: pageReviews, reviewsTotal, meanGrade };
}

// fix LogWithUser - logs from prisma have userId on log not user.id
