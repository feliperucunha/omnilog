import type { Prisma } from "@prisma/client";
import { purchaseLogCreatedAtRange } from "./purchaseFields.js";

/**
 * Logs that count toward "this calendar month" stats for free-tier users
 * (same month window as purchase "This month", in the user's timezone offset).
 */
export function freeTierStatisticsMonthWhere(tzOffsetMinutes: number): Prisma.LogWhereInput {
  const range = purchaseLogCreatedAtRange("month", tzOffsetMinutes);
  if (!range) {
    return { id: { in: [] } };
  }
  return {
    OR: [
      { createdAt: { gte: range.gte, lte: range.lte } },
      { completedAt: { gte: range.gte, lte: range.lte } },
      { updatedAt: { gte: range.gte, lte: range.lte } },
    ],
  };
}

export function freeTierStatisticsMonthRange(
  tzOffsetMinutes: number
): { gte: Date; lte: Date } | undefined {
  return purchaseLogCreatedAtRange("month", tzOffsetMinutes);
}

export type StatsPeriodGranularity = "month" | "year";

/** UTC month/year bounds matching GET /logs/stats completedByMonth / completedByYear keys. */
export function completedAtBoundsForStatsPeriod(
  period: string,
  granularity: StatsPeriodGranularity
): { gte: Date; lte: Date } | null {
  if (granularity === "year") {
    const y = parseInt(period.trim(), 10);
    if (!Number.isFinite(y)) return null;
    return {
      gte: new Date(Date.UTC(y, 0, 1)),
      lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
    };
  }
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) return null;
  const y = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  if (!Number.isFinite(y) || m < 1 || m > 12) return null;
  return {
    gte: new Date(Date.UTC(y, m - 1, 1)),
    lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
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
