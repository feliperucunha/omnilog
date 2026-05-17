import type { MediaType, SearchResult } from "@geeklogs/shared";
import type { SearchFilterParam, SearchUrlState } from "@/lib/searchNavigation";

export type SearchPageRecMeta = {
  requiresApiKey?: string;
  link?: string;
  tutorial?: string;
};

export type SearchPageUserResult = {
  id: string;
  username?: string;
  logCount?: number;
  following?: boolean;
};

export type SearchPageCacheSnapshot = {
  cacheKey: string;
  query: string;
  searchFilter: SearchFilterParam;
  sortBy: string;
  hasSearched: boolean;
  results: SearchResult[];
  userResults: SearchPageUserResult[];
  recByMediaType: Partial<Record<MediaType, SearchResult[]>>;
  recMetaByMediaType: Partial<Record<MediaType, SearchPageRecMeta>>;
  recommendationsSectionOpen: boolean;
};

let snapshot: SearchPageCacheSnapshot | null = null;

export function buildSearchCacheKey(pathname: string, state: SearchUrlState): string {
  const sort = state.sortBy && state.sortBy !== "relevance" ? state.sortBy : "";
  return `${pathname}|${state.query.trim()}|${state.searchFilter}|${sort}`;
}

export function getSearchPageCache(cacheKey: string): SearchPageCacheSnapshot | null {
  if (!snapshot || snapshot.cacheKey !== cacheKey) return null;
  return snapshot;
}

export function setSearchPageCache(next: SearchPageCacheSnapshot): void {
  snapshot = next;
}

export function clearSearchPageCache(): void {
  snapshot = null;
}
