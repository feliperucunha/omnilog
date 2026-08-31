export type StatsPeriodGranularity = "month" | "year";

/**
 * Inclusive instant bounds for a stats period key (`YYYY-MM` or `YYYY`)
 * in the user's timezone (`timezoneOffsetMinutes` from the client).
 */
export function completedAtBoundsForStatsPeriod(
  period: string,
  granularity: StatsPeriodGranularity,
  tzOffsetMinutes = 0
): { gte: Date; lte: Date } | null {
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  if (granularity === "year") {
    const y = parseInt(period.trim(), 10);
    if (!Number.isFinite(y)) return null;
    return {
      gte: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0) - offsetMs),
      lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999) - offsetMs),
    };
  }
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) return null;
  const y = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  if (!Number.isFinite(y) || m < 1 || m > 12) return null;
  return {
    gte: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0) - offsetMs),
    lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999) - offsetMs),
  };
}

/**
 * Inclusive bounds for the last N calendar months in the user's timezone,
 * oldest -> newest. Each entry: { key: "YYYY-MM", gte, lte }.
 */
export function recentMonthRanges(
  tzOffsetMinutes: number,
  count = 13
): Array<{ key: string; gte: Date; lte: Date }> {
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  const shifted = new Date(new Date().getTime() + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1;
  const out: Array<{ key: string; gte: Date; lte: Date }> = [];
  for (let i = count - 1; i >= 0; i--) {
    let py = y;
    let pm = m - i;
    while (pm <= 0) {
      pm += 12;
      py -= 1;
    }
    const gte = new Date(Date.UTC(py, pm - 1, 1, 0, 0, 0, 0) - offsetMs);
    const lte = new Date(Date.UTC(py, pm, 0, 23, 59, 59, 999) - offsetMs);
    out.push({ key: `${py}-${String(pm).padStart(2, "0")}`, gte, lte });
  }
  return out;
}
