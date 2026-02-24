import type { SearchResult } from "@logeverything/shared";

/**
 * Sort search results in memory (for APIs that don't support sort: TMDB, Open Library, BGG, Comic Vine).
 * sort value: relevance (no-op), title_asc, title_desc, year_desc, year_asc.
 */
export function sortSearchResults(results: SearchResult[], sort: string | undefined): SearchResult[] {
  if (!sort || sort === "relevance") return results;
  const arr = [...results];
  const yearNum = (r: SearchResult) => {
    const y = r.year;
    if (y == null || y === "") return null;
    const n = parseInt(String(y), 10);
    return Number.isNaN(n) ? null : n;
  };
  switch (sort) {
    case "title_asc":
      return arr.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" }));
    case "title_desc":
      return arr.sort((a, b) => (b.title ?? "").localeCompare(a.title ?? "", undefined, { sensitivity: "base" }));
    case "year_desc": {
      return arr.sort((a, b) => {
        const ya = yearNum(a) ?? -Infinity;
        const yb = yearNum(b) ?? -Infinity;
        return yb - ya;
      });
    }
    case "year_asc": {
      return arr.sort((a, b) => {
        const ya = yearNum(a) ?? Infinity;
        const yb = yearNum(b) ?? Infinity;
        return ya - yb;
      });
    }
    default:
      return results;
  }
}
