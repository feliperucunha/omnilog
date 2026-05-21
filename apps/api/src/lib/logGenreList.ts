import type { Log as PrismaLog } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { parseGenresJson, serializeLog } from "./serializeLog.js";

export const LOG_GENRE_FILTER_MAX_LENGTH = 80;

export type LogListSortForGenre =
  | "dateAsc"
  | "dateDesc"
  | "gradeAsc"
  | "gradeDesc"
  | "matchesPlayedAsc"
  | "matchesPlayedDesc"
  | "timeToBeatAsc"
  | "timeToBeatDesc";

export interface SlimLogSortRow {
  id: string;
  genres: string | null;
  updatedAt: Date;
  matchesPlayed: number | null;
  hoursToBeat: number | null;
  grade: number | null;
}

/** Unique log count per genre name (same semantics as Statistics genre group). */
export function computeGenreFacets(rows: { id: string; genres: string | null }[]): Array<{ name: string; count: number }> {
  const byGenre: Record<string, Set<string>> = {};
  for (const row of rows) {
    const genres = parseGenresJson(row.genres);
    if (!genres) continue;
    for (const g of genres) {
      const name = g.trim();
      if (!name) continue;
      if (!byGenre[name]) byGenre[name] = new Set();
      byGenre[name].add(row.id);
    }
  }
  return Object.entries(byGenre)
    .map(([name, set]) => ({ name, count: set.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function logHasGenreExact(row: { genres: string | null }, genre: string): boolean {
  const parsed = parseGenresJson(row.genres);
  if (!parsed) return false;
  return parsed.some((g) => g.trim() === genre);
}

function cmpUpdated(a: SlimLogSortRow, b: SlimLogSortRow, dir: "asc" | "desc"): number {
  const ta = a.updatedAt.getTime();
  const tb = b.updatedAt.getTime();
  const t = dir === "desc" ? tb - ta : ta - tb;
  if (t !== 0) return t;
  return a.id.localeCompare(b.id);
}

function cmpGrade(
  a: SlimLogSortRow,
  b: SlimLogSortRow,
  dir: "asc" | "desc",
  then: (a: SlimLogSortRow, b: SlimLogSortRow) => number
): number {
  const ga = a.grade;
  const gb = b.grade;
  if (ga == null && gb == null) return then(a, b);
  if (ga == null) return 1;
  if (gb == null) return -1;
  if (dir === "desc") {
    if (gb !== ga) return gb - ga;
  } else {
    if (ga !== gb) return ga - gb;
  }
  return then(a, b);
}

/** Mirrors Prisma orderBy for GET /logs when filtering by genre in application memory. */
export function compareSlimLogsForSort(a: SlimLogSortRow, b: SlimLogSortRow, sort: LogListSortForGenre): number {
  switch (sort) {
    case "matchesPlayedDesc": {
      const va = a.matchesPlayed ?? -1;
      const vb = b.matchesPlayed ?? -1;
      if (vb !== va) return vb - va;
      return cmpUpdated(a, b, "desc");
    }
    case "matchesPlayedAsc": {
      const va = a.matchesPlayed ?? Number.POSITIVE_INFINITY;
      const vb = b.matchesPlayed ?? Number.POSITIVE_INFINITY;
      if (va !== vb) return va - vb;
      return cmpUpdated(a, b, "desc");
    }
    case "timeToBeatDesc": {
      const va = a.hoursToBeat ?? -1;
      const vb = b.hoursToBeat ?? -1;
      if (vb !== va) return vb - va;
      return cmpUpdated(a, b, "desc");
    }
    case "timeToBeatAsc": {
      const va = a.hoursToBeat ?? Number.POSITIVE_INFINITY;
      const vb = b.hoursToBeat ?? Number.POSITIVE_INFINITY;
      if (va !== vb) return va - vb;
      return cmpUpdated(a, b, "desc");
    }
    case "gradeDesc":
      return cmpGrade(a, b, "desc", (x, y) => cmpUpdated(x, y, "desc"));
    case "gradeAsc":
      return cmpGrade(a, b, "asc", (x, y) => cmpUpdated(x, y, "asc"));
    case "dateAsc":
      return cmpUpdated(a, b, "asc");
    case "dateDesc":
    default:
      return cmpUpdated(a, b, "desc");
  }
}

export function sortSlimLogsBySortParam(sl: SlimLogSortRow[], sort: string): SlimLogSortRow[] {
  const s = sort as LogListSortForGenre;
  return [...sl].sort((a, b) => compareSlimLogsForSort(a, b, s));
}

function extractEqString(field: unknown): string | undefined {
  if (typeof field === "string") return field;
  return undefined;
}

async function fetchSlimLogsMatchingGenre(
  prisma: PrismaClient,
  where: Prisma.LogWhereInput,
  genre: string
): Promise<SlimLogSortRow[]> {
  const userId = extractEqString(where.userId);
  const mediaType = extractEqString(where.mediaType);
  if (!userId || !mediaType) {
    const slim = await prisma.log.findMany({
      where,
      select: {
        id: true,
        genres: true,
        updatedAt: true,
        matchesPlayed: true,
        hoursToBeat: true,
        grade: true,
      },
    });
    return slim.filter((row) => logHasGenreExact(row, genre));
  }

  return prisma.$queryRaw<SlimLogSortRow[]>`
    SELECT l.id, l.genres, l."updatedAt", l."matchesPlayed", l."hoursToBeat", l.grade
    FROM "Log" l
    WHERE l."userId" = ${userId}
      AND l."mediaType" = ${mediaType}
      AND l.genres IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(l.genres::jsonb) AS elem(val)
        WHERE trim(elem.val) = ${genre}
      )
  `;
}

export async function fetchLogsWithGenreFilter(
  prisma: PrismaClient,
  opts: {
    where: Prisma.LogWhereInput;
    sort: string;
    genre: string;
    takeSize: number;
    cursorId: string | undefined;
    usePagination: boolean;
  }
): Promise<{ data: ReturnType<typeof serializeLog>[]; nextCursor: string | null } | ReturnType<typeof serializeLog>[]> {
  const { where, sort, genre, takeSize, cursorId, usePagination } = opts;
  const matched = await fetchSlimLogsMatchingGenre(prisma, where, genre);
  const sorted = sortSlimLogsBySortParam(matched, sort);

  const mapOrderedFull = async (pageSlim: SlimLogSortRow[]): Promise<PrismaLog[]> => {
    if (pageSlim.length === 0) return [];
    const full = await prisma.log.findMany({
      where: { id: { in: pageSlim.map((p) => p.id) } },
    });
    const byId = new Map(full.map((l) => [l.id, l]));
    return pageSlim.map((p) => byId.get(p.id)).filter((x): x is PrismaLog => x != null);
  };

  if (!usePagination) {
    const ordered = await mapOrderedFull(sorted);
    return ordered.map(serializeLog);
  }

  let start = 0;
  if (cursorId) {
    const idx = sorted.findIndex((s) => s.id === cursorId);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = sorted.slice(start, start + takeSize + 1);
  const hasMore = slice.length > takeSize;
  const pageSlim = hasMore ? slice.slice(0, takeSize) : slice;
  const orderedFull = await mapOrderedFull(pageSlim);
  const data = orderedFull.map(serializeLog);
  const nextCursor = hasMore && pageSlim.length > 0 ? pageSlim[pageSlim.length - 1]!.id : null;
  return { data, nextCursor };
}
