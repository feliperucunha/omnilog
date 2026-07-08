import type { PrismaClient } from "@prisma/client";
import type { MediaType } from "@geeklogs/shared";

export async function ensureBoardGameWeightsForSort(
  prisma: PrismaClient,
  userId: string,
  mediaType?: MediaType
): Promise<void> {
  if (mediaType != null && mediaType !== "boardgames") return;

  await prisma.$executeRaw`
    UPDATE "Log" l
    SET "averageWeight" = NULLIF(TRIM(l."affinityContext"::jsonb -> 'boardgames' ->> 'averageWeight'), '')::double precision
    WHERE l."userId" = ${userId}
      AND l."mediaType" = 'boardgames'
      AND l."averageWeight" IS NULL
      AND l."affinityContext" IS NOT NULL
      AND NULLIF(TRIM(l."affinityContext"::jsonb -> 'boardgames' ->> 'averageWeight'), '') IS NOT NULL
  `;

  await prisma.$executeRaw`
    UPDATE "Log" l
    SET "averageWeight" = c."averageWeight"
    FROM "ItemDetailCache" c
    WHERE l."userId" = ${userId}
      AND l."mediaType" = 'boardgames'
      AND l."averageWeight" IS NULL
      AND c."mediaType" = 'boardgames'
      AND c."externalId" = l."externalId"
      AND c."averageWeight" IS NOT NULL
      AND c."averageWeight" > 0
  `;
}

export function isBoardGameWeightSort(sort: string): boolean {
  return sort === "weightAsc" || sort === "weightDesc";
}

type WeightSortableLog = {
  id?: string;
  averageWeight?: number | null;
  updatedAt?: string | Date;
};

export function resortLogsByWeight<T extends WeightSortableLog>(logs: T[], sort: string): T[] {
  if (!isBoardGameWeightSort(sort)) return logs;
  const desc = sort === "weightDesc";
  return [...logs].sort((a, b) => {
    const wa = a.averageWeight;
    const wb = b.averageWeight;
    if (wa == null && wb == null) return cmpUpdatedAtDesc(a, b);
    if (wa == null) return 1;
    if (wb == null) return -1;
    if (desc) {
      if (wb !== wa) return wb - wa;
    } else if (wa !== wb) {
      return wa - wb;
    }
    return cmpUpdatedAtDesc(a, b);
  });
}

function cmpUpdatedAtDesc(a: WeightSortableLog, b: WeightSortableLog): number {
  const ta = toTime(a.updatedAt);
  const tb = toTime(b.updatedAt);
  if (tb !== ta) return tb - ta;
  return (a.id ?? "").localeCompare(b.id ?? "");
}

function toTime(value: string | Date | undefined): number {
  if (value == null) return 0;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
