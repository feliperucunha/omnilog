import type { ItemReview, ReviewScope } from "./types.js";

export type { ReviewScope };

export interface ScopedReview {
  id: string;
  logId: string;
  scope: ReviewScope;
  season: number | null;
  episode: number | null;
  grade: number | null;
  review: string | null;
  createdAt: string;
  updatedAt: string;
}

const SCOPE_RANK: Record<ReviewScope, number> = {
  show: 3,
  season: 2,
  episode: 1,
};

export function reviewScopeFromParts(
  scope: string,
  season: number | null,
  episode: number | null
): ReviewScope {
  if (scope === "season" || scope === "episode") return scope;
  if (episode != null && episode > 0) return "episode";
  if (season != null && season > 0) return "season";
  return "show";
}

export function seasonEpisodeFromScoped(scope: ReviewScope, seasonNum: number, episodeNum: number) {
  if (scope === "show") return { season: null, episode: null };
  if (scope === "season") return { season: seasonNum, episode: null };
  return { season: seasonNum, episode: episodeNum };
}

export function scopedKeysForScope(scope: ReviewScope, season: number | "", episode: number | "") {
  if (scope === "show") return { seasonNum: 0, episodeNum: 0 };
  const s = typeof season === "number" ? season : 0;
  if (scope === "season") return { seasonNum: s, episodeNum: 0 };
  const e = typeof episode === "number" ? episode : 0;
  return { seasonNum: s, episodeNum: e };
}

export function pickPrimaryScopedReview<T extends Pick<ItemReview, "reviewScope" | "season" | "episode" | "createdAt">>(
  reviews: T[]
): T | null {
  if (reviews.length === 0) return null;
  const byScope = (s: ReviewScope) =>
    reviews.filter((r) => (r.reviewScope ?? "show") === s);

  const showReviews = byScope("show");
  if (showReviews.length > 0) {
    return [...showReviews].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]!;
  }

  const seasonReviews = byScope("season");
  if (seasonReviews.length > 0) {
    return [...seasonReviews].sort((a, b) => (b.season ?? 0) - (a.season ?? 0))[0]!;
  }

  const episodeReviews = byScope("episode");
  if (episodeReviews.length > 0) {
    return [...episodeReviews].sort((a, b) => {
      const ds = (b.season ?? 0) - (a.season ?? 0);
      if (ds !== 0) return ds;
      return (b.episode ?? 0) - (a.episode ?? 0);
    })[0]!;
  }

  return reviews[0] ?? null;
}

export function groupItemReviewsByUser(reviews: ItemReview[]): Map<string, ItemReview[]> {
  const map = new Map<string, ItemReview[]>();
  for (const r of reviews) {
    const uid = r.userId ?? r.id;
    const list = map.get(uid) ?? [];
    list.push(r);
    map.set(uid, list);
  }
  return map;
}

export function compareScopeGenerality(a: ReviewScope, b: ReviewScope): number {
  return SCOPE_RANK[a] - SCOPE_RANK[b];
}

export function partialReviewKey(season: number, episode: number): string {
  return `${season}:${episode}`;
}

/** Episode-level partial review for the given season and episode numbers. */
export function findEpisodePartialReview(
  reviews: ScopedReview[],
  season: number,
  episode: number
): ScopedReview | undefined {
  return reviews.find(
    (r) =>
      r.scope === "episode" &&
      (r.season ?? 0) === season &&
      (r.episode ?? 0) === episode
  );
}

export function pickShowItemReview<T extends Pick<ItemReview, "reviewScope" | "createdAt">>(
  reviews: T[]
): T | null {
  const showReviews = reviews.filter((r) => (r.reviewScope ?? "show") === "show");
  if (showReviews.length === 0) return null;
  return [...showReviews].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]!;
}

export function partialItemReviews<T extends Pick<ItemReview, "reviewScope">>(reviews: T[]): T[] {
  return reviews.filter((r) => (r.reviewScope ?? "show") !== "show");
}
