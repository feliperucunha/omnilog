import type { CompletedLogForHours } from "./completedLogHours.js";
import { prisma } from "./prisma.js";

export type LogWithIdForSessionHours = CompletedLogForHours & { id: string };

export async function boardGameSessionHoursByLogIds(logIds: string[]): Promise<Map<string, number>> {
  if (logIds.length === 0) return new Map();
  const rows = await prisma.boardGameMatch.groupBy({
    by: ["logId"],
    where: { logId: { in: logIds } },
    _sum: { durationHours: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.logId, row._sum.durationHours ?? 0);
  }
  return map;
}

export async function attachBoardGameSessionHours<T extends CompletedLogForHours & { id?: string }>(
  logs: T[]
): Promise<T[]> {
  const boardIds = logs
    .filter((log) => log.mediaType === "boardgames" && log.id)
    .map((log) => log.id as string);
  const byLog = await boardGameSessionHoursByLogIds(boardIds);
  return logs.map((log) => {
    if (log.mediaType !== "boardgames" || !log.id) return log;
    return { ...log, boardGameSessionHours: byLog.get(log.id) ?? 0 };
  });
}
