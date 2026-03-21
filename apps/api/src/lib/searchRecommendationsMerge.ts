import type { SearchResult } from "@geeklogs/shared";

/**
 * Merge TMDB/RAWG/Jikan recommendation lists with dedupe and exclude-already-logged ids.
 * Used by GET /search/recommendations; pure/async helpers are unit-tested.
 */

export async function collectFromSeeds(
  seeds: string[],
  fetchOne: (id: string) => Promise<SearchResult[]>,
  exclude: Set<string>,
  max: number
): Promise<SearchResult[]> {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const seed of seeds) {
    if (out.length >= max) break;
    const batch = await fetchOne(seed);
    for (const row of batch) {
      if (exclude.has(row.id) || seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export async function topUpFromPopular(
  current: SearchResult[],
  popularFetcher: () => Promise<SearchResult[]>,
  exclude: Set<string>,
  max: number
): Promise<SearchResult[]> {
  const seen = new Set(current.map((r) => r.id));
  const out = [...current];
  if (out.length >= max) return out.slice(0, max);
  const pop = await popularFetcher();
  for (const row of pop) {
    if (exclude.has(row.id) || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= max) break;
  }
  return out;
}
