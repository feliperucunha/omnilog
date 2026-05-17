import type { PrismaClient } from "@prisma/client";
import { serializeScopedReview } from "./scopedReview.js";

type LogRow = { id: string; mediaType: string };

export async function attachScopedReviewsToLogs<T extends LogRow>(
  prisma: PrismaClient,
  logs: T[]
): Promise<(T & { scopedReviews?: ReturnType<typeof serializeScopedReview>[] })[]> {
  const tvAnimeIds = logs
    .filter((l) => l.mediaType === "tv" || l.mediaType === "anime")
    .map((l) => l.id);
  if (tvAnimeIds.length === 0) return logs;

  const rows = await prisma.scopedReview.findMany({
    where: { logId: { in: tvAnimeIds } },
    orderBy: [{ updatedAt: "desc" }],
  });

  const byLogId = new Map<string, ReturnType<typeof serializeScopedReview>[]>();
  for (const row of rows) {
    const list = byLogId.get(row.logId) ?? [];
    list.push(serializeScopedReview(row));
    byLogId.set(row.logId, list);
  }

  return logs.map((log) => {
    if (log.mediaType !== "tv" && log.mediaType !== "anime") return log;
    const scopedReviews = byLogId.get(log.id);
    if (!scopedReviews?.length) return log;
    return { ...log, scopedReviews };
  });
}

export async function enrichLogsForClient(
  prisma: PrismaClient,
  logs: Array<{ mediaType: string; externalId: string } & Record<string, unknown>>
) {
  const { attachItemEnrichment } = await import("./itemDetailEnrichment.js");
  const enriched = await attachItemEnrichment(
    prisma,
    logs as Parameters<typeof attachItemEnrichment>[1]
  );
  const withScoped = await attachScopedReviewsToLogs(
    prisma,
    enriched as unknown as LogRow[]
  );
  return withScoped as unknown as typeof enriched;
}
