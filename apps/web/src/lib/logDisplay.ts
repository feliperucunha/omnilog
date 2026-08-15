import type { LogDisplayRating } from "@geeklogs/shared";
import { getLogDisplayRating } from "@geeklogs/shared";
import type { Log } from "@geeklogs/shared";

export { getLogDisplayRating };
export type { LogDisplayRating };

export function formatLogScopeLabel(
  t: (key: string, vars?: Record<string, string>) => string,
  display: LogDisplayRating
): string | null {
  if (display.scope === "season") {
    return t("tvReviews.scopeSeason", { n: String(display.season ?? "?") });
  }
  if (display.scope === "episode") {
    return t("tvReviews.scopeEpisode", {
      season: String(display.season ?? "?"),
      episode: String(display.episode ?? "?"),
    });
  }
  return null;
}

export function getLogCardDisplay(
  log: Pick<Log, "grade" | "mediaType"> & {
    review?: string | null;
    scopedReviews?: Log["scopedReviews"];
  }
) {
  return getLogDisplayRating(
    { grade: log.grade ?? null, review: log.review ?? null, mediaType: log.mediaType },
    log.scopedReviews
  );
}
