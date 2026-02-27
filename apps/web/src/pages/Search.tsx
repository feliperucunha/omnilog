import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MEDIA_TYPES, SEARCH_SORT_OPTIONS, type MediaType, type SearchResult } from "@logeverything/shared";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, STATUS_I18N_KEYS } from "@logeverything/shared";
import { toast } from "sonner";
import { apiFetch, apiFetchCached, invalidateApiCache } from "@/lib/api";
import { SearchSkeleton } from "@/components/skeletons";
import { ApiKeyPrompt, type ApiKeyProvider } from "@/components/ApiKeyPrompt";
import { ItemPageContent } from "@/components/ItemPageContent";
import { ItemImage } from "@/components/ItemImage";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { formatTimeToBeatHours } from "@/lib/formatDuration";
import { useLocale } from "@/contexts/LocaleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import { BOARD_GAME_PROVIDERS, type BoardGameProvider } from "@logeverything/shared";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select } from "@/components/ui/select";
import type { Log } from "@logeverything/shared";

const SEARCH_BANNER_DISMISSED_KEY = "search-api-key-banner-dismissed";
const FREE_SEARCH_USAGE_STORAGE_KEY = "logeverything_free_search_usage";

function getFreeSearchUsageKey(type: MediaType, boardProvider: BoardGameProvider): string {
  return type === "boardgames" ? `boardgames-${boardProvider}` : type;
}

function loadFreeSearchUsageFromStorage(): Record<string, { used: number; limit: number }> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(FREE_SEARCH_USAGE_STORAGE_KEY) : null;
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

function saveFreeSearchUsageToStorage(usageKey: string, value: { used: number; limit: number }) {
  try {
    const prev = loadFreeSearchUsageFromStorage();
    localStorage.setItem(FREE_SEARCH_USAGE_STORAGE_KEY, JSON.stringify({ ...prev, [usageKey]: value }));
  } catch {
    // ignore
  }
}

interface SearchResponse {
  results: SearchResult[];
  requiresApiKey?: ApiKeyProvider;
  link?: string;
  tutorial?: string;
  freeSearchUsed?: number;
  freeSearchLimit?: number;
  freeSearchLimitReached?: boolean;
}

export function Search() {
  const { t } = useLocale();
  const location = useLocation();
  const { visibleTypes } = useVisibleMediaTypes();
  const state = location.state as { mediaType?: MediaType; query?: string } | null;
  const stateMediaType = state?.mediaType;
  const stateQuery = state?.query ?? "";
  const effectiveVisibleTypes = visibleTypes.length > 0 ? visibleTypes : [...MEDIA_TYPES];
  const defaultType = (effectiveVisibleTypes[0] ?? "movies") as MediaType;
  const [mediaType, setMediaType] = useState<MediaType>(stateMediaType ?? defaultType);
  const [sortBy, setSortBy] = useState<string>("relevance");
  const [query, setQuery] = useState(stateQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
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
    const stored = loadFreeSearchUsageFromStorage();
    const out: Partial<Record<MediaType, { used: number; limit: number }>> = {};
    for (const type of MEDIA_TYPES) {
      const key = getFreeSearchUsageKey(type as MediaType, type === "boardgames" ? "bgg" : "bgg");
      if (stored[key]) out[type as MediaType] = stored[key];
    }
    return out;
  });
  const [drawerItem, setDrawerItem] = useState<{ mediaType: MediaType; id: string } | null>(null);
  const [logsByExternalId, setLogsByExternalId] = useState<Map<string, string>>(new Map());
  const { token } = useAuth();
  const { me, refetch: refetchMe } = useMe();
  const boardGameProvider = me?.boardGameProvider ?? "bgg";
  const provider = getApiKeyProviderForMediaType(mediaType, boardGameProvider);
  const needsKeyBanner = provider != null && me?.apiKeys && !me.apiKeys[provider];
  const [savingBoardGameProvider, setSavingBoardGameProvider] = useState(false);
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
    if (stateMediaType) setMediaType(stateMediaType);
  }, [stateMediaType]);

  useEffect(() => {
    if (!effectiveVisibleTypes.includes(mediaType)) {
      setMediaType(effectiveVisibleTypes[0] ?? "movies");
    }
  }, [effectiveVisibleTypes, mediaType]);

  useEffect(() => {
    setSortBy("relevance");
  }, [mediaType]);

  useEffect(() => {
    if (stateQuery) setQuery(stateQuery);
  }, [stateQuery]);

  useEffect(() => {
    const stored = loadFreeSearchUsageFromStorage();
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
    async (q: string, typeOverride?: MediaType, sortOverride?: string) => {
      if (!q.trim()) return;
      const searchType = typeOverride ?? mediaType;
      const sort = sortOverride ?? sortBy;
      const boardProvider = me?.boardGameProvider ?? "bgg";
      const usageKey = getFreeSearchUsageKey(searchType, searchType === "boardgames" ? boardProvider : "bgg");
      const stored = loadFreeSearchUsageFromStorage();
      const clientUsed = stored[usageKey]?.used ?? 0;
      setLoading(true);
      setResults([]);
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
          saveFreeSearchUsageToStorage(usageKey, usage);
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
  }, [mediaType, sortBy, t, me?.boardGameProvider]);

  const handleBoardGameProviderChange = useCallback(
    async (newProvider: BoardGameProvider) => {
      if (me?.boardGameProvider === newProvider) return;
      setSavingBoardGameProvider(true);
      try {
        await apiFetch("/settings/board-game-provider", {
          method: "PUT",
          body: JSON.stringify({ provider: newProvider }),
        });
        await refetchMe();
        invalidateApiCache("/search");
        if (query.trim()) await runSearch(query);
      } finally {
        setSavingBoardGameProvider(false);
      }
    },
    [me?.boardGameProvider, refetchMe, query, runSearch]
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
    if (!token || !hasSearched || results.length === 0) {
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
  }, [token, mediaType, hasSearched, results.length]);

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

  return (
    <div
      className={`relative flex flex-col gap-6 flex-1 min-h-0 ${hasSearched ? "w-full" : ""}`}
    >
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center" aria-hidden>
        <img src="/logo.svg" alt="" className="h-32 w-auto opacity-20 sm:h-40 md:h-48" />
      </div>

      <div className="relative z-10 flex flex-col gap-6 flex-1 min-h-0">
      <h1
        className={`text-2xl font-bold text-[var(--color-lightest)] shrink-0 ${!hasSearched ? "hidden" : ""}`}
      >
        {t("search.title")}
      </h1>

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
              placeholder={t("search.searchPlaceholder", { type: t(`nav.${mediaType}`).toLowerCase() })}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus={!hasSearched}
              aria-label={t("search.search")}
            />
            <div className="flex flex-wrap gap-2 mt-2 items-center justify-center">
              {effectiveVisibleTypes.map((type) => {
                const typeProvider = getApiKeyProviderForMediaType(type, boardGameProvider);
                const hasKeyForType = typeProvider == null || !!me?.apiKeys?.[typeProvider];
                const categoryLimitReached = limitReachedByCategory[type];
                const isDisabled = !hasKeyForType && !!categoryLimitReached;
                return (
                  <motion.div key={type} whileTap={isDisabled ? undefined : tapScale} transition={tapTransition}>
                    <Button
                      type="button"
                      variant={mediaType === type ? "default" : "outline"}
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
                        setMediaType(type);
                        if (query.trim()) runSearch(query, type);
                      }}
                    >
                      {t(`nav.${type}`)}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
            {hasSearched && (
              <div
                className={`flex flex-wrap items-center gap-4 ${mediaType === "boardgames" ? "w-full justify-between" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
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
                    triggerClassName="min-w-[10rem] h-9 max-w-none"
                    aria-label={t("search.sortBy")}
                  />
                </div>
                {mediaType === "boardgames" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ToggleGroup
                      type="single"
                      value={boardGameProvider}
                      onValueChange={(v) => v && handleBoardGameProviderChange(v as BoardGameProvider)}
                      disabled={savingBoardGameProvider}
                      className="inline-flex rounded-md border border-[var(--color-mid)]/30 p-0.5"
                      aria-label={t("settings.boardGameProviderLabel")}
                    >
                      {BOARD_GAME_PROVIDERS.map((provider) => (
                        <ToggleGroupItem
                          key={provider}
                          value={provider}
                          className="h-8 px-3 text-sm"
                          aria-label={provider === "bgg" ? t("settings.boardGameProviderBgg") : t("settings.boardGameProviderLudopedia")}
                        >
                          {provider === "bgg" ? t("settings.boardGameProviderBgg") : t("settings.boardGameProviderLudopedia")}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                )}
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

      {hasSearched && !loading && results.length > 0 && (
        <motion.div variants={staggerContainer} initial="initial" animate="animate">
          <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {results.map((item) => {
              const status = token ? logsByExternalId.get(item.id) : undefined;
              const isDropped = status === "dropped";
              const isInProgress = status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
              const isCompleted = status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
              const listBorderClass =
                status == null
                  ? "border-[var(--color-dark)]"
                  : isDropped
                    ? "border-2 border-red-500"
                    : isInProgress
                      ? "border-2 border-amber-400"
                      : isCompleted
                        ? "border-2 border-emerald-600"
                        : "border-2 border-[var(--color-mid)]";
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
              <motion.div key={item.id} variants={staggerItem} className="min-h-0 sm:h-full">
                <motion.div whileTap={tapScale} transition={tapTransition} className="h-full">
                  <button
                    type="button"
                    onClick={() => setDrawerItem({ mediaType, id: item.id })}
                    className={`h-full w-full flex flex-row sm:flex-col text-left overflow-hidden rounded-lg border bg-[var(--color-dark)] text-inherit no-underline shadow-[var(--shadow-card)] cursor-pointer transition-[opacity,border-color] hover:opacity-95 ${listBorderClass} ${status == null ? "hover:border-black" : ""}`}
                  >
                    <div className="w-20 h-28 flex-shrink-0 overflow-hidden relative rounded-l-lg sm:w-full sm:h-auto sm:aspect-[2/3] sm:rounded-l-none sm:rounded-t-lg">
                      <ItemImage src={item.image} className="h-full w-full" />
                      {token && status && (
                        <span
                          className={`absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-[9px] font-medium sm:bottom-1.5 sm:right-1.5 sm:text-[10px] ${badgeClass}`}
                          title={t(`status.${STATUS_I18N_KEYS[status] ?? status}`)}
                        >
                          {t(`status.${STATUS_I18N_KEYS[status] ?? status}`)}
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
            tutorial={requiresApiKey.tutorial}
            onSaved={handleApiKeySaved}
          />
        </div>
      )}

      {hasSearched && !loading && query && results.length === 0 && !requiresApiKey && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-sm)]">
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
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
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
