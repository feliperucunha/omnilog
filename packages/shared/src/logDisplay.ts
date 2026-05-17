import type { ReviewScope, ScopedReview } from "./scopedReview.js";
import { pickPrimaryScopedReview } from "./scopedReview.js";

export interface LogDisplayRating {
  grade: number | null;
  review: string | null;
  scope: ReviewScope;
  season: number | null;
  episode: number | null;
}

function scopedToPickable(sr: ScopedReview) {
  return {
    id: sr.id,
    reviewScope: sr.scope,
    season: sr.season,
    episode: sr.episode,
    createdAt: sr.createdAt,
  };
}

export function getLogDisplayRating(
  log: { grade: number | null; review: string | null; mediaType: string },
  scopedReviews?: ScopedReview[] | null
): LogDisplayRating {
  const hasShowRating =
    log.grade != null || (log.review != null && log.review.trim() !== "");
  if (hasShowRating) {
    return {
      grade: log.grade,
      review: log.review,
      scope: "show",
      season: null,
      episode: null,
    };
  }
  if (
    (log.mediaType === "tv" || log.mediaType === "anime") &&
    scopedReviews &&
    scopedReviews.length > 0
  ) {
    const primary = pickPrimaryScopedReview(scopedReviews.map(scopedToPickable));
    if (primary) {
      const full = scopedReviews.find((sr) => sr.id === primary.id);
      if (full) {
        return {
          grade: full.grade,
          review: full.review,
          scope: full.scope,
          season: full.season,
          episode: full.episode,
        };
      }
    }
  }
  return {
    grade: log.grade,
    review: log.review,
    scope: "show",
    season: null,
    episode: null,
  };
}
