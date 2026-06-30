import type { MediaType, ScopedReview } from "@geeklogs/shared";
import { findEpisodePartialReview, findSeasonPartialReview, partialReviewKey } from "@geeklogs/shared";
import { apiFetch } from "@/lib/api";
import { gradeToStars, starsToGrade } from "@/lib/gradeStars";

export type PartialReviewTarget =
  | { scope: "season"; season: number }
  | { scope: "episode"; season: number; episode: number };

export type PartialReviewSaveKind = "season" | "episode";

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
  if (showSeasonField) {
    if (season === "") return null;
    if (episode !== "") {
      return { scope: "episode", season, episode };
    }
    return { scope: "season", season };
  }
  if (mediaType === "anime") {
    if (episode === "") return null;
    return { scope: "episode", season: 1, episode };
  }
  return null;
}

export function partialReviewSaveKind(
  mediaType: MediaType,
  season: number | "",
  episode: number | "",
  showSeasonField: boolean
): PartialReviewSaveKind | null {
  return resolvePartialReviewTarget(mediaType, season, episode, showSeasonField)?.scope ?? null;
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
      scope: target.scope,
      season: target.season,
      episode: target.scope === "episode" ? target.episode : null,
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
      scope: target.scope,
      season: target.season,
      episode: target.scope === "episode" ? target.episode : null,
      grade: null,
      review: null,
    }),
  });
}

export function listScopedPartialReviews(scopedReviews: ScopedReview[]): ScopedReview[] {
  return scopedReviews
    .filter((r) => r.scope === "episode" || r.scope === "season")
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
  if (review.scope === "season") {
    return t("tvReviews.scopeSeason", { n: String(review.season ?? "?") });
  }
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
  if (target.scope === "season") {
    return findSeasonPartialReview(scopedReviews, target.season);
  }
  return findEpisodePartialReview(scopedReviews, target.season, target.episode);
}

export function partialReviewRowKey(review: ScopedReview): string {
  if (review.scope === "season") {
    return `s:${review.season ?? 0}`;
  }
  return `ep:${review.season ?? 0}:${review.episode ?? 0}`;
}

export function deleteTargetFromScopedReview(review: ScopedReview): PartialReviewTarget {
  if (review.scope === "season") {
    return { scope: "season", season: review.season ?? 0 };
  }
  return {
    scope: "episode",
    season: review.season ?? 0,
    episode: review.episode ?? 0,
  };
}

export { partialReviewKey, findEpisodePartialReview, findSeasonPartialReview };
