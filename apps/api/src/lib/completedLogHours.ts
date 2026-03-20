/**
 * Shared logic for attributing "content hours" to completed logs (Statistics /logs/stats).
 * Kept pure for unit tests and to match category/month/year aggregation.
 */

export const MS_PER_HOUR = 60 * 60 * 1000;
export const FALLBACK_MAX_HOURS = 24;

export type CompletedLogForHours = {
  completedAt: Date | null;
  contentHours: number | null;
  startedAt: Date | null;
  mediaType: string;
  hoursToBeat: number | null;
  matchesPlayed: number | null;
};

/**
 * Hours attributed to a completed log for stats charts (same rules as legacy /logs/stats loop).
 * Returns null when this log should not contribute any bucket (skip).
 */
export function hoursFromCompletedLogForStats(log: CompletedLogForHours): number | null {
  if (log.completedAt == null) return null;
  if (log.mediaType === "boardgames") {
    return (log.matchesPlayed ?? 0) * 1;
  }
  if (log.mediaType === "games" && log.hoursToBeat != null && log.hoursToBeat > 0) {
    return log.hoursToBeat;
  }
  if (log.contentHours != null && log.contentHours > 0) {
    return log.contentHours;
  }
  if (log.startedAt != null) {
    const elapsedMs = log.completedAt.getTime() - log.startedAt.getTime();
    const hours = Math.min(elapsedMs / MS_PER_HOUR, FALLBACK_MAX_HOURS);
    return hours > 0 ? hours : null;
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
