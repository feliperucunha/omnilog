import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Share2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { apiFetch, apiFetchCached } from "@/lib/api";
import { DashboardSkeleton } from "@/components/skeletons";
import { useLocale } from "@/contexts/LocaleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { useAuth } from "@/contexts/AuthContext";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import { MEDIA_TYPES, type MediaType, toMediaType } from "@logeverything/shared";
import type { Log } from "@logeverything/shared";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MediaLogs } from "@/pages/MediaLogs";
import { ItemImage } from "@/components/ItemImage";
import { GenreBadges } from "@/components/GenreBadges";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";

interface FeedEntry {
  log: Log;
  user: { id: string; username: string | null };
}

const paperShadow = { boxShadow: "var(--shadow-sm)" };

export function Dashboard() {
  const { t } = useLocale();
  const { token } = useAuth();
  const { me } = useMe();
  const { visibleTypes } = useVisibleMediaTypes();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const defaultCategory: MediaType = visibleTypes.length > 0 ? toMediaType(visibleTypes[0]) : "movies";
  const [selectedCategory, setSelectedCategory] = useState<MediaType>(() => {
    if (categoryParam && MEDIA_TYPES.includes(categoryParam as MediaType)) return toMediaType(categoryParam);
    return defaultCategory;
  });
  const [counts, setCounts] = useState<Record<MediaType, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  useEffect(() => {
    if (categoryParam && MEDIA_TYPES.includes(categoryParam as MediaType)) setSelectedCategory(toMediaType(categoryParam));
    else if (!categoryParam && visibleTypes.length > 0) setSelectedCategory(toMediaType(visibleTypes[0]));
  }, [categoryParam, visibleTypes]);

  useEffect(() => {
    if (visibleTypes.length > 0 && !visibleTypes.includes(selectedCategory)) {
      const fallback = toMediaType(visibleTypes[0]);
      setSelectedCategory(fallback);
      setSearchParams({ category: fallback }, { replace: true });
    }
  }, [visibleTypes, selectedCategory, setSearchParams]);

  const setCategory = useCallback(
    (type: MediaType) => {
      setSelectedCategory(type);
      setSearchParams({ category: type }, { replace: true });
    },
    [setSearchParams]
  );

  const fetchCounts = useCallback(() => {
    setError(null);
    setLoading(true);
    apiFetchCached<{ data: Record<MediaType, number> }>("/logs/counts", { ttlMs: 2 * 60 * 1000 })
      .then((res) => setCounts(res.data ?? null))
      .catch((err) => {
        setCounts(null);
        setError(err instanceof Error ? err.message : t("dashboard.couldntLoadLogs"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    if (!token) {
      setFeed([]);
      return;
    }
    setFeedLoading(true);
    apiFetch<{ data: FeedEntry[] }>("/logs/feed")
      .then((res) => setFeed(res.data ?? []))
      .catch(() => setFeed([]))
      .finally(() => setFeedLoading(false));
  }, [token]);

  const handleShare = useCallback(async () => {
    if (!me?.user?.id) return;
    const slug = me.user.username || me.user.id;
    const base = `${window.location.origin}/${slug}`;
    const url =
      visibleTypes.includes(selectedCategory) && selectedCategory
        ? `${base}?category=${selectedCategory}`
        : base;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("dashboard.linkCopied"));
    } catch {
      toast.error(t("common.tryAgain"));
    }
  }, [me?.user?.id, visibleTypes, selectedCategory, t]);

  const byType = Object.fromEntries(
    MEDIA_TYPES.map((type) => [type, counts?.[type] ?? 0])
  ) as Record<MediaType, number>;

  const boardGameProvider = me?.boardGameProvider ?? "bgg";
  const apiKeyProvider = getApiKeyProviderForMediaType(selectedCategory, boardGameProvider);
  const needsApiKeyBanner =
    apiKeyProvider != null && me?.apiKeys && !me.apiKeys[apiKeyProvider];

  if (loading && counts === null) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <DashboardSkeleton />
      </motion.div>
    );
  }

  if (error && counts === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-4">
            <p className="font-medium text-[var(--color-lightest)]">
              {t("dashboard.couldntLoadLogs")}
            </p>
            <p className="text-sm text-[var(--color-light)]">{error}</p>
            <Button
              onClick={fetchCounts}
            >
              {t("common.tryAgain")}
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      {needsApiKeyBanner && (
        <Link
          to="/settings?open=api-keys"
          className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-left no-underline transition-colors text-[var(--color-warning-text)] hover:border-[var(--color-warning-hover-border)] hover:bg-[var(--color-warning-hover-bg)]"
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-[var(--color-warning-icon)]" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-warning-text)]">
            {t("apiKeyBanner.categoryMessage", {
              category: t(`nav.${selectedCategory}`),
              provider: API_KEY_META[apiKeyProvider].name,
            })}
          </p>
          <span className="shrink-0 text-xs font-medium text-[var(--color-warning-text-muted)]">
            {t("apiKeyBanner.addKeyInSettings")} →
          </span>
        </Link>
      )}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-[var(--color-lightest)] sm:text-2xl">
          {t("dashboard.title")}
        </h2>
        {me?.user?.id && (
          <Button type="button" variant="outline" size="sm" onClick={handleShare} aria-label={t("dashboard.share")}>
            <Share2 className="size-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t("dashboard.share")}</span>
          </Button>
        )}
      </div>

      {visibleTypes.length > 0 && (
        <section
          aria-label={t("dashboard.category")}
          className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]"
        >
          {/* Category selector: mobile swipeable tabs, desktop toggle group */}
          <div className="flex min-w-0 w-full shrink-0 justify-center overflow-hidden">
            {/* Mobile: swipeable tab strip */}
            <div
              className="flex md:hidden min-w-0 flex-1 overflow-x-auto overflow-y-hidden gap-2 py-1 scroll-smooth touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label={t("dashboard.category")}
            >
              {visibleTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === type}
                  aria-label={`${t(`nav.${type}`)} (${byType[type] ?? 0})`}
                  onClick={() => setCategory(type as MediaType)}
                  className={
                    selectedCategory === type
                      ? "btn-gradient flex-shrink-0 rounded-full px-4 py-2.5 text-sm font-medium text-[var(--btn-text)] transition-colors whitespace-nowrap"
                      : "flex-shrink-0 rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-dark)] px-4 py-2.5 text-sm font-medium text-[var(--color-light)] transition-colors whitespace-nowrap"
                  }
                >
                  {t(`nav.${type}`)} ({byType[type] ?? 0})
                </button>
              ))}
            </div>
            {/* Desktop: toggle group */}
            <ToggleGroup
              type="single"
              value={selectedCategory}
              onValueChange={(v) => v && setCategory(v as MediaType)}
              className="hidden md:inline-flex flex-wrap justify-center gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-2 md:w-fit"
              aria-label={t("dashboard.category")}
            >
              {visibleTypes.map((type) => (
                <ToggleGroupItem
                  key={type}
                  value={type}
                  className="rounded-md px-4 py-3 text-sm data-[state=on]:bg-gradient-to-br data-[state=on]:from-[var(--btn-gradient-start)] data-[state=on]:to-[var(--btn-gradient-end)] data-[state=on]:text-[var(--btn-text)] md:px-3 md:py-2"
                  aria-label={`${t(`nav.${type}`)} (${byType[type] ?? 0})`}
                >
                  {t(`nav.${type}`)} ({byType[type] ?? 0})
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <MediaLogs mediaType={selectedCategory} embedded />
        </section>
      )}

      {token && (
        <section aria-label={t("social.sectionTitle")} className="flex min-w-0 flex-col gap-4 overflow-hidden">
          <h2 className="text-lg font-semibold text-[var(--color-lightest)]">
            {t("social.sectionTitle")}
          </h2>
          {feedLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex min-w-0 gap-3 overflow-hidden rounded-md border border-[var(--color-dark)] bg-[var(--color-dark)] p-4 animate-pulse"
                >
                  <div className="h-12 w-9 shrink-0 rounded bg-[var(--color-mid)]/30" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-[var(--color-mid)]/30" />
                    <div className="h-3 w-1/4 rounded bg-[var(--color-mid)]/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : feed.length === 0 ? (
            <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-sm)]">
              <p className="text-center text-[var(--color-light)]">
                {t("social.emptyFeed")}
              </p>
              <Link
                to="/search"
                className="mt-3 flex justify-center text-sm text-[var(--color-lightest)] underline hover:no-underline"
              >
                {t("social.findUsers")}
              </Link>
            </Card>
          ) : (
            <motion.ul
              className="list-none m-0 min-w-0 p-0"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <div className="flex min-w-0 flex-col gap-2">
                {feed.map(({ log, user }) => (
                  <motion.li key={log.id} variants={staggerItem} className="list-none">
                    <motion.div whileTap={tapScale} transition={tapTransition}>
                      <Link
                        to={`/${user.username ?? user.id}`}
                        className="flex min-w-0 gap-3 overflow-hidden rounded-md border border-[var(--color-dark)] bg-[var(--color-dark)] p-4 text-inherit no-underline"
                        style={paperShadow}
                      >
                        <ItemImage src={log.image} className="h-12 w-9 shrink-0 rounded" />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                          <p className="min-w-0 truncate font-medium text-[var(--color-lightest)]">
                            {log.title}
                          </p>
                          <p className="text-xs text-[var(--color-light)]">
                            {user.username ?? t("social.userWithoutUsername")} · {t(`nav.${log.mediaType}`)}
                          </p>
                          {log.genres && log.genres.length > 0 && (
                            <GenreBadges genres={log.genres} maxCount={1} />
                          )}
                          <div className="flex shrink-0 items-center gap-2 mt-0.5">
                            {log.startedAt && log.completedAt && (
                              <span className="whitespace-nowrap text-xs text-[var(--color-light)]">
                                {t("dashboard.finishedIn", {
                                  duration: formatTimeToFinish(log.startedAt, log.completedAt),
                                })}
                              </span>
                            )}
                            {log.grade != null ? (
                              <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                            ) : (
                              <span className="text-[var(--color-light)]">—</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  </motion.li>
                ))}
              </div>
            </motion.ul>
          )}
        </section>
      )}
    </div>
  );
}
