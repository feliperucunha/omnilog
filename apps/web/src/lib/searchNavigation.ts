import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { MEDIA_TYPES, type MediaType } from "@geeklogs/shared";
import { itemDetailPath } from "@/lib/itemRoutes";

export const SEARCH_USERS_TYPE = "users" as const;
export type SearchFilterParam = MediaType | typeof SEARCH_USERS_TYPE;

export interface SearchUrlState {
  query: string;
  searchFilter: SearchFilterParam;
  sortBy: string;
}

export function parseSearchTypeParam(
  searchParams: URLSearchParams,
  defaultFilter: MediaType
): SearchFilterParam {
  const typeParam = searchParams.get("type") ?? searchParams.get("category");
  if (typeParam === SEARCH_USERS_TYPE) return SEARCH_USERS_TYPE;
  if (typeParam && (MEDIA_TYPES as readonly string[]).includes(typeParam)) {
    return typeParam as MediaType;
  }
  return defaultFilter;
}

export function parseSearchUrl(
  searchParams: URLSearchParams,
  defaultFilter: MediaType
): SearchUrlState | null {
  const query = searchParams.get("q")?.trim() ?? "";
  if (!query) return null;

  const searchFilter = parseSearchTypeParam(searchParams, defaultFilter);
  const sortBy = searchParams.get("sort")?.trim() ?? "";
  return { query, searchFilter, sortBy };
}

export function buildSearchNavPath(type: MediaType): string {
  const params = new URLSearchParams();
  params.set("type", type);
  return `/?${params.toString()}`;
}

export function buildDashboardNavPath(category: MediaType): string {
  const params = new URLSearchParams();
  params.set("category", category);
  return `/dashboard?${params.toString()}`;
}

export function resolveSearchNavPath(pathname: string, search: string): string {
  if (!pathname.startsWith("/dashboard")) return "/";
  const category = new URLSearchParams(search).get("category");
  if (category && (MEDIA_TYPES as readonly string[]).includes(category)) {
    return buildSearchNavPath(category as MediaType);
  }
  return "/";
}

export function resolveDashboardNavPath(pathname: string, search: string): string {
  if (pathname !== "/" && pathname !== "/search") return "/dashboard";
  const typeParam = new URLSearchParams(search).get("type") ?? new URLSearchParams(search).get("category");
  if (typeParam === SEARCH_USERS_TYPE) return "/dashboard";
  if (typeParam && (MEDIA_TYPES as readonly string[]).includes(typeParam)) {
    return buildDashboardNavPath(typeParam as MediaType);
  }
  return "/dashboard";
}

export function buildSearchCategoryLocation(
  pathname: string,
  currentSearch: string,
  searchFilter: SearchFilterParam
): { pathname: string; search: string } {
  const params = new URLSearchParams(currentSearch);
  const q = params.get("q")?.trim() ?? "";
  params.set("type", searchFilter);
  if (!q) {
    params.delete("q");
    params.delete("sort");
  }
  const qs = params.toString();
  return { pathname, search: qs ? `?${qs}` : "" };
}

export function useSearchNavPath(): string {
  const { pathname, search } = useLocation();
  return useMemo(() => resolveSearchNavPath(pathname, search), [pathname, search]);
}

export function useDashboardNavPath(): string {
  const { pathname, search } = useLocation();
  return useMemo(() => resolveDashboardNavPath(pathname, search), [pathname, search]);
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
