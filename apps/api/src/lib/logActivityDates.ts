import type { Prisma } from "@prisma/client";
import {
  COMPLETED_STATUSES,
  FINISHED_STATUSES,
  IN_PROGRESS_STATUSES,
  statusSetsCompletedAt,
  statusSetsStartedAt,
} from "@geeklogs/shared";

export const COMPLETED_STATUS_LIST = [...COMPLETED_STATUSES] as string[];
export const FINISHED_STATUS_LIST = [...FINISHED_STATUSES] as string[];
export const IN_PROGRESS_STATUS_LIST = [...IN_PROGRESS_STATUSES] as string[];

export type LogActivityRow = {
  status: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
};

/** Subset used by effectiveCompletedAt (startedAt not required). */
export type LogCompletedActivityRow = Pick<LogActivityRow, "status" | "completedAt" | "updatedAt">;

/** Best date to attribute "started" activity when startedAt was never stored. */
export function effectiveStartedAt(log: LogActivityRow): Date | null {
  if (log.startedAt) return log.startedAt;
  if (log.status != null && statusSetsStartedAt(log.status)) return log.updatedAt;
  return null;
}

/** Best date to attribute "finished" activity when completedAt was never stored. */
export function effectiveCompletedAt(log: LogCompletedActivityRow): Date | null {
  if (log.status != null && COMPLETED_STATUS_LIST.includes(log.status)) {
    if (log.completedAt != null && log.completedAt.getTime() > log.updatedAt.getTime()) {
      return log.completedAt;
    }
    return log.updatedAt;
  }
  if (log.completedAt) return log.completedAt;
  if (log.status != null && statusSetsCompletedAt(log.status)) return log.updatedAt;
  return null;
}

/** Logs that count as completed in statistics (read/watched/completed/played). */
export function completedLogWhere(range?: { gte: Date; lte: Date }): Prisma.LogWhereInput {
  if (!range) {
    return {
      OR: [{ status: { in: COMPLETED_STATUS_LIST } }, { completedAt: { not: null } }],
    };
  }
  return {
    OR: [
      { completedAt: { gte: range.gte, lte: range.lte } },
      {
        AND: [
          { status: { in: COMPLETED_STATUS_LIST } },
          { updatedAt: { gte: range.gte, lte: range.lte } },
        ],
      },
    ],
  };
}

/** Logs that finished or were dropped in range (calendar / activity, includes dropped). */
export function completedActivityWhere(
  range?: { gte: Date; lte: Date }
): Prisma.LogWhereInput {
  if (!range) {
    return {
      OR: [{ completedAt: { not: null } }, { status: { in: FINISHED_STATUS_LIST } }],
    };
  }
  return {
    OR: [
      { completedAt: { gte: range.gte, lte: range.lte } },
      {
        AND: [
          { status: { in: FINISHED_STATUS_LIST } },
          { updatedAt: { gte: range.gte, lte: range.lte } },
        ],
      },
    ],
  };
}

/** Logs that started (in-progress status) in range, including rows missing startedAt. */
export function startedActivityWhere(range: { gte: Date; lte: Date }): Prisma.LogWhereInput {
  return {
    OR: [
      { startedAt: { gte: range.gte, lte: range.lte } },
      {
        AND: [
          { startedAt: null },
          { status: { in: IN_PROGRESS_STATUS_LIST } },
          { updatedAt: { gte: range.gte, lte: range.lte } },
        ],
      },
    ],
  };
}

/** Calendar / by-date: started or finished activity on days in range. */
export function activityInRangeWhere(range: { gte: Date; lte: Date }): Prisma.LogWhereInput {
  return {
    OR: [startedActivityWhere(range), completedActivityWhere(range)],
  };
}
