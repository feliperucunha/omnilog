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
