import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MEDIA_TYPES, SEARCH_SORT_OPTIONS, type MediaType, type SearchResult } from "@geeklogs/shared";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { apiFetch, apiFetchCached, invalidateApiCache } from "@/lib/api";
import { APP_PTR_REFRESH_EVENT } from "@/lib/appPtrRefresh";
import { SearchSkeleton } from "@/components/skeletons";
import { Logo } from "@/components/Logo";
import { ItemPageContent } from "@/components/ItemPageContent";
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
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";
import { SearchRecommendationsCarousel } from "@/components/SearchRecommendationsCarousel";
import * as storage from "@/lib/storage";
import { useAndroidOverlayBack } from "@/hooks/useAndroidOverlayBack";
import type { Log } from "@geeklogs/shared";
import { paperShadow } from "@/lib/paperShadow";
import { cn } from "@/lib/utils";
import { decodeSearchResultForDisplay } from "@/lib/decodeDisplayFields";
import { UnifiedSearchBar } from "@/components/UnifiedSearchBar";
import { OnboardingSpotlight } from "@/components/OnboardingSpotlight";
import { getFirstVisibleByIds, ONBOARDING_SPOTLIGHT_KEYS } from "@/lib/onboardingSpotlightStorage";

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

const USERS_SEARCH_TYPE = "users" as const;
type SearchFilter = MediaType | typeof USERS_SEARCH_TYPE;

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

interface UserSearchResult {
  id: string;
  username?: string;
  logCount?: number;
  following?: boolean;
}

export function Search() {
  const { t } = useLocale();
  const location = useLocation();
  const { visibleTypes } = useVisibleMediaTypes();
  const { setPageTitle, setBelowNavbar } = usePageTitle() ?? {};
  useEffect(() => {
    setPageTitle?.(t("nav.search"));
    return () => {
      setPageTitle?.(null);
      setBelowNavbar?.(null);
    };
  }, [t, setPageTitle, setBelowNavbar]);

  const state = location.state as { mediaType?: MediaType; query?: string } | null;
  const stateMediaType = state?.mediaType;
  const stateQuery = state?.query ?? "";
  const effectiveVisibleTypes = visibleTypes.length > 0 ? visibleTypes : [...MEDIA_TYPES];
  const defaultType = (effectiveVisibleTypes[0] ?? "movies") as MediaType;
  const [searchFilter, setSearchFilter] = useState<SearchFilter>(stateMediaType ?? defaultType);
  const mediaType = searchFilter === USERS_SEARCH_TYPE ? defaultType : searchFilter;
  const initialSortMediaType = (stateMediaType ?? defaultType) as MediaType;
  const [sortBy, setSortBy] = useState<string>(
    () => SEARCH_SORT_OPTIONS[initialSortMediaType][0].value
  );
  const [loadingFollowId, setLoadingFollowId] = useState<string | null>(null);
  const [query, setQuery] = useState(stateQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
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
  const [drawerItem, setDrawerItem] = useState<{ mediaType: MediaType; id: string } | null>(null);
  useAndroidOverlayBack(drawerItem != null, () => setDrawerItem(null));
  const [logsByExternalId, setLogsByExternalId] = useState<Map<string, string>>(new Map());
  const [recResults, setRecResults] = useState<SearchResult[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recRefreshNonce, setRecRefreshNonce] = useState(0);
  /** Recommendations panel: collapsed by default; fetch still runs in the background (see useEffect below). */
  const [recommendationsSectionOpen, setRecommendationsSectionOpen] = useState(false);
  /** Desktop: map vertical wheel to horizontal scroll (mobile uses native touch; unchanged). */
  const { token } = useAuth();
  const { me, loading: meLoading } = useMe();
  const boardGameProvider = me?.boardGameProvider ?? "bgg";
  const skipApiKeyReq = skipApiKeyMissingUi(me, { token: !!token, meLoading });
  const hasBoardGameKey = !!(me?.apiKeys?.bgg || me?.apiKeys?.ludopedia);

  useEffect(() => {
    if (stateMediaType) setSearchFilter(stateMediaType);
  }, [stateMediaType]);

  // When there's no nav state, keep the selected category in sync with the first option from settings order (e.g. after me/visibleTypes loads).
  useEffect(() => {
    if (stateMediaType != null) return;
    const first = (effectiveVisibleTypes[0] ?? "movies") as SearchFilter;
    setSearchFilter(first);
  }, [stateMediaType, effectiveVisibleTypes[0]]);

  useEffect(() => {
    if (
      searchFilter !== USERS_SEARCH_TYPE &&
      !effectiveVisibleTypes.includes(searchFilter)
    ) {
      setSearchFilter((effectiveVisibleTypes[0] ?? "movies") as MediaType);
    }
  }, [effectiveVisibleTypes, searchFilter]);

  useEffect(() => {
    if (searchFilter !== USERS_SEARCH_TYPE) {
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

  const runSearch = useCallback(
    async (q: string, typeOverride?: SearchFilter, sortOverride?: string) => {
      if (!q.trim()) return;
      const filter = typeOverride ?? searchFilter;
      if (filter === USERS_SEARCH_TYPE) {
        setLoading(true);
        setResults([]);
        setUserResults([]);
        try {
          const params = new URLSearchParams({ q: q.trim() });
          const data = await apiFetch<{ users: UserSearchResult[] }>(`/search/users?${params.toString()}`);
          setUserResults(data.users ?? []);
        } catch (err) {
          setUserResults([]);
          showErrorToast(t, "E016", { originalError: err });
        } finally {
          setLoading(false);
        }
        return;
      }
      const searchType = filter as MediaType;
      const sort = sortOverride ?? sortBy;
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
      } catch (err) {
        setResults([]);
        showErrorToast(t, "E016", { originalError: err });
      } finally {
        setLoading(false);
      }
    },
    [searchFilter, sortBy, t, token, me]
  );

  const hasRunInitialSearch = useRef(false);
  const [hasSearched, setHasSearched] = useState(!!stateQuery.trim());
  useEffect(() => {
    if (stateQuery.trim() && !hasRunInitialSearch.current) {
      hasRunInitialSearch.current = true;
      runSearch(stateQuery);
      setHasSearched(true);
    }
  }, [stateQuery, runSearch]);

  useEffect(() => {
    const needsLogsForSearchResults =
      hasSearched && searchFilter !== USERS_SEARCH_TYPE && results.length > 0;
    const needsLogsForRecommendations =
      !hasSearched && searchFilter !== USERS_SEARCH_TYPE && recResults.length > 0;
    if (!token || (!needsLogsForSearchResults && !needsLogsForRecommendations)) {
      setLogsByExternalId(new Map());
      return;
    }
    apiFetchCached<Log[]>(`/logs?mediaType=${mediaType}`, { ttlMs: 2 * 60 * 1000 })
      .then((logs) => {
        const map = new Map<string, string>();
        for (const log of logs) {
          const status = log.status ?? log.listType;
          if (status) map.set(log.externalId, status);
        }
        setLogsByExternalId(map);
      })
      .catch(() => setLogsByExternalId(new Map()));
  }, [token, mediaType, hasSearched, results.length, recResults.length, searchFilter]);

  useEffect(() => {
    if (hasSearched || searchFilter === USERS_SEARCH_TYPE || !RECOMMENDATION_MEDIA_TYPES.includes(mediaType)) {
      setRecResults([]);
      setRecLoading(false);
      return;
    }
    let cancelled = false;
    setRecLoading(true);
    const params = new URLSearchParams({
      type: mediaType,
      // Split client cache: recommendations differ when logged in (seeds from logs).
      viewer: token ? "auth" : "guest",
    });
    if (mediaType === "boardgames") {
      params.set("boardGameProvider", boardGameProvider);
    }
    apiFetchCached<RecommendationsResponse>(`/search/recommendations?${params.toString()}`, {
      ttlMs: 5 * 60 * 1000,
    })
      .then((data) => {
        if (cancelled) return;
        setRecResults((data.results ?? []).map(decodeSearchResultForDisplay));
      })
      .catch(() => {
        if (!cancelled) {
          setRecResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRecLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasSearched, mediaType, searchFilter, token, recRefreshNonce, me, boardGameProvider]);

  useEffect(() => {
    setRecommendationsSectionOpen(false);
  }, [mediaType, searchFilter]);

  const handleSearch = async (e: React.FormEvent) => {
    setHasSearched(true);
    e.preventDefault();
    if (!query.trim()) return;
    await runSearch(query);
  };

  useEffect(() => {
    const onPtr = () => {
      invalidateApiCache("/search");
      if (hasSearched && query.trim()) {
        void runSearch(query);
      } else {
        setRecRefreshNonce((n) => n + 1);
      }
    };
    window.addEventListener(APP_PTR_REFRESH_EVENT, onPtr);
    return () => window.removeEventListener(APP_PTR_REFRESH_EVENT, onPtr);
  }, [hasSearched, query, runSearch]);

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
          { value: USERS_SEARCH_TYPE, label: t("search.usersFilter") },
        ]}
        selectedValue={searchFilter}
        onSelect={(v) => {
          setSearchFilter(v as MediaType | typeof USERS_SEARCH_TYPE);
          if (query.trim()) runSearch(query, v as MediaType | typeof USERS_SEARCH_TYPE);
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
      {!hasSearched && searchFilter !== USERS_SEARCH_TYPE && RECOMMENDATION_MEDIA_TYPES.includes(mediaType) && (
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
            {recLoading && !recommendationsSectionOpen && (
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
            <div
              id="search-recommendations-panel"
              role="region"
              aria-labelledby="search-recommendations-heading"
              className="flex flex-col gap-3 border-t border-[var(--color-surface-border)] px-4 pb-4 pt-3"
            >
              {recLoading && (
                <div
                  className="h-36 w-full animate-pulse rounded-lg bg-[var(--color-mid)]/20 sm:h-40"
                  aria-hidden
                />
              )}
              {!recLoading && recResults.length > 0 && (
                <SearchRecommendationsCarousel
                  items={recResults}
                  mediaType={mediaType}
                  boardGameProvider={boardGameProvider}
                  token={token}
                  logsByExternalId={logsByExternalId}
                  onItemOpen={(id) => setDrawerItem({ mediaType, id })}
                />
              )}
            </div>
          )}
        </Card>
      )}

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
                searchFilter === USERS_SEARCH_TYPE
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
            {hasSearched && searchFilter !== USERS_SEARCH_TYPE && (
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

      {hasSearched && loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <SearchSkeleton />
        </motion.div>
      )}

      {hasSearched && !loading && searchFilter === USERS_SEARCH_TYPE && userResults.length > 0 && (
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

      {hasSearched && !loading && searchFilter === USERS_SEARCH_TYPE && query && userResults.length === 0 && (
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

      {hasSearched && !loading && searchFilter !== USERS_SEARCH_TYPE && results.length > 0 && (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="min-w-0">
          <div className="flex min-w-0 flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {results.map((item) => {
              const status = token ? logsByExternalId.get(item.id) : undefined;
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
              return (
              <motion.div key={item.id} variants={staggerItem} className="min-h-0 min-w-0 sm:h-full">
                <motion.div whileTap={tapScale} transition={tapTransition} className="h-full">
                  <button
                    type="button"
                    onClick={() => setDrawerItem({ mediaType, id: item.id })}
                    className={`h-full w-full flex flex-row sm:flex-col text-left overflow-hidden rounded-lg border bg-[var(--color-dark)] text-inherit no-underline shadow-[var(--shadow-card)] cursor-pointer transition-[opacity,border-color] hover:opacity-95 max-md:min-h-[44px] ${listBorderClass} ${status == null ? "hover:border-black" : ""}`}
                  >
                    <div className="w-20 h-28 flex-shrink-0 overflow-hidden relative rounded-l-lg sm:w-full sm:h-auto sm:aspect-[2/3] sm:rounded-l-none sm:rounded-t-lg">
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
                    <div className="flex flex-1 min-w-0 flex-col justify-center gap-0.5 p-3 overflow-hidden sm:justify-start sm:gap-1 sm:h-[5.5rem] sm:min-h-[5.5rem] sm:p-4 sm:pt-3 sm:flex-shrink-0">
                      <OverflowMarquee className="text-[10px] font-medium uppercase text-[var(--color-light)] sm:text-xs">
                        {t(`nav.${mediaType}`)}
                      </OverflowMarquee>
                      <OverflowMarquee className="text-sm font-semibold text-[var(--color-lightest)] sm:text-lg">
                        {item.title}
                      </OverflowMarquee>
                      {item.genres && item.genres.length > 0 && (
                        <GenreBadges genres={item.genres} maxCount={1} />
                      )}
                      <OverflowMarquee className="text-xs text-[var(--color-light)] sm:text-sm sm:leading-snug">
                        {(() => {
                          const parts: string[] = [item.year ?? "", item.subtitle ?? ""].filter(Boolean);
                          if (
                            mediaType === "games" &&
                            item.timeToBeatHours != null &&
                            item.timeToBeatHours > 0
                          ) {
                            const { hours, minutes } = formatTimeToBeatHours(item.timeToBeatHours);
                            parts.push(
                              minutes > 0
                                ? t("itemPage.timeToBeatHoursMinutes", {
                                    hours: String(hours),
                                    minutes: String(minutes),
                                  })
                                : t("itemPage.timeToBeatHours", { hours: String(hours) })
                            );
                          }
                          return parts.join(" · ") || "—";
                        })()}
                      </OverflowMarquee>
                    </div>
                  </button>
                </motion.div>
              </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {hasSearched && !loading && searchFilter !== USERS_SEARCH_TYPE && query && results.length === 0 && (
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

      <AnimatePresence>
        {drawerItem && (
          <motion.div
            key={`${drawerItem.mediaType}-${drawerItem.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col bg-[var(--color-darkest)]"
            aria-modal
            role="dialog"
            aria-label={t("itemPage.back")}
          >
            <div className="flex-1 overflow-x-hidden overflow-y-auto min-w-0 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] md:p-6">
              <ItemPageContent
                mediaType={drawerItem.mediaType}
                id={drawerItem.id}
                onBack={() => setDrawerItem(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <OnboardingSpotlight
        storageKey={ONBOARDING_SPOTLIGHT_KEYS.searchCategory}
        getTarget={getSearchCategorySpotlightTarget}
        message={t("onboarding.spotlightSearchCategory")}
      />
    </div>
  );
}
