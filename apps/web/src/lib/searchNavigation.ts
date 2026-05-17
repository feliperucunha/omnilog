import { MEDIA_TYPES, type MediaType } from "@geeklogs/shared";
import { itemDetailPath } from "@/lib/itemRoutes";

export const SEARCH_USERS_TYPE = "users" as const;
export type SearchFilterParam = MediaType | typeof SEARCH_USERS_TYPE;

export interface SearchUrlState {
  query: string;
  searchFilter: SearchFilterParam;
  sortBy: string;
}

export function parseSearchUrl(
  searchParams: URLSearchParams,
  defaultFilter: MediaType
): SearchUrlState | null {
  const query = searchParams.get("q")?.trim() ?? "";
  if (!query) return null;

  const typeParam = searchParams.get("type");
  let searchFilter: SearchFilterParam = defaultFilter;
  if (typeParam === SEARCH_USERS_TYPE) {
    searchFilter = SEARCH_USERS_TYPE;
  } else if (typeParam && (MEDIA_TYPES as readonly string[]).includes(typeParam)) {
    searchFilter = typeParam as MediaType;
  }

  const sortBy = searchParams.get("sort")?.trim() ?? "";
  return { query, searchFilter, sortBy };
}

export function buildSearchQueryString(state: SearchUrlState): string {
  const params = new URLSearchParams();
  params.set("q", state.query.trim());
  params.set("type", state.searchFilter);
  if (state.sortBy && state.sortBy !== "relevance") {
    params.set("sort", state.sortBy);
  }
  return params.toString();
}

export function buildSearchLocation(pathname: string, state: SearchUrlState): { pathname: string; search: string } {
  const qs = buildSearchQueryString(state);
  return { pathname, search: qs ? `?${qs}` : "" };
}

type NavigateFn = (
  to: string | { pathname: string; search?: string },
  options?: { replace?: boolean }
) => void;

export function openItemFromSearch(
  navigate: NavigateFn,
  pathname: string,
  searchState: SearchUrlState | null,
  mediaType: MediaType,
  externalId: string
): void {
  const itemPath = itemDetailPath(mediaType, externalId);
  if (searchState?.query.trim()) {
    const loc = buildSearchLocation(pathname, searchState);
    navigate({ pathname: loc.pathname, search: loc.search }, { replace: true });
    queueMicrotask(() => navigate(itemPath));
    return;
  }
  navigate(itemPath);
}
