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
