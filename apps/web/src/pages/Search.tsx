import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MEDIA_TYPES, SEARCH_SORT_OPTIONS, type MediaType, type SearchResult } from "@dogument/shared";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES } from "@dogument/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { toast } from "sonner";
import { apiFetch, apiFetchCached, invalidateApiCache } from "@/lib/api";
import { SearchSkeleton } from "@/components/skeletons";
import { Logo } from "@/components/Logo";
import { ApiKeyPrompt, type ApiKeyProvider } from "@/components/ApiKeyPrompt";
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
import type { BoardGameProvider } from "@dogument/shared";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import { Link } from "react-router-dom";
import { AlertTriangle, UserCheck, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";
import * as storage from "@/lib/storage";
import type { Log } from "@dogument/shared";

const SEARCH_BANNER_DISMISSED_KEY = "search-api-key-banner-dismissed";
const FREE_SEARCH_USAGE_STORAGE_KEY = "dogument_free_search_usage";

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
  requiresApiKey?: ApiKeyProvider;
  link?: string;
  tutorial?: string;
  freeSearchUsed?: number;
  freeSearchLimit?: number;
  freeSearchLimitReached?: boolean;
}

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
  const [sortBy, setSortBy] = useState<string>("relevance");
  const [loadingFollowId, setLoadingFollowId] = useState<string | null>(null);
  const [query, setQuery] = useState(stateQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [requiresApiKey, setRequiresApiKey] = useState<{
    provider: ApiKeyProvider;
    link: string;
    tutorial: string;
    freeSearchUsed?: number;
    freeSearchLimit?: number;
    freeSearchLimitReached?: boolean;
  } | null>(null);
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
  const [logsByExternalId, setLogsByExternalId] = useState<Map<string, string>>(new Map());
  const { token } = useAuth();
  const { me } = useMe();
  const boardGameProvider = me?.boardGameProvider ?? "bgg";
  const provider = getApiKeyProviderForMediaType(mediaType, boardGameProvider);
  const hasBoardGameKey = !!(me?.apiKeys?.bgg || me?.apiKeys?.ludopedia);
  const needsKeyBanner =
    provider != null &&
    (mediaType === "boardgames" ? !hasBoardGameKey : me?.apiKeys && !me.apiKeys[provider]);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(`${SEARCH_BANNER_DISMISSED_KEY}-${mediaType}`) === "1";
  });
  const showSearchKeyBanner = needsKeyBanner && !bannerDismissed;

  const dismissSearchKeyBanner = () => {
    setBannerDismissed(true);
    try {
      sessionStorage.setItem(`${SEARCH_BANNER_DISMISSED_KEY}-${mediaType}`, "1");
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const stored = sessionStorage.getItem(`${SEARCH_BANNER_DISMISSED_KEY}-${mediaType}`) === "1";
    setBannerDismissed(stored);
  }, [mediaType]);

  useEffect(() => {
    if (stateMediaType) setSearchFilter(stateMediaType);
  }, [stateMediaType]);

  useEffect(() => {
    if (
      searchFilter !== USERS_SEARCH_TYPE &&
      !effectiveVisibleTypes.includes(searchFilter)
    ) {
      setSearchFilter((effectiveVisibleTypes[0] ?? "movies") as MediaType);
    }
  }, [effectiveVisibleTypes, searchFilter]);

  useEffect(() => {
    setSortBy("relevance");
  }, [mediaType]);

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
        setRequiresApiKey(null);
        try {
          const params = new URLSearchParams({ q: q.trim() });
          const data = await apiFetch<{ users: UserSearchResult[] }>(`/search/users?${params.toString()}`);
          setUserResults(data.users ?? []);
        } catch {
          setUserResults([]);
          toast.error(t("toast.searchFailed"));
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
      setRequiresApiKey(null);
      try {
        const params = new URLSearchParams({ type: searchType, q: q.trim() });
        if (sort && sort !== "relevance") params.set("sort", sort);
        if (searchType === "boardgames" && boardProvider) params.set("boardGameProvider", boardProvider);
        const data = await apiFetch<SearchResponse>(`/search?${params.toString()}`, {
          headers: { "X-Free-Search-Used": String(clientUsed) },
        });
        const list = data.results ?? [];
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
        if ("requiresApiKey" in data && data.requiresApiKey) {
          setRequiresApiKey({
            provider: data.requiresApiKey,
            link: data.link ?? "#",
            tutorial: data.tutorial ?? "",
            freeSearchUsed: data.freeSearchUsed,
            freeSearchLimit: data.freeSearchLimit,
            freeSearchLimitReached: data.freeSearchLimitReached,
          });
        } else {
          setRequiresApiKey(null);
        }
      } catch (err) {
        setResults([]);
        setRequiresApiKey(null);
        toast.error(err instanceof Error ? err.message : t("toast.searchFailed"));
      } finally {
        setLoading(false);
      }
    },
    [searchFilter, sortBy, t, me?.boardGameProvider]
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
    if (!token || !hasSearched || searchFilter === USERS_SEARCH_TYPE || results.length === 0) {
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
  }, [token, mediaType, hasSearched, results.length, searchFilter]);

  const handleSearch = async (e: React.FormEvent) => {
    setHasSearched(true);
    e.preventDefault();
    if (!query.trim()) return;
    await runSearch(query);
  };

  const handleApiKeySaved = useCallback(() => {
    setRequiresApiKey(null);
    setLimitReachedByCategory({});
    setUsageByCategory({});
    invalidateApiCache("/search");
    toast.success(t("toast.trySearchingAgain"));
  }, [t]);

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
      } catch {
        toast.error(t("common.tryAgain"));
      } finally {
        setLoadingFollowId(null);
      }
    },
    [token, loadingFollowId, t]
  );

  useEffect(() => {
    setBelowNavbar?.(
      <StickyCategoryStrip
        items={[
          ...effectiveVisibleTypes.map((type) => {
            const typeProvider = getApiKeyProviderForMediaType(type, boardGameProvider);
            const hasKeyForType = typeProvider == null || !!me?.apiKeys?.[typeProvider];
            const categoryLimitReached = limitReachedByCategory[type];
            return {
              value: type,
              label: t(`nav.${type}`),
              disabled: !hasKeyForType && !!categoryLimitReached,
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
        mobileOnly
        stickyTop="top-14"
        aria-label={t("dashboard.category")}
      />
    );
    return () => setBelowNavbar?.(null);
  }, [
    effectiveVisibleTypes,
    searchFilter,
    query,
    boardGameProvider,
    me?.apiKeys,
    limitReachedByCategory,
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
        <div className="-mt-8 flex flex-col items-center">
          <span className="text-xl font-bold text-[var(--color-lightest)] opacity-80 sm:text-2xl">
            {t("app.name")}
          </span>
          <span className="text-sm text-[var(--color-light)] opacity-80">
            {t("app.subtitle")}
          </span>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-6 flex-1 min-h-0">
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
            <Input
              className="w-full"
              placeholder={
                searchFilter === USERS_SEARCH_TYPE
                  ? t("search.usersPlaceholder")
                  : t("search.searchPlaceholder", { type: t(`nav.${mediaType}`).toLowerCase() })
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus={!hasSearched}
              aria-label={t("search.search")}
            />
            {/* Desktop: category buttons */}
            <div className="hidden md:flex flex-wrap gap-2 mt-2 items-center justify-center">
              {[...effectiveVisibleTypes, USERS_SEARCH_TYPE].map((filter) => {
                if (filter === USERS_SEARCH_TYPE) {
                  return (
                    <motion.div key={USERS_SEARCH_TYPE} whileTap={tapScale} transition={tapTransition}>
                      <Button
                        type="button"
                        variant={searchFilter === USERS_SEARCH_TYPE ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSearchFilter(USERS_SEARCH_TYPE);
                          if (query.trim()) runSearch(query, USERS_SEARCH_TYPE);
                        }}
                      >
                        {t("search.usersFilter")}
                      </Button>
                    </motion.div>
                  );
                }
                const type = filter as MediaType;
                const typeProvider = getApiKeyProviderForMediaType(type, boardGameProvider);
                const hasKeyForType = typeProvider == null || !!me?.apiKeys?.[typeProvider];
                const categoryLimitReached = limitReachedByCategory[type];
                const isDisabled = !hasKeyForType && !!categoryLimitReached;
                return (
                  <motion.div key={type} whileTap={isDisabled ? undefined : tapScale} transition={tapTransition}>
                    <Button
                      type="button"
                      variant={searchFilter === type ? "default" : "outline"}
                      size="sm"
                      disabled={isDisabled}
                      title={
                        isDisabled
                          ? t("search.categoryLimitReachedTooltip", {
                              type: t(`nav.${type}`),
                              used: String(usageByCategory[type]?.used ?? 10),
                              limit: String(usageByCategory[type]?.limit ?? 10),
                            })
                          : undefined
                      }
                      onClick={() => {
                        setSearchFilter(type);
                        if (query.trim()) runSearch(query, type);
                      }}
                    >
                      {t(`nav.${type}`)}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
            {hasSearched && searchFilter !== USERS_SEARCH_TYPE && (
              <div
                className="flex flex-wrap items-center gap-4 min-w-0"
              >
                <div className="flex flex-wrap items-center gap-2 min-w-0">
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
                    triggerClassName="min-w-0 w-full sm:min-w-[10rem] sm:w-auto h-9 max-w-none"
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
                      <span className="min-w-0 truncate font-medium text-[var(--color-lightest)]">
                        {user.username ?? user.id}
                      </span>
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
                      <ItemImage src={item.image} className="h-full w-full" />
                      {token && status && (
                        <span
                          className={`absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-[9px] font-medium sm:bottom-1.5 sm:right-1.5 sm:text-[10px] ${badgeClass}`}
                          title={getStatusLabel(t, status, mediaType)}
                        >
                          {getStatusLabel(t, status, mediaType)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 min-w-0 flex-col justify-center gap-0.5 p-3 overflow-hidden sm:justify-start sm:gap-1 sm:h-[5.5rem] sm:min-h-[5.5rem] sm:p-4 sm:pt-3 sm:flex-shrink-0">
                      <p className="text-[10px] font-medium uppercase text-[var(--color-light)] truncate sm:text-xs">
                        {t(`nav.${mediaType}`)}
                      </p>
                      <p className="line-clamp-2 text-sm font-semibold text-[var(--color-lightest)] sm:line-clamp-1 sm:text-lg">
                        {item.title}
                      </p>
                      {item.genres && item.genres.length > 0 && (
                        <GenreBadges genres={item.genres} maxCount={1} />
                      )}
                      <p className="line-clamp-1 text-xs text-[var(--color-light)] sm:line-clamp-2 sm:text-sm sm:leading-snug">
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
                      </p>
                    </div>
                  </button>
                </motion.div>
              </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {hasSearched && !loading && requiresApiKey && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-light)]">
            {requiresApiKey.freeSearchLimitReached
              ? t("search.freeSearchLimitReached", {
                  used: String(requiresApiKey.freeSearchUsed ?? 10),
                  limit: String(requiresApiKey.freeSearchLimit ?? 10),
                  type: t(`nav.${mediaType}`),
                })
              : requiresApiKey.freeSearchUsed != null && requiresApiKey.freeSearchLimit != null
                ? t("search.freeSearchUsage", {
                    used: String(requiresApiKey.freeSearchUsed),
                    limit: String(requiresApiKey.freeSearchLimit),
                  })
                : t("search.noResultsUntilApiKey")}
          </p>
          <ApiKeyPrompt
            provider={requiresApiKey.provider}
            name={t(`nav.${mediaType}`)}
            link={requiresApiKey.link}
            tutorial={t(`settings.apiKeyTutorial.${requiresApiKey.provider}`)}
            onSaved={handleApiKeySaved}
          />
        </div>
      )}

      {hasSearched && !loading && searchFilter !== USERS_SEARCH_TYPE && query && results.length === 0 && !requiresApiKey && (
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

      <AnimatePresence>
        {showSearchKeyBanner && token && (
          <motion.div
            key="search-key-banner"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed top-4 left-4 right-4 z-40 flex max-w-sm items-start gap-3 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-dark)] p-3 shadow-[var(--shadow-lg)] md:left-auto md:right-6 md:top-6"
            role="status"
          >
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-[var(--color-warning-icon)] mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--color-lightest)]">
              {usageByCategory[mediaType]
                ? t("apiKeyBanner.searchMessageWithCount", {
                    category: t(`nav.${mediaType}`),
                    provider: provider ? API_KEY_META[provider].name : "",
                    used: String(usageByCategory[mediaType]!.used),
                    limit: String(usageByCategory[mediaType]!.limit),
                  })
                : t("apiKeyBanner.searchMessage", {
                    category: t(`nav.${mediaType}`),
                    provider: provider ? API_KEY_META[provider].name : "",
                  })}
            </p>
            <Link
              to="/settings?open=api-keys"
              className="mt-1.5 inline-block text-xs font-medium text-[var(--color-warning-text-muted)] underline hover:text-[var(--color-warning-text)]"
            >
              {t("apiKeyBanner.addKeyInSettings")}
            </Link>
          </div>
          <button
            type="button"
            onClick={dismissSearchKeyBanner}
            className="flex-shrink-0 rounded p-1 text-[var(--color-light)] hover:bg-[var(--color-mid)]/30 hover:text-[var(--color-lightest)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)]"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
