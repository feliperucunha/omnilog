import type { ReviewScope } from "@geeklogs/shared";
import { reviewScopeFromParts, seasonEpisodeFromScoped } from "@geeklogs/shared";
import { decodeHtmlEntities } from "@geeklogs/shared";

export function serializeScopedReview(row: {
  id: string;
  logId: string;
  scope: string;
  seasonNum: number;
  episodeNum: number;
  grade: number | null;
  review: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const scope = reviewScopeFromParts(row.scope, null, null);
  const { season, episode } = seasonEpisodeFromScoped(scope, row.seasonNum, row.episodeNum);
  return {
    id: row.id,
    logId: row.logId,
    scope,
    season,
    episode,
    grade: row.grade,
    review: row.review != null ? decodeHtmlEntities(row.review) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function parseScopedScopeInput(
  scope: string,
  season: number | null | undefined,
  episode: number | null | undefined
): { ok: true; scope: ReviewScope; seasonNum: number; episodeNum: number } | { ok: false; error: string } {
  if (scope !== "show" && scope !== "season" && scope !== "episode") {
    return { ok: false, error: "Invalid scope" };
  }
  if (scope === "show") {
    return { ok: true, scope: "show", seasonNum: 0, episodeNum: 0 };
  }
  if (season == null || season < 1) {
    return { ok: false, error: "Season is required" };
  }
  if (scope === "season") {
    return { ok: true, scope: "season", seasonNum: season, episodeNum: 0 };
  }
  if (episode == null || episode < 1) {
    return { ok: false, error: "Episode is required" };
  }
  return { ok: true, scope: "episode", seasonNum: season, episodeNum: episode };
}
