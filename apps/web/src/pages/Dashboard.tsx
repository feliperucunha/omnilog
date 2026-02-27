import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Share2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { apiFetch, apiFetchCached } from "@/lib/api";
import { DashboardSkeleton } from "@/components/skeletons";
import { CustomEntryForm } from "@/components/CustomEntryForm";
import { ItemImage } from "@/components/ItemImage";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { useLogComplete } from "@/contexts/LogCompleteContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import { MEDIA_TYPES, type Log, type MediaType } from "@logeverything/shared";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MediaLogs } from "@/pages/MediaLogs";

const paperShadow = { boxShadow: "var(--shadow-sm)" };

type StatsGroup = "category" | "month" | "year";
interface StatsEntry {
  period: string;
  hours: number;
}

export function Dashboard() {
  const { t } = useLocale();
  const { me } = useMe();
  const { showLogComplete } = useLogComplete();
  const { visibleTypes } = useVisibleMediaTypes();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const defaultCategory = visibleTypes.length > 0 ? visibleTypes[0] : ("movies" as MediaType);
  const [selectedCategory, setSelectedCategory] = useState<MediaType>(() => {
    if (categoryParam && MEDIA_TYPES.includes(categoryParam)) return categoryParam as MediaType;
    return defaultCategory;
  });
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsGroup, setStatsGroup] = useState<StatsGroup>("category");
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showCustomEntry, setShowCustomEntry] = useState(false);

  useEffect(() => {
    if (categoryParam && MEDIA_TYPES.includes(categoryParam)) setSelectedCategory(categoryParam as MediaType);
    else if (!categoryParam && visibleTypes.length > 0) setSelectedCategory(visibleTypes[0] as MediaType);
  }, [categoryParam, visibleTypes]);

  useEffect(() => {
    if (visibleTypes.length > 0 && !visibleTypes.includes(selectedCategory)) {
      setSelectedCategory(visibleTypes[0] as MediaType);
      setSearchParams({ category: visibleTypes[0] }, { replace: true });
    }
  }, [visibleTypes, selectedCategory, setSearchParams]);

  const setCategory = useCallback(
    (type: MediaType) => {
      setSelectedCategory(type);
      setSearchParams({ category: type }, { replace: true });
    },
    [setSearchParams]
  );

  const fetchStats = useCallback(async (group: StatsGroup) => {
    setStatsLoading(true);
    try {
      const res = await apiFetch<{ data: StatsEntry[] }>(`/logs/stats?group=${group}`);
      setStats(res.data ?? []);
    } catch {
      setStats([]);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(statsGroup);
  }, [statsGroup, fetchStats]);

  const fetchLogs = useCallback(() => {
    setError(null);
    setLoading(true);
    apiFetchCached<Log[]>("/logs", { ttlMs: 2 * 60 * 1000 })
      .then(setLogs)
      .catch((err) => {
        setLogs([]);
        setError(err instanceof Error ? err.message : t("dashboard.couldntLoadLogs"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleShare = useCallback(async () => {
    if (!me?.user?.id) return;
    const url = `${window.location.origin}/${me.user.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("dashboard.linkCopied"));
    } catch {
      toast.error(t("common.tryAgain"));
    }
  }, [me?.user?.id, t]);

  const recent = logs.slice(0, 10);
  const displayedStats =
    statsGroup === "category"
      ? stats.filter((s) => visibleTypes.includes(s.period as MediaType))
      : stats;
  const maxHours = displayedStats.length > 0 ? Math.max(...displayedStats.map((s) => s.hours), 1) : 1;
  const byType = Object.fromEntries(
    MEDIA_TYPES.map((type) => [
      type,
      logs.filter((l) => l.mediaType === type).length,
    ])
  );

  const boardGameProvider = me?.boardGameProvider ?? "bgg";
  const apiKeyProvider = getApiKeyProviderForMediaType(selectedCategory, boardGameProvider);
  const needsApiKeyBanner =
    apiKeyProvider != null && me?.apiKeys && !me.apiKeys[apiKeyProvider];

  if (loading && logs.length === 0) {
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

  if (error && logs.length === 0) {
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
              onClick={fetchLogs}
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
        <h1 className="text-2xl font-bold text-[var(--color-lightest)]">
          {t("dashboard.title")}
        </h1>
        {me?.user?.id && (
          <Button type="button" variant="outline" size="sm" onClick={handleShare} aria-label={t("dashboard.share")}>
            <Share2 className="size-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t("dashboard.share")}</span>
          </Button>
        )}
      </div>

      {visibleTypes.length > 0 && (
        <div className="flex min-w-0 justify-center overflow-hidden">
          <ToggleGroup
            type="single"
            value={selectedCategory}
            onValueChange={(v) => v && setCategory(v as MediaType)}
            className="inline-flex flex-wrap justify-center gap-2 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-2 w-full md:w-fit md:gap-1 md:p-1"
            aria-label={t("dashboard.category")}
          >
            {visibleTypes.map((type) => (
              <ToggleGroupItem
                key={type}
                value={type}
                className="rounded-md px-4 py-3 text-sm data-[state=on]:bg-[var(--color-mid)]/50 md:px-3 md:py-2"
                aria-label={`${t(`nav.${type}`)} (${byType[type] ?? 0})`}
              >
                {t(`nav.${type}`)} ({byType[type] ?? 0})
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {visibleTypes.length > 0 && (
        <section aria-label={t(`nav.${selectedCategory}`)} className="min-w-0 overflow-hidden">
          <MediaLogs mediaType={selectedCategory} embedded />
        </section>
      )}

      <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
        <p className="text-sm font-medium uppercase text-[var(--color-light)]">
          {t("dashboard.statsTitle")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={statsGroup === "category" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatsGroup("category")}
          >
            {t("dashboard.byCategory")}
          </Button>
          <Button
            variant={statsGroup === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatsGroup("month")}
          >
            {t("dashboard.byMonth")}
          </Button>
          <Button
            variant={statsGroup === "year" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatsGroup("year")}
          >
            {t("dashboard.byYear")}
          </Button>
        </div>
        {statsLoading ? (
          <div className="h-48 animate-pulse rounded-md bg-[var(--color-dark)]" />
        ) : stats.length === 0 ? (
          <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6" style={paperShadow}>
            <p className="text-center text-sm text-[var(--color-light)]">
              {t("dashboard.noStatsYet")}
            </p>
          </Card>
        ) : (
          <Card className="min-w-0 border-[var(--color-dark)] bg-[var(--color-dark)] p-4" style={paperShadow}>
            <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
              {displayedStats.map(({ period, hours }) => (
                <div key={period} className="flex min-w-0 items-center gap-3">
                  <span
                    className={
                      statsGroup === "category"
                        ? "min-w-0 max-w-[5.5rem] shrink-0 truncate text-xs text-[var(--color-light)] sm:min-w-[5.5rem] sm:max-w-[8rem]"
                        : "w-14 shrink-0 truncate text-xs text-[var(--color-light)] sm:w-20"
                    }
                  >
                    {statsGroup === "category"
                      ? t(`nav.${period}`)
                      : statsGroup === "year"
                        ? period
                        : period.slice(0, 7)}
                  </span>
                  <div className="h-6 flex-1 min-w-0 rounded bg-[var(--color-darkest)]">
                    <div
                      className="h-full rounded bg-[var(--color-mid)]"
                      style={{ width: `${Math.max(5, (hours / maxHours) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs text-[var(--color-lightest)]">
                    {t("dashboard.hoursConsumed", { hours: hours.toFixed(1) })}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium uppercase text-[var(--color-light)]">
            {t("dashboard.recentLogs")}
          </p>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCustomEntry(true)}
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="size-4 shrink-0" aria-hidden />
                {t("customEntry.addCustomEntry")}
              </span>
            </Button>
          </div>
        </div>
        {showCustomEntry && (
          <CustomEntryForm
            onSaved={(completion) => {
              setShowCustomEntry(false);
              if (completion) showLogComplete(completion);
            }}
            onCancel={() => setShowCustomEntry(false)}
          />
        )}
        {recent.length === 0 ? (
          <Card
            className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6"
            style={paperShadow}
          >
            <p className="text-center text-[var(--color-light)]">
              {t("dashboard.noLogsYet")}{" "}
              <Link
                to="/search"
                className="text-[var(--color-lightest)] underline hover:no-underline"
              >
                {t("dashboard.searchAndAddFirst")}
              </Link>
            </p>
          </Card>
        ) : (
          <motion.ul
            className="list-none m-0 min-w-0 p-0"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <div className="flex min-w-0 flex-col gap-2">
              {recent.map((log) => (
                <motion.li key={log.id} variants={staggerItem} className="list-none">
                  <motion.div whileTap={tapScale} transition={tapTransition}>
                    <Link
                      to={`/item/${log.mediaType}/${log.externalId}`}
                      className="flex min-w-0 gap-3 overflow-hidden rounded-md border border-[var(--color-dark)] bg-[var(--color-dark)] p-4 text-inherit no-underline"
                      style={paperShadow}
                    >
                      <ItemImage src={log.image} className="h-12 w-9 shrink-0 rounded" />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden">
                        <p className="min-w-0 truncate font-medium text-[var(--color-lightest)]">
                          {log.title}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          {log.startedAt && log.completedAt && (
                            <span className="whitespace-nowrap text-xs text-[var(--color-light)]">
                              {t("dashboard.finishedIn", { duration: formatTimeToFinish(log.startedAt, log.completedAt) })}
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
      </div>
    </div>
  );
}
