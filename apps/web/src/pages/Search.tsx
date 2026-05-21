import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MEDIA_TYPES,
  SEARCH_SORT_OPTIONS,
  type Log,
  type MediaType,
  type SearchResult,
} from "@geeklogs/shared";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { apiFetch, apiFetchCached, invalidateApiCache, LOGS_INVALIDATED_EVENT } from "@/lib/api";
import { useAppPtrRefresh } from "@/hooks/useAppPtrRefresh";
import { SearchSkeleton } from "@/components/skeletons";
import { Logo } from "@/components/Logo";
import {
  buildSearchLocation,
  openItemFromSearch,
  parseSearchUrl,
  SEARCH_USERS_TYPE,
  type SearchFilterParam,
  type SearchUrlState,
} from "@/lib/searchNavigation";
import {
  buildSearchCacheKey,
  clearSearchPageCache,
  getSearchPageCache,
  setSearchPageCache,
  type SearchPageUserResult,
} from "@/lib/searchPageCache";
import { ItemImage } from "@/components/ItemImage";
import { GenreBadges } from "@/components/GenreBadges";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { formatTimeToBeatHours } from "@/lib/formatDuration";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import { skipApiKeyMissingUi } from "@/lib/featureFlags";
import type { BoardGameProvider } from "@geeklogs/shared";
import { Link } from "react-router-dom";
import { ChevronDown, Loader2, UserCheck } from "lucide-react";
import { Select } from "@/components/ui/select";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { getLogCardDisplay } from "@/lib/logDisplay";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";
import { SearchRecommendationsCarousel } from "@/components/SearchRecommendationsCarousel";
import { ApiKeyPrompt, type ApiKeyProvider } from "@/components/ApiKeyPrompt";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import * as storage from "@/lib/storage";
import { paperShadow } from "@/lib/paperShadow";
import { cn } from "@/lib/utils";
import { decodeSearchResultForDisplay } from "@/lib/decodeDisplayFields";
import { UnifiedSearchBar } from "@/components/UnifiedSearchBar";
import { OnboardingSpotlight } from "@/components/OnboardingSpotlight";
import { getFirstVisibleByIds, ONBOARDING_SPOTLIGHT_KEYS } from "@/lib/onboardingSpotlightStorage";
import {
  LOG_CARD_TITLE,
  SEARCH_RESULT_CARD_BODY,
  SEARCH_RESULT_CARD_IMAGE,
  SEARCH_RESULT_CARD_GRID,
  SEARCH_RESULT_CARD_SHELL,
} from "@/lib/logCardLayout";

const FREE_SEARCH_USAGE_STORAGE_KEY = "geeklogs_free_search_usage";

function getFreeSearchUsageKey(type: MediaType, boardProvider: BoardGameProvider): string {
  return type === "boardgames" ? `boardgames-${boardProvider}` : type;
}

function loadFreeSearchUsageFromStorage(
  getRaw: () => string | null
): Record<string, { used: number; limit: number }> {
  try {
    const raw = getRaw();
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, { used?: number; limit?: number }>;
    const out: Record<string, { used: number; limit: number }> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v.used === "number" && typeof v.limit === "number") out[k] = { used: v.used, limit: v.limit };
    }
    return out;
  } catch {
    return {};
  }
}


interface SearchResponse {
  results: SearchResult[];
  requiresApiKey?: string;
  link?: string;
  tutorial?: string;
  freeSearchUsed?: number;
  freeSearchLimit?: number;
  freeSearchLimitReached?: boolean;
}

interface RecommendationsResponse {
  results: SearchResult[];
  personalization?: "from_logs" | "popular" | "none";
  requiresApiKey?: string;
  link?: string;
  tutorial?: string;
}

type RecMeta = {
  requiresApiKey?: string;
  link?: string;
  tutorial?: string;
};

/** Media types supported by GET /search/recommendations (others skip the request). */
const RECOMMENDATION_MEDIA_TYPES: MediaType[] = [
  "movies",
  "tv",
  "games",
  "anime",
  "boardgames",
  "books",
  "manga",
];

type UserSearchResult = SearchPageUserResult;

export function Search() {
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [urlSearchParams] = useSearchParams();
  const { visibleTypes } = useVisibleMediaTypes();
  const { setPageTitle, setBelowNavbar } = usePageTitle() ?? {};
  useEffect(() => {
    setPageTitle?.(t("nav.search"));
    return () => {
      setPageTitle?.(null);
      setBelowNavbar?.(null);
    };
  }, [t, setPageTitle, setBelowNavbar]);

  const state = location.state as { mediaType?: MediaType; query?: string; sortBy?: string } | null;
  const effectiveVisibleTypes = visibleTypes.length > 0 ? visibleTypes : [...MEDIA_TYPES];
  const defaultType = (effectiveVisibleTypes[0] ?? "movies") as MediaType;
  const urlRestore = useMemo(
    () => parseSearchUrl(urlSearchParams, defaultType),
    [urlSearchParams, defaultType]
  );
  const pageCacheKey = useMemo(
    () => (urlRestore?.query.trim() ? buildSearchCacheKey(location.pathname, urlRestore) : null),
    [urlRestore, location.pathname]
  );
  const pageCache = useMemo(
    () => (pageCacheKey ? getSearchPageCache(pageCacheKey) : null),
    [pageCacheKey]
  );
  const stateMediaType = urlRestore?.searchFilter ?? state?.mediaType;
  const stateQuery = urlRestore?.query ?? state?.query ?? "";
  const [searchFilter, setSearchFilter] = useState<SearchFilterParam>(
    () => pageCache?.searchFilter ?? stateMediaType ?? defaultType
  );
  const mediaType = searchFilter === SEARCH_USERS_TYPE ? defaultType : searchFilter;
  const initialSortMediaType = (
    (pageCache?.searchFilter ?? stateMediaType) && (pageCache?.searchFilter ?? stateMediaType) !== SEARCH_USERS_TYPE
      ? (pageCache?.searchFilter ?? stateMediaType)
      : defaultType
  ) as MediaType;
  const defaultSort = SEARCH_SORT_OPTIONS[initialSortMediaType][0].value;
  const skipSortResetOnFilterChange = useRef(
    Boolean(pageCache || urlRestore?.sortBy || state?.sortBy)
  );
  const [sortBy, setSortBy] = useState<string>(
    () => pageCache?.sortBy || urlRestore?.sortBy || state?.sortBy || defaultSort
  );
  const [loadingFollowId, setLoadingFollowId] = useState<string | null>(null);
  const [query, setQuery] = useState(() => pageCache?.query ?? stateQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<SearchResult[]>(() => pageCache?.results ?? []);
  const [userResults, setUserResults] = useState<UserSearchResult[]>(() => pageCache?.userResults ?? []);
  const [loading, setLoading] = useState(false);
  const [limitReachedByCategory, setLimitReachedByCategory] = useState<Partial<Record<MediaType, boolean>>>({});
  const [usageByCategory, setUsageByCategory] = useState<Partial<Record<MediaType, { used: number; limit: number }>>>(() => {
    const stored = loadFreeSearchUsageFromStorage(() => storage.getItemSync(FREE_SEARCH_USAGE_STORAGE_KEY));
    const out: Partial<Record<MediaType, { used: number; limit: number }>> = {};
    for (const type of MEDIA_TYPES) {
      const key = getFreeSearchUsageKey(type as MediaType, type === "boardgames" ? "bgg" : "bgg");
      if (stored[key]) out[type as MediaType] = stored[key];
    }
    return out;
  });

  useEffect(() => {
    void storage.getItem(FREE_SEARCH_USAGE_STORAGE_KEY);
  }, []);
  const [logsByExternalId, setLogsByExternalId] = useState<Map<string, Log>>(new Map());
  const [recByMediaType, setRecByMediaType] = useState<Partial<Record<MediaType, SearchResult[]>>>(
    () => pageCache?.recByMediaType ?? {}
  );
  const [recMetaByMediaType, setRecMetaByMediaType] = useState<Partial<Record<MediaType, RecMeta>>>(
    () => pageCache?.recMetaByMediaType ?? {}
  );
  const [recLoadingByMediaType, setRecLoadingByMediaType] = useState<Partial<Record<MediaType, boolean>>>(
    () => {
      if (!pageCache?.recByMediaType) return {};
      const out: Partial<Record<MediaType, boolean>> = {};
      for (const type of Object.keys(pageCache.recByMediaType) as MediaType[]) {
        out[type] = false;
      }
      return out;
    }
  );
  const [recRefreshNonce, setRecRefreshNonce] = useState(0);
  const [recommendationsSectionOpen, setRecommendationsSectionOpen] = useState(
    () => pageCache?.recommendationsSectionOpen ?? false
  );
  /** Desktop: map vertical wheel to horizontal scroll (mobile uses native touch; unchanged). */
  const { token } = useAuth();
  const { me, loading: meLoading } = useMe();
  const boardGameProvider = me?.boardGameProvider ?? "bgg";
  const skipApiKeyReq = skipApiKeyMissingUi(me, { token: !!token, meLoading });
  const hasBoardGameKey = !!(me?.apiKeys?.bgg || me?.apiKeys?.ludopedia);
  const currentRecResults = recByMediaType[mediaType] ?? [];
  const currentRecMeta = recMetaByMediaType[mediaType];
  const currentRecRequiresApiKey = currentRecMeta?.requiresApiKey;
  const currentRecLoading = recLoadingByMediaType[mediaType] ?? false;

  useEffect(() => {
    if (stateMediaType) setSearchFilter(stateMediaType);
  }, [stateMediaType]);

  // When there's no nav state, keep the selected category in sync with the first option from settings order (e.g. after me/visibleTypes loads).
  useEffect(() => {
    if (stateMediaType != null) return;
    const first = (effectiveVisibleTypes[0] ?? "movies") as SearchFilterParam;
    setSearchFilter(first);
  }, [stateMediaType, effectiveVisibleTypes[0]]);

  useEffect(() => {
    if (
      searchFilter !== SEARCH_USERS_TYPE &&
      !effectiveVisibleTypes.includes(searchFilter)
    ) {
      setSearchFilter((effectiveVisibleTypes[0] ?? "movies") as MediaType);
    }
  }, [effectiveVisibleTypes, searchFilter]);

  useEffect(() => {
    if (skipSortResetOnFilterChange.current) {
      skipSortResetOnFilterChange.current = false;
      return;
    }
    if (searchFilter !== SEARCH_USERS_TYPE) {
      setSortBy(SEARCH_SORT_OPTIONS[searchFilter][0].value);
    }
  }, [searchFilter]);

  useEffect(() => {
    if (stateQuery) setQuery(stateQuery);
  }, [stateQuery]);

  useEffect(() => {
    const stored = loadFreeSearchUsageFromStorage(() => storage.getItemSync(FREE_SEARCH_USAGE_STORAGE_KEY));
    const boardProvider = me?.boardGameProvider ?? "bgg";
    setUsageByCategory((prev) => {
      const next = { ...prev };
      for (const type of MEDIA_TYPES) {
        const key = getFreeSearchUsageKey(type as MediaType, type === "boardgames" ? boardProvider : "bgg");
        if (stored[key]) next[type as MediaType] = stored[key];
      }
      return next;
    });
    setLimitReachedByCategory((prev) => {
      const next = { ...prev };
      for (const type of MEDIA_TYPES) {
        const key = getFreeSearchUsageKey(type as MediaType, type === "boardgames" ? boardProvider : "bgg");
        const u = stored[key];
        next[type as MediaType] = !!(u && u.used >= u.limit);
      }
      return next;
    });
  }, [me?.boardGameProvider]);

  const syncSearchToUrl = useCallback(
    (urlState: SearchUrlState) => {
      if (!urlState.query.trim()) return;
      navigate(buildSearchLocation(location.pathname, urlState), { replace: true });
    },
    [navigate, location.pathname]
  );

  const runSearch = useCallback(
    async (q: string, typeOverride?: SearchFilterParam, sortOverride?: string) => {
      if (!q.trim()) return;
      const filter = typeOverride ?? searchFilter;
      const sort = sortOverride ?? sortBy;
      if (filter === SEARCH_USERS_TYPE) {
        setLoading(true);
        setResults([]);
        setUserResults([]);
        try {
          const params = new URLSearchParams({ q: q.trim() });
          const data = await apiFetch<{ users: UserSearchResult[] }>(`/search/users?${params.toString()}`);
          setUserResults(data.users ?? []);
          syncSearchToUrl({ query: q.trim(), searchFilter: SEARCH_USERS_TYPE, sortBy: sort });
        } catch (err) {
          setUserResults([]);
          showErrorToast(t, "E016", { originalError: err });
        } finally {
          setLoading(false);
        }
        return;
      }
      const searchType = filter as MediaType;
      const boardProvider = me?.boardGameProvider ?? "bgg";
      const usageKey = getFreeSearchUsageKey(searchType, searchType === "boardgames" ? boardProvider : "bgg");
      const stored = loadFreeSearchUsageFromStorage(() => storage.getItemSync(FREE_SEARCH_USAGE_STORAGE_KEY));
      const clientUsed = stored[usageKey]?.used ?? 0;
      setLoading(true);
      setResults([]);
      setUserResults([]);
      try {
        const params = new URLSearchParams({ type: searchType, q: q.trim() });
        if (sort && sort !== "relevance") params.set("sort", sort);
        if (searchType === "boardgames" && boardProvider) params.set("boardGameProvider", boardProvider);
        const data = await apiFetch<SearchResponse>(`/search?${params.toString()}`, {
          headers: { "X-Free-Search-Used": String(clientUsed) },
        });
        const list = (data.results ?? []).map(decodeSearchResultForDisplay);
        setResults(list);
        if (data.freeSearchLimitReached) {
          setLimitReachedByCategory((prev) => ({ ...prev, [searchType]: true }));
        }
        if (data.freeSearchUsed != null && data.freeSearchLimit != null) {
          const usage = { used: data.freeSearchUsed, limit: data.freeSearchLimit };
          const prev = loadFreeSearchUsageFromStorage(() => storage.getItemSync(FREE_SEARCH_USAGE_STORAGE_KEY));
          void storage.setItem(FREE_SEARCH_USAGE_STORAGE_KEY, JSON.stringify({ ...prev, [usageKey]: usage }));
          setUsageByCategory((prev) => ({ ...prev, [searchType]: usage }));
        }
        syncSearchToUrl({ query: q.trim(), searchFilter: filter, sortBy: sort });
      } catch (err) {
        setResults([]);
        showErrorToast(t, "E016", { originalError: err });
      } finally {
        setLoading(false);
      }
    },
    [searchFilter, sortBy, t, token, me, syncSearchToUrl]
  );

  const hasRunInitialSearch = useRef(
    Boolean(pageCache?.hasSearched && pageCache.query.trim())
  );
  const [hasSearched, setHasSearched] = useState(
    () => pageCache?.hasSearched ?? !!stateQuery.trim()
  );

  const persistSearchCache = useCallback(() => {
    if (!hasSearched || !query.trim() || loading) return;
    const urlState: SearchUrlState = { query: query.trim(), searchFilter, sortBy };
    setSearchPageCache({
      cacheKey: buildSearchCacheKey(location.pathname, urlState),
      query: query.trim(),
      searchFilter,
      sortBy,
      hasSearched: true,
      results,
      userResults,
      recByMediaType,
      recMetaByMediaType,
      recommendationsSectionOpen,
    });
  }, [
    hasSearched,
    query,
    searchFilter,
    sortBy,
    location.pathname,
    results,
    userResults,
    recByMediaType,
    recMetaByMediaType,
    recommendationsSectionOpen,
    loading,
  ]);

  const openItemDetail = useCallback(
    (itemMediaType: MediaType, externalId: string) => {
      persistSearchCache();
      const searchState: SearchUrlState | null =
        hasSearched && query.trim()
          ? { query: query.trim(), searchFilter, sortBy }
          : null;
      openItemFromSearch(navigate, location.pathname, searchState, itemMediaType, externalId);
    },
    [navigate, location.pathname, hasSearched, query, searchFilter, sortBy, persistSearchCache]
  );

  useEffect(() => {
    persistSearchCache();
  }, [persistSearchCache]);
  useEffect(() => {
    if (stateQuery.trim() && !hasRunInitialSearch.current) {
      hasRunInitialSearch.current = true;
      runSearch(stateQuery);
      setHasSearched(true);
    }
  }, [stateQuery, runSearch]);

  const loadUserLogsForSearch = useCallback(() => {
    const needsLogsForSearchResults =
      hasSearched && searchFilter !== SEARCH_USERS_TYPE && results.length > 0;
    const needsLogsForRecommendations =
      searchFilter !== SEARCH_USERS_TYPE && currentRecResults.length > 0;
    if (!token || (!needsLogsForSearchResults && !needsLogsForRecommendations)) {
      setLogsByExternalId(new Map());
      return;
    }
    apiFetchCached<Log[]>(`/logs?mediaType=${mediaType}`, { ttlMs: 2 * 60 * 1000 })
      .then((logs) => {
        const map = new Map<string, Log>();
        for (const log of logs) map.set(log.externalId, log);
        setLogsByExternalId(map);
      })
      .catch(() => setLogsByExternalId(new Map()));
  }, [token, mediaType, hasSearched, results.length, currentRecResults.length, searchFilter]);

  useEffect(() => {
    loadUserLogsForSearch();
  }, [loadUserLogsForSearch]);

  useEffect(() => {
    const refetch = () => loadUserLogsForSearch();
    window.addEventListener(LOGS_INVALIDATED_EVENT, refetch);
    return () => window.removeEventListener(LOGS_INVALIDATED_EVENT, refetch);
  }, [loadUserLogsForSearch]);

  useEffect(() => {
    if (searchFilter === SEARCH_USERS_TYPE || !RECOMMENDATION_MEDIA_TYPES.includes(mediaType)) {
      return;
    }
    const type = mediaType;
    const hasCachedRec =
      (recByMediaType[type]?.length ?? 0) > 0 || recMetaByMediaType[type]?.requiresApiKey != null;
    if (recRefreshNonce === 0 && hasCachedRec) {
      return;
    }
    let cancelled = false;
    setRecLoadingByMediaType((prev) => ({ ...prev, [type]: true }));
    const params = new URLSearchParams({
      type,
      viewer: token ? "auth" : "guest",
    });
    if (type === "boardgames") {
      params.set("boardGameProvider", boardGameProvider);
    }
    apiFetchCached<RecommendationsResponse>(`/search/recommendations?${params.toString()}`, {
      ttlMs: 5 * 60 * 1000,
    })
      .then((data) => {
        if (cancelled) return;
        setRecByMediaType((prev) => ({
          ...prev,
          [type]: (data.results ?? []).map(decodeSearchResultForDisplay),
        }));
        setRecMetaByMediaType((prev) => ({
          ...prev,
          [type]: {
            requiresApiKey: data.requiresApiKey,
            link: data.link,
            tutorial: data.tutorial,
          },
        }));
      })
      .catch(() => {
        // Keep cached recommendations for this category on error.
      })
      .finally(() => {
        if (!cancelled) {
          setRecLoadingByMediaType((prev) => ({ ...prev, [type]: false }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType, searchFilter, token, recRefreshNonce, me, boardGameProvider, recByMediaType, recMetaByMediaType]);

  const handleSearch = async (e: React.FormEvent) => {
    setHasSearched(true);
    e.preventDefault();
    if (!query.trim()) return;
    await runSearch(query);
  };

  useAppPtrRefresh(() => {
    clearSearchPageCache();
    invalidateApiCache("/search");
    if (hasSearched && query.trim()) {
      void runSearch(query);
    } else {
      setRecByMediaType({});
      setRecMetaByMediaType({});
      setRecLoadingByMediaType({});
      setRecRefreshNonce((n) => n + 1);
    }
  });

  const handleFollowClick = useCallback(
    async (e: React.MouseEvent, targetUserId: string, currentlyFollowing: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      if (!token || loadingFollowId) return;
      setLoadingFollowId(targetUserId);
      try {
        if (currentlyFollowing) {
          await apiFetch(`/follows/${targetUserId}`, { method: "DELETE" });
          setUserResults((prev) =>
            prev.map((u) => (u.id === targetUserId ? { ...u, following: false } : u))
          );
        } else {
          await apiFetch("/follows", {
            method: "POST",
            body: JSON.stringify({ userId: targetUserId }),
          });
          setUserResults((prev) =>
            prev.map((u) => (u.id === targetUserId ? { ...u, following: true } : u))
          );
          toast.success(t("social.followSuccess"));
        }
      } catch (err) {
        showErrorToast(t, "E017", { originalError: err });
      } finally {
        setLoadingFollowId(null);
      }
    },
    [token, loadingFollowId, t]
  );

  const getSearchCategorySpotlightTarget = useCallback(
    () => getFirstVisibleByIds(["onboarding-search-category-wrap"]),
    []
  );

  useEffect(() => {
    setBelowNavbar?.(
      <div id="onboarding-search-category-wrap" className="w-full min-w-0">
      <StickyCategoryStrip
        items={[
          ...effectiveVisibleTypes.map((type) => {
            const typeProvider = getApiKeyProviderForMediaType(type, boardGameProvider);
            const hasKeyForType =
              skipApiKeyReq ||
              typeProvider == null ||
              (type === "boardgames"
                ? hasBoardGameKey
                : !!me?.apiKeys?.[typeProvider]);
            const categoryLimitReached = limitReachedByCategory[type];
            const isDisabled = !hasKeyForType && !!categoryLimitReached;
            return {
              value: type,
              label: t(`nav.${type}`),
              disabled: isDisabled,
              title: isDisabled
                ? t("search.categoryLimitReachedTooltip", {
                    type: t(`nav.${type}`),
                    used: String(usageByCategory[type]?.used ?? 10),
                    limit: String(usageByCategory[type]?.limit ?? 10),
                  })
                : undefined,
            };
          }),
          { value: SEARCH_USERS_TYPE, label: t("search.usersFilter") },
        ]}
        selectedValue={searchFilter}
        onSelect={(v) => {
          skipSortResetOnFilterChange.current = false;
          setSearchFilter(v as SearchFilterParam);
          if (query.trim()) runSearch(query, v as SearchFilterParam);
        }}
        showCount={false}
        mobileOnly={false}
        bare
        aria-label={t("dashboard.category")}
      />
      </div>
    );
    return () => setBelowNavbar?.(null);
  }, [
    effectiveVisibleTypes,
    searchFilter,
    query,
    boardGameProvider,
    me?.apiKeys,
    skipApiKeyReq,
    hasBoardGameKey,
    limitReachedByCategory,
    usageByCategory,
    t,
    setBelowNavbar,
    runSearch,
  ]);

  const showRecommendations =
    searchFilter !== SEARCH_USERS_TYPE && RECOMMENDATION_MEDIA_TYPES.includes(mediaType);

  const recommendationsSection = showRecommendations ? (
    <Card
      className="relative z-10 flex w-full min-w-0 shrink-0 flex-col border-[var(--color-surface-border)] bg-[var(--color-dark)] p-0"
      style={paperShadow}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-t-lg px-4 py-3 text-left transition-colors hover:bg-[var(--color-mid)]/10 sm:py-3.5"
        onClick={() => setRecommendationsSectionOpen((o) => !o)}
        aria-expanded={recommendationsSectionOpen}
        aria-controls="search-recommendations-panel"
        aria-labelledby="search-recommendations-heading"
      >
        <h2
          id="search-recommendations-heading"
          className="min-w-0 flex-1 text-base font-semibold text-[var(--color-lightest)] sm:text-lg"
        >
          <OverflowMarquee>{t("search.recommendationsTitle")}</OverflowMarquee>
        </h2>
        {currentRecLoading && currentRecResults.length === 0 && !recommendationsSectionOpen && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--btn-gradient-start)]" aria-hidden />
        )}
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-[var(--color-light)] transition-transform duration-200",
            recommendationsSectionOpen && "rotate-180"
          )}
          aria-hidden
        />
        <span className="sr-only">
          {recommendationsSectionOpen ? t("search.recommendationsCollapse") : t("search.recommendationsExpand")}
        </span>
      </button>
      {recommendationsSectionOpen && (
          <motion.div
          id="search-recommendations-panel"
          role="region"
          aria-labelledby="search-recommendations-heading"
          className="flex flex-col gap-3 border-t border-[var(--color-surface-border)] px-4 pb-4 pt-3"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {currentRecLoading && currentRecResults.length === 0 && (
            <div
              className="h-36 w-full animate-pulse rounded-lg bg-[var(--color-mid)]/20 sm:h-40"
              aria-hidden
            />
          )}
          {currentRecResults.length > 0 && (
            <SearchRecommendationsCarousel
              items={currentRecResults}
              mediaType={mediaType}
              boardGameProvider={boardGameProvider}
              token={token}
              logsByExternalId={logsByExternalId}
              onItemOpen={(id) => openItemDetail(mediaType, id)}
            />
          )}
          {!currentRecLoading &&
            currentRecResults.length === 0 &&
            currentRecRequiresApiKey &&
            !skipApiKeyReq && (
              <ApiKeyPrompt
                provider={currentRecRequiresApiKey as ApiKeyProvider}
                name={
                  API_KEY_META[currentRecRequiresApiKey as ApiKeyProvider]?.name ??
                  currentRecRequiresApiKey
                }
                link={
                  currentRecMeta?.link ??
                  API_KEY_META[currentRecRequiresApiKey as ApiKeyProvider]?.link ??
                  ""
                }
                tutorial={
                  currentRecMeta?.tutorial ??
                  API_KEY_META[currentRecRequiresApiKey as ApiKeyProvider]?.tutorial ??
                  ""
                }
                onSaved={() => {
                  invalidateApiCache("/search/recommendations");
                  setRecMetaByMediaType((prev) => ({ ...prev, [mediaType]: {} }));
                  setRecRefreshNonce((n) => n + 1);
                }}
              />
            )}
          {!currentRecLoading &&
            currentRecResults.length === 0 &&
            (!currentRecRequiresApiKey || skipApiKeyReq) && (
              <p className="text-sm text-[var(--color-light)]">{t("search.recommendationsEmpty")}</p>
            )}
        </motion.div>
      )}
    </Card>
  ) : null;

  return (
    <div
      className={`relative flex flex-col gap-6 flex-1 min-h-0 min-w-0 overflow-x-hidden ${hasSearched ? "w-full" : ""}`}
    >
      <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center gap-2 overflow-hidden" aria-hidden>
        <Logo alt="" className="h-24 w-auto max-w-[90vw] opacity-20 sm:h-40 md:h-48 md:pr-4" />
        <div className=" flex flex-col items-center">
          <span className="text-xl font-bold text-[var(--color-lightest)] opacity-80 sm:text-2xl">
            {t("app.name")}
          </span>
          <span className="text-sm text-[var(--color-light)] opacity-80">
            {t("app.subtitle")}
          </span>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-6 flex-1 min-h-0">
      {!hasSearched && recommendationsSection}

      <motion.div
        className={hasSearched ? "shrink-0 w-full" : "flex-1 flex flex-col justify-end items-center min-h-0"}
        layout
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
      >
        <form onSubmit={handleSearch} className={hasSearched ? "w-full" : "w-full max-w-xl"}>
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
            className={hasSearched ? "flex flex-col gap-4 w-full" : "flex flex-col gap-4"}
          >
            <UnifiedSearchBar
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                searchFilter === SEARCH_USERS_TYPE
                  ? t("search.usersPlaceholder")
                  : t("search.searchPlaceholder", { type: t(`nav.${mediaType}`).toLowerCase() })
              }
              autoFocus={!hasSearched}
              inputAriaLabel={t("search.search")}
              clearAriaLabel={t("search.clearSearch")}
              submitAriaLabel={t("search.search")}
              showClear={query.trim() !== ""}
              onClear={() => {
                setQuery("");
                searchInputRef.current?.focus();
              }}
              disableSubmitWhenEmpty
              loading={loading}
            />
            {hasSearched && searchFilter !== SEARCH_USERS_TYPE && (
              <div className="flex w-full min-w-0 flex-wrap items-center gap-4">
                <div className="flex min-w-0 w-full flex-1 flex-wrap items-center gap-2 sm:min-w-[12rem]">
                  <Select
                    value={sortBy}
                    onValueChange={(v) => {
                      setSortBy(v);
                      if (query.trim()) runSearch(query, undefined, v);
                    }}
                    options={SEARCH_SORT_OPTIONS[mediaType].map((opt) => ({
                      value: opt.value,
                      label: t(opt.labelKey),
                    }))}
                    className="min-w-0 w-full sm:max-w-lg sm:flex-1"
                    triggerClassName="h-9 min-w-0 w-full max-w-none"
                    aria-label={t("search.sortBy")}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </form>
      </motion.div>

      {hasSearched && recommendationsSection}

      {hasSearched && loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <SearchSkeleton />
        </motion.div>
      )}

      {hasSearched && !loading && searchFilter === SEARCH_USERS_TYPE && userResults.length > 0 && (
        <motion.div variants={staggerContainer} initial="initial" animate="animate">
          <div className="flex flex-col gap-2">
            {userResults.map((user) => {
              const isOwnProfile = token && me?.user?.id === user.id;
              const showFollowButton = token && !isOwnProfile;
              const followLoading = loadingFollowId === user.id;
              return (
                <motion.div
                  key={user.id}
                  variants={staggerItem}
                  className="flex min-w-0 items-center gap-3 overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 shadow-[var(--shadow-sm)]"
                >
                  <Link
                    to={`/${user.username ?? user.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-inherit no-underline transition-opacity hover:opacity-95"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-mid)]/30 text-lg font-semibold text-[var(--color-lightest)]">
                      {(user.username ?? user.id).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <OverflowMarquee className="min-w-0 font-medium text-[var(--color-lightest)]">
                        {user.username ?? user.id}
                      </OverflowMarquee>
                      {user.logCount != null && (
                        <span className="text-xs text-[var(--color-light)]">
                          {t("search.userLogCount", { count: String(user.logCount) })}
                        </span>
                      )}
                    </div>
                  </Link>
                  {showFollowButton && (
                    <Button
                      type="button"
                      variant={user.following ? "secondary" : "default"}
                      size="sm"
                      className="shrink-0"
                      disabled={followLoading}
                      onClick={(e) => handleFollowClick(e, user.id, !!user.following)}
                    >
                      {followLoading ? (
                        t("common.saving")
                      ) : user.following ? (
                        <>
                          <UserCheck className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="ml-1.5">{t("social.following")}</span>
                        </>
                      ) : (
                        t("social.follow")
                      )}
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {hasSearched && !loading && searchFilter === SEARCH_USERS_TYPE && query && userResults.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-sm)]">
            <p className="text-center text-[var(--color-light)]">
              {t("search.noUsersFound")}
            </p>
          </Card>
        </motion.div>
      )}

      {hasSearched && !loading && searchFilter !== SEARCH_USERS_TYPE && results.length > 0 && (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="min-w-0">
          <div className={SEARCH_RESULT_CARD_GRID}>
            {results.map((item) => {
              const userLog = token ? logsByExternalId.get(item.id) : undefined;
              const status = userLog?.status ?? userLog?.listType;
              const display = userLog ? getLogCardDisplay(userLog) : null;
              const isDropped = status === "dropped";
              const isInProgress = status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
              const isCompleted = status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
              const listBorderClass =
                status == null
                  ? "border border-[var(--color-surface-border)]"
                  : isDropped
                    ? "border border-red-500"
                    : isInProgress
                      ? "border border-amber-400"
                      : isCompleted
                        ? "border border-emerald-600"
                        : "border border-[var(--color-mid)]";
              const badgeClass =
                status == null
                  ? ""
                  : isDropped
                    ? "bg-red-500/95 text-white"
                    : isInProgress
                      ? "bg-amber-400 text-[var(--color-darkest)]"
                      : isCompleted
                        ? "bg-emerald-600 text-white"
                        : "bg-[var(--color-mid)]/90 text-[var(--color-lightest)]";
              const metaParts: string[] = [item.year ?? "", item.subtitle ?? ""].filter(Boolean);
              if (
                mediaType === "games" &&
                item.timeToBeatHours != null &&
                item.timeToBeatHours > 0
              ) {
                const { hours, minutes } = formatTimeToBeatHours(item.timeToBeatHours);
                metaParts.push(
                  minutes > 0
                    ? t("itemPage.timeToBeatHoursMinutes", {
                        hours: String(hours),
                        minutes: String(minutes),
                      })
                    : t("itemPage.timeToBeatHours", { hours: String(hours) })
                );
              }
              const metaLine = metaParts.join(" · ") || "—";
              return (
              <motion.div key={item.id} variants={staggerItem} className="min-h-0 min-w-0 sm:h-full">
                <motion.div whileTap={tapScale} transition={tapTransition} className={SEARCH_RESULT_CARD_SHELL}>
                  <button
                    type="button"
                    onClick={() => openItemDetail(mediaType, item.id)}
                    className={`h-full w-full flex flex-row sm:flex-col text-left overflow-hidden rounded-lg border bg-[var(--color-dark)] text-inherit no-underline shadow-[var(--shadow-card)] cursor-pointer transition-[opacity,border-color] hover:opacity-95 max-md:min-h-[44px] ${listBorderClass} ${status == null ? "hover:border-black" : ""}`}
                  >
                    <div className={SEARCH_RESULT_CARD_IMAGE}>
                      <ItemImage
                        src={item.image}
                        className="h-full w-full"
                        mediaType={mediaType}
                        activeBoardGameProvider={mediaType === "boardgames" ? boardGameProvider : undefined}
                      />
                      {token && status && (
                        <span
                          className={`absolute bottom-1 right-1 z-10 rounded px-1.5 py-0.5 text-[9px] font-medium sm:bottom-1.5 sm:right-1.5 sm:text-[10px] ${badgeClass}`}
                          title={getStatusLabel(t, status, mediaType)}
                        >
                          {getStatusLabel(t, status, mediaType)}
                        </span>
                      )}
                    </div>
                    <div className={SEARCH_RESULT_CARD_BODY}>
                      <OverflowMarquee className="text-[10px] font-medium uppercase text-[var(--color-light)] sm:hidden">
                        {t(`nav.${mediaType}`)}
                      </OverflowMarquee>
                      <OverflowMarquee className={`${LOG_CARD_TITLE} text-[var(--color-lightest)] sm:leading-tight`}>
                        {item.title}
                      </OverflowMarquee>
                      {display?.grade != null ? (
                        <StarRating value={gradeToStars(display.grade)} readOnly size="sm" className="sm:hidden" />
                      ) : null}
                      <div className="hidden min-w-0 items-center gap-2 sm:flex">
                        {display?.grade != null ? (
                          <StarRating value={gradeToStars(display.grade)} readOnly size="sm" className="shrink-0" />
                        ) : null}
                        {item.genres && item.genres.length > 0 && (
                          <GenreBadges genres={item.genres} maxCount={1} className="shrink-0" />
                        )}
                        <OverflowMarquee className="min-w-0 flex-1 text-xs text-[var(--color-light)]">
                          {metaLine}
                        </OverflowMarquee>
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5 sm:hidden">
                        {item.genres && item.genres.length > 0 && (
                          <GenreBadges genres={item.genres} maxCount={1} />
                        )}
                        <OverflowMarquee className="text-xs text-[var(--color-light)]">
                          {metaLine}
                        </OverflowMarquee>
                      </div>
                    </div>
                  </button>
                </motion.div>
              </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {hasSearched && !loading && searchFilter !== SEARCH_USERS_TYPE && query && results.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-sm)]">
            <p className="text-center text-[var(--color-light)]">
              {t("search.noResults")} {t("search.noResultsHint")}
            </p>
          </Card>
        </motion.div>
      )}

      </div>

      <OnboardingSpotlight
        storageKey={ONBOARDING_SPOTLIGHT_KEYS.searchCategory}
        getTarget={getSearchCategorySpotlightTarget}
        message={t("onboarding.spotlightSearchCategory")}
      />
    </div>
  );
}
