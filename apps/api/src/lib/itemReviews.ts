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
  reviewerBadgesMap: Map<string, { badges: { label: string; icon: string; level: number }[]; count: number }>,
  userIds?: string[]
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
      log: {
        mediaType,
        externalId,
        ...(userIds?.length ? { userId: { in: userIds } } : {}),
      },
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

type ReviewerSortRow = {
  userId: string;
  primaryCreatedAt: string;
  primaryLikes: number;
  primaryDislikes: number;
};

function sortReviewerRows(rows: ReviewerSortRow[], sort: "recent" | "oldest" | "likes" | "dislikes") {
  const copy = [...rows];
  if (sort === "oldest") {
    copy.sort((a, b) => new Date(a.primaryCreatedAt).getTime() - new Date(b.primaryCreatedAt).getTime());
  } else if (sort === "likes") {
    copy.sort((a, b) => b.primaryLikes - a.primaryLikes || new Date(b.primaryCreatedAt).getTime() - new Date(a.primaryCreatedAt).getTime());
  } else if (sort === "dislikes") {
    copy.sort((a, b) => b.primaryDislikes - a.primaryDislikes || new Date(b.primaryCreatedAt).getTime() - new Date(a.primaryCreatedAt).getTime());
  } else {
    copy.sort((a, b) => new Date(b.primaryCreatedAt).getTime() - new Date(a.primaryCreatedAt).getTime());
  }
  return copy;
}

export async function buildReviewerSortRows(
  prisma: PrismaClient,
  mediaType: MediaType,
  externalId: string,
  sort: "recent" | "oldest" | "likes" | "dislikes"
): Promise<ReviewerSortRow[]> {
  const logs = await prisma.log.findMany({
    where: { mediaType, externalId, ...gradedLogOrReviewWhere },
    select: {
      id: true,
      userId: true,
      grade: true,
      review: true,
      createdAt: true,
    },
  });

  const logIds = logs.map((l) => l.id);
  const reactionMap =
    sort === "likes" || sort === "dislikes"
      ? await getReactionsForLogs(logIds, null)
      : new Map<string, { likesCount: number; dislikesCount: number; userReaction: null }>();

  const byUser = new Map<string, ReviewerSortRow>();
  for (const l of logs) {
    if (!hasReviewContent(l.grade, l.review)) continue;
    const stats = reactionMap.get(l.id);
    const createdAt = l.createdAt.toISOString();
    const existing = byUser.get(l.userId);
    if (!existing || new Date(createdAt) > new Date(existing.primaryCreatedAt)) {
      byUser.set(l.userId, {
        userId: l.userId,
        primaryCreatedAt: createdAt,
        primaryLikes: stats?.likesCount ?? 0,
        primaryDislikes: stats?.dislikesCount ?? 0,
      });
    }
  }

  if (mediaType === "tv" || mediaType === "anime") {
    const scopedRows = await prisma.scopedReview.findMany({
      where: { log: { mediaType, externalId }, ...gradedLogOrReviewWhere },
      select: {
        id: true,
        createdAt: true,
        grade: true,
        review: true,
        log: { select: { id: true, userId: true } },
      },
    });
    const scopedLogIds = [...new Set(scopedRows.map((s) => s.log.id))];
    const scopedReactions =
      sort === "likes" || sort === "dislikes"
        ? await getReactionsForLogs(scopedLogIds, null)
        : reactionMap;

    for (const sr of scopedRows) {
      if (!hasReviewContent(sr.grade, sr.review)) continue;
      const stats = scopedReactions.get(sr.log.id);
      const createdAt = sr.createdAt.toISOString();
      const existing = byUser.get(sr.log.userId);
      if (!existing || new Date(createdAt) > new Date(existing.primaryCreatedAt)) {
        byUser.set(sr.log.userId, {
          userId: sr.log.userId,
          primaryCreatedAt: createdAt,
          primaryLikes: stats?.likesCount ?? 0,
          primaryDislikes: stats?.dislikesCount ?? 0,
        });
      }
    }
  }

  return sortReviewerRows([...byUser.values()], sort);
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
  const reviewerRows = await buildReviewerSortRows(prisma, mediaType, externalId, opts.sort);
  const reviewsTotal = reviewerRows.length;
  const pageUserIds = reviewerRows.slice(opts.skip, opts.skip + opts.take).map((r) => r.userId);

  if (pageUserIds.length === 0) {
    const meanAgg = await prisma.log.aggregate({
      where: { mediaType, externalId, grade: { not: null } },
      _avg: { grade: true },
    });
    return { reviews: [], reviewsTotal: 0, meanGrade: meanAgg._avg.grade };
  }

  const logs = await prisma.log.findMany({
    where: {
      mediaType,
      externalId,
      userId: { in: pageUserIds },
      ...gradedLogOrReviewWhere,
    },
    include: { user: { select: { id: true, email: true, username: true, tier: true } } },
  });

  const logIds = logs.map((l) => l.id);
  const scopedRows =
    mediaType === "tv" || mediaType === "anime"
      ? await prisma.scopedReview.findMany({
          where: {
            log: { mediaType, externalId, userId: { in: pageUserIds } },
            ...gradedLogOrReviewWhere,
          },
          include: {
            log: {
              include: { user: { select: { id: true, email: true, username: true, tier: true } } },
            },
          },
        })
      : [];

  const allLogIdsForReactions = [...new Set([...logIds, ...scopedRows.map((s) => s.logId)])];
  const userIds = [...new Set([...pageUserIds])];

  const [reactionMap, reviewerBadgesMap, meanAgg] = await Promise.all([
    getReactionsForLogs(allLogIdsForReactions, opts.currentUserId),
    getAllReviewerMilestonesForMediumBatch(userIds, mediaType),
    prisma.log.aggregate({
      where: { mediaType, externalId, grade: { not: null } },
      _avg: { grade: true },
    }),
  ]);

  const merged = await fetchGradedReviewsForItem(
    prisma,
    mediaType,
    externalId,
    logs as LogWithUser[],
    reactionMap,
    reviewerBadgesMap,
    pageUserIds
  );

  const pageUserSet = new Set(pageUserIds);
  const pageReviews = merged.filter(
    (r): r is ItemReviewRow => typeof r.userId === "string" && pageUserSet.has(r.userId)
  );

  const byUser = groupItemReviewsByUser(pageReviews);
  const ordered: ItemReviewRow[] = [];
  for (const userId of pageUserIds) {
    const list = byUser.get(userId);
    if (list?.length) ordered.push(...(list as ItemReviewRow[]));
  }

  const meanGrade = meanAgg._avg.grade;

  return { reviews: ordered, reviewsTotal, meanGrade };
}
