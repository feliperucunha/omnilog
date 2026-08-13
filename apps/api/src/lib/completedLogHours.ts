/**
 * Shared logic for attributing "content hours" to completed logs (Statistics /logs/stats).
 * Kept pure for unit tests and to match category/month/year aggregation.
 */

import { COMPLETED_STATUSES, statusSetsCompletedAt, statusSetsStartedAt } from "@geeklogs/shared";

export const MS_PER_HOUR = 60 * 60 * 1000;
export const FALLBACK_MAX_HOURS = 24;
/** Rough reading pace for books/manga/comics when no dates or runtime are stored. */
export const READING_PAGES_PER_HOUR = 30;

const READING_MEDIA_TYPES = new Set(["books", "manga", "comics"]);

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

function resolveStartedAt(log: CompletedLogForHours): Date | null {
  if (log.startedAt) return log.startedAt;
  if (log.status != null && statusSetsStartedAt(log.status) && log.updatedAt) {
    return log.updatedAt;
  }
  return null;
}

/**
 * Hours attributed to a completed log for stats charts (same rules as legacy /logs/stats loop).
 * Returns null when this log should not contribute any bucket (skip).
 */
export function hoursFromCompletedLogForStats(log: CompletedLogForHours): number | null {
  const completedAt = resolveCompletedAt(log);
  if (completedAt == null) return null;
  const startedAt = resolveStartedAt(log);

  if (log.mediaType === "boardgames") {
    if (log.boardGameSessionHours != null) {
      return log.boardGameSessionHours > 0 ? log.boardGameSessionHours : 0;
    }
    return (log.matchesPlayed ?? 0) * 1;
  }
  if (log.mediaType === "games" && log.hoursToBeat != null && log.hoursToBeat > 0) {
    return log.hoursToBeat;
  }
  if (log.contentHours != null && log.contentHours > 0) {
    return log.contentHours;
  }
  if (startedAt != null) {
    const elapsedMs = completedAt.getTime() - startedAt.getTime();
    const hours = Math.min(elapsedMs / MS_PER_HOUR, FALLBACK_MAX_HOURS);
    if (hours > 0) return hours;
  }
  if (READING_MEDIA_TYPES.has(log.mediaType)) {
    if (log.pagesRead != null && log.pagesRead > 0) {
      return Math.round((log.pagesRead / READING_PAGES_PER_HOUR) * 10) / 10;
    }
    return 0;
  }
  return null;
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
