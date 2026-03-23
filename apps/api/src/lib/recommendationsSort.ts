import type { SearchResult } from "@geeklogs/shared";

/**
 * Order recommendations by public score (highest first). Items without `score` sort after scored items;
 * tie-breaker: title for stable UX.
 */
export function sortRecommendationsByScoreDesc(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => {
    const sa = a.score != null && a.score > 0 ? a.score : -1;
    const sb = b.score != null && b.score > 0 ? b.score : -1;
    if (sb !== sa) return sb - sa;
    return (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" });
  });
}
