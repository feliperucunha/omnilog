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
import type { Log } from "@logeverything/shared";

type SearchResponse =
  | { results: SearchResult[] }
  | { results: SearchResult[]; requiresApiKey: ApiKeyProvider; link: string; tutorial: string };

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
  } | null>(null);
  const [drawerItem, setDrawerItem] = useState<{ mediaType: MediaType; id: string } | null>(null);
  const [logsByExternalId, setLogsByExternalId] = useState<Map<string, string>>(new Map());
  const { token } = useAuth();

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

  const runSearch = useCallback(async (q: string, typeOverride?: MediaType, sortOverride?: string) => {
    if (!q.trim()) return;
    const searchType = typeOverride ?? mediaType;
    const sort = sortOverride ?? sortBy;
    setLoading(true);
    setResults([]);
    setRequiresApiKey(null);
    try {
      const params = new URLSearchParams({ type: searchType, q: q.trim() });
      if (sort && sort !== "relevance") params.set("sort", sort);
      const data = await apiFetch<SearchResponse>(
        `/search?${params.toString()}`
      );
      const list = data.results ?? [];
      setResults(list);
      if ("requiresApiKey" in data && data.requiresApiKey) {
        setRequiresApiKey({
          provider: data.requiresApiKey,
          link: data.link ?? "#",
          tutorial: data.tutorial ?? "",
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
  }, [mediaType, sortBy, t]);

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
    invalidateApiCache("/search");
    toast.success(t("toast.trySearchingAgain"));
  }, [t]);

  return (
    <div
      className={`flex flex-col gap-6 flex-1 min-h-0 ${hasSearched ? "w-full" : "self-center"}`}
    >
      <h1
        className={`text-2xl font-bold text-[var(--color-lightest)] shrink-0 ${!hasSearched ? "hidden" : ""}`}
      >
        {t("search.title")}
      </h1>

      <motion.div
        className={hasSearched ? "shrink-0 w-full" : "flex-1 flex flex-col justify-center min-h-0"}
        layout
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
      >
        <form onSubmit={handleSearch} className={hasSearched ? "w-full" : undefined}>
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
            className={hasSearched ? "flex flex-col gap-4 w-full" : "flex flex-col gap-4 max-w-xl"}
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
              {effectiveVisibleTypes.map((type) => (
                <motion.div key={type} whileTap={tapScale} transition={tapTransition}>
                  <Button
                    type="button"
                    variant={mediaType === type ? "default" : "outline"}
                    size="sm"
                    className={
                      mediaType === type
                        ? "bg-[var(--color-mid)] hover:bg-[var(--color-light)] hover:bg-[var(--color-dark)]"
                        : "border-[var(--color-mid)] bg-[var(--color-dark)] text-[var(--color-lightest)] hover:bg-[var(--color-light)]"
                    }
                    onClick={() => {
                      setMediaType(type);
                      if (query.trim()) runSearch(query, type);
                    }}
                  >
                    {t(`nav.${type}`)}
                  </Button>
                </motion.div>
              ))}
            </div>
            {hasSearched && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--color-light)]">{t("search.sortBy")}</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSortBy(v);
                    if (query.trim()) runSearch(query, undefined, v);
                  }}
                  className="flex h-9 min-w-[10rem] rounded-md border border-[var(--color-mid)] bg-[var(--color-darkest)] px-3 py-2 text-sm text-[var(--color-lightest)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)]"
                  aria-label={t("search.sortBy")}
                >
                  {SEARCH_SORT_OPTIONS[mediaType].map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
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
            {t("search.noResultsUntilApiKey")}
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
    </div>
  );
}
