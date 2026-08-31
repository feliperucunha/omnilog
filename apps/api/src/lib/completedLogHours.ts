/**
 * Hours attributed to a completed log for Statistics (overview, pace, public profile).
 * Calendar span (startedAt → completedAt) is not used: that is elapsed dates, not time spent.
 *
 * Per category:
 * - movies / tv / anime: stored runtime (`contentHours`)
 * - games: HowLongToBeat / user hours-to-beat, else `contentHours`
 * - boardgames: summed session duration, else 1h per match
 * - books / manga / comics: `contentHours`, else pages at READING_PAGES_PER_HOUR
 */

import { COMPLETED_STATUSES, statusSetsCompletedAt } from "@geeklogs/shared";

/** Rough reading pace for books/manga/comics when no runtime is stored. */
export const READING_PAGES_PER_HOUR = 30;

const READING_MEDIA_TYPES = new Set(["books", "manga", "comics"]);
const SCREEN_MEDIA_TYPES = new Set(["movies", "tv", "anime"]);

export type CompletedLogForHours = {
  completedAt: Date | null;
  contentHours: number | null;
  startedAt: Date | null;
  mediaType: string;
  hoursToBeat: number | null;
  matchesPlayed: number | null;
  /** Sum of BoardGameMatch.durationHours when preloaded for stats. */
  boardGameSessionHours?: number | null;
  pagesRead?: number | null;
  updatedAt?: Date | null;
  status?: string | null;
};

function resolveCompletedAt(log: CompletedLogForHours): Date | null {
  if (log.status != null && (COMPLETED_STATUSES as readonly string[]).includes(log.status)) {
    if (log.completedAt != null && log.updatedAt != null && log.completedAt.getTime() > log.updatedAt.getTime()) {
      return log.completedAt;
    }
    if (log.updatedAt) return log.updatedAt;
  }
  if (log.completedAt) return log.completedAt;
  if (log.status != null && statusSetsCompletedAt(log.status) && log.updatedAt) {
    return log.updatedAt;
  }
  return null;
}

function positiveHours(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Hours attributed to a completed log. Returns null when this log should not
 * contribute any bucket (skip).
 */
export function hoursFromCompletedLogForStats(log: CompletedLogForHours): number | null {
  const completedAt = resolveCompletedAt(log);
  if (completedAt == null) return null;

  if (log.mediaType === "boardgames") {
    const session = positiveHours(log.boardGameSessionHours);
    if (session != null) return session;
    return (log.matchesPlayed ?? 0) * 1;
  }

  if (log.mediaType === "games") {
    return positiveHours(log.hoursToBeat) ?? positiveHours(log.contentHours);
  }

  if (SCREEN_MEDIA_TYPES.has(log.mediaType)) {
    return positiveHours(log.contentHours);
  }

  if (READING_MEDIA_TYPES.has(log.mediaType)) {
    const explicit = positiveHours(log.contentHours);
    if (explicit != null) return explicit;
    if (log.pagesRead != null && log.pagesRead > 0) {
      return Math.round((log.pagesRead / READING_PAGES_PER_HOUR) * 10) / 10;
    }
    return 0;
  }

  return positiveHours(log.contentHours);
}

export type SummaryHoursRollup = {
  /** Sum of attributed hours (includes 0 from e.g. boardgames with no matches). */
  totalHours: number;
  /** Completed logs that contributed a strictly positive hour value. */
  logsWithPositiveHours: number;
};

export function rollupHoursFromCompletedLogs(logs: CompletedLogForHours[]): SummaryHoursRollup {
  let total = 0;
  let logsWithPositiveHours = 0;
  for (const log of logs) {
    const h = hoursFromCompletedLogForStats(log);
    if (h === null) continue;
    total += h;
    if (h > 0) logsWithPositiveHours += 1;
  }
  return {
    totalHours: Math.round(total * 10) / 10,
    logsWithPositiveHours,
  };
}
