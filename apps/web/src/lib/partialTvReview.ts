import type { MediaType, ScopedReview } from "@geeklogs/shared";
import { findEpisodePartialReview, partialReviewKey } from "@geeklogs/shared";
import { apiFetch } from "@/lib/api";
import { gradeToStars, starsToGrade } from "@/lib/gradeStars";

export type PartialReviewTarget = { season: number; episode: number };

export type ReviewDraft = { stars: number | null; review: string };

export function hasShowReview(log: { grade: number | null; review: string | null }): boolean {
  return log.grade != null || (log.review != null && log.review.trim() !== "");
}

export function showReviewDraftFromLog(log: {
  grade: number | null;
  review: string | null;
}): ReviewDraft {
  if (!hasShowReview(log)) {
    return { stars: null, review: "" };
  }
  return {
    stars: log.grade != null ? gradeToStars(log.grade) : null,
    review: log.review ?? "",
  };
}

export function reviewDraftForSeasonEpisodeChange(
  mediaType: MediaType,
  season: number | "",
  episode: number | "",
  showSeasonField: boolean,
  log: { grade: number | null; review: string | null } | null
): ReviewDraft {
  if (resolvePartialReviewTarget(mediaType, season, episode, showSeasonField)) {
    return { stars: null, review: "" };
  }
  return log ? showReviewDraftFromLog(log) : { stars: null, review: "" };
}

export function resolvePartialReviewTarget(
  mediaType: MediaType,
  season: number | "",
  episode: number | "",
  showSeasonField: boolean
): PartialReviewTarget | null {
  if (episode === "") return null;
  const ep = episode;
  if (showSeasonField) {
    if (season === "") return null;
    return { season, episode: ep };
  }
  if (mediaType === "anime") {
    return { season: 1, episode: ep };
  }
  return null;
}

export function canSavePartialReview(
  mediaType: MediaType,
  season: number | "",
  episode: number | "",
  showSeasonField: boolean
): boolean {
  return resolvePartialReviewTarget(mediaType, season, episode, showSeasonField) != null;
}

export async function savePartialScopedReview(
  logId: string,
  target: PartialReviewTarget,
  stars: number | null,
  review: string
): Promise<ScopedReview | null> {
  const grade = stars == null ? null : starsToGrade(stars);
  const res = await apiFetch<{ data: ScopedReview | null }>(`/logs/${logId}/scoped-reviews`, {
    method: "PUT",
    body: JSON.stringify({
      scope: "episode",
      season: target.season,
      episode: target.episode,
      grade,
      review: review.trim() || null,
    }),
  });
  return res.data;
}

export async function deletePartialScopedReview(
  logId: string,
  target: PartialReviewTarget
): Promise<void> {
  await apiFetch<{ data: ScopedReview | null }>(`/logs/${logId}/scoped-reviews`, {
    method: "PUT",
    body: JSON.stringify({
      scope: "episode",
      season: target.season,
      episode: target.episode,
      grade: null,
      review: null,
    }),
  });
}

export function listEpisodePartialReviews(scopedReviews: ScopedReview[]): ScopedReview[] {
  return scopedReviews
    .filter((r) => r.scope === "episode")
    .sort((a, b) => {
      const ds = (b.season ?? 0) - (a.season ?? 0);
      if (ds !== 0) return ds;
      return (b.episode ?? 0) - (a.episode ?? 0);
    });
}

export function partialReviewLabel(
  t: (key: string, vars?: Record<string, string>) => string,
  mediaType: MediaType,
  showSeasonField: boolean,
  review: ScopedReview
): string {
  if (!showSeasonField && mediaType === "anime") {
    return t("tvReviews.scopeEpisode", {
      season: "1",
      episode: String(review.episode ?? "?"),
    });
  }
  return t("tvReviews.scopeEpisode", {
    season: String(review.season ?? "?"),
    episode: String(review.episode ?? "?"),
  });
}

export function lookupPartialReview(
  scopedReviews: ScopedReview[],
  target: PartialReviewTarget
): ScopedReview | undefined {
  return findEpisodePartialReview(scopedReviews, target.season, target.episode);
}

export { partialReviewKey, findEpisodePartialReview };
