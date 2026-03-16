import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { apiFetch, apiFetchCached, apiFetchFile, downloadFile } from "@/lib/api";
import { StatisticsSkeleton } from "@/components/skeletons";
import { ItemImage } from "@/components/ItemImage";
import { GenreBadges } from "@/components/GenreBadges";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { IN_PROGRESS_STATUSES, type Log } from "@dogument/shared";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DashboardCalendar } from "@/components/DashboardCalendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as storage from "@/lib/storage";

const paperShadow = { boxShadow: "var(--shadow-sm)" };

const STORAGE_KEY_STATS = "dogument.statistics.statsCollapsed";
const STORAGE_KEY_RECENT = "dogument.statistics.recentLogsCollapsed";

type StatsGroup = "category" | "month" | "year";
type GenreGraphMode = "genre" | "statusOverTime" | "byCategory";
type StatusOverTimeGroup = "month" | "year";
interface StatsEntry {
  period: string;
  hours: number;
}
/** For categoryByMonth / categoryByYear API response */
interface CategoryOverTimeEntry {
  period: string;
  mediaType: string;
  hours: number;
}

export function Statistics() {
  const { t } = useLocale();
  const { me } = useMe();
  const { visibleTypes } = useVisibleMediaTypes();
  const { setPageTitle, setRightSlot } = usePageTitle() ?? {};
  const isPro = me?.tier === "pro" || me?.tier === "admin";
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsGroup, setStatsGroup] = useState<StatsGroup>("category");
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [genreStats, setGenreStats] = useState<StatsEntry[]>([]);
  const [genreStatsLoading, setGenreStatsLoading] = useState(true);
  const [genreGraphMode, setGenreGraphMode] = useState<GenreGraphMode>("genre");
  const [statusOverTimeGroup, setStatusOverTimeGroup] = useState<StatusOverTimeGroup>("month");
  const [statusOverTimeStats, setStatusOverTimeStats] = useState<StatsEntry[]>([]);
  const [statusOverTimeLoading, setStatusOverTimeLoading] = useState(true);
  const [categoryOverTimeGroup, setCategoryOverTimeGroup] = useState<StatusOverTimeGroup>("month");
  const [categoryOverTimeStats, setCategoryOverTimeStats] = useState<CategoryOverTimeEntry[]>([]);
  const [categoryOverTimeLoading, setCategoryOverTimeLoading] = useState(true);
  const [statsCollapsed, setStatsCollapsedState] = useState(false);
  const [recentLogsCollapsed, setRecentLogsCollapsedState] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      storage.getItem(STORAGE_KEY_STATS),
      storage.getItem(STORAGE_KEY_RECENT),
    ]).then(([statsVal, recentVal]) => {
      if (cancelled) return;
      if (statsVal === "true") setStatsCollapsedState(true);
      if (recentVal === "true") setRecentLogsCollapsedState(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setStatsCollapsed = useCallback((value: boolean) => {
    setStatsCollapsedState(value);
    void storage.setItem(STORAGE_KEY_STATS, String(value));
  }, []);

  const setRecentLogsCollapsed = useCallback((value: boolean) => {
    setRecentLogsCollapsedState(value);
    void storage.setItem(STORAGE_KEY_RECENT, String(value));
  }, []);

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

  const fetchGenreStats = useCallback(async () => {
    setGenreStatsLoading(true);
    try {
      const res = await apiFetch<{ data: StatsEntry[] }>("/logs/stats?group=genre");
      setGenreStats(res.data ?? []);
    } catch {
      setGenreStats([]);
    } finally {
      setGenreStatsLoading(false);
    }
  }, []);

  const fetchStatusOverTimeStats = useCallback(async (group: "completedByMonth" | "completedByYear") => {
    setStatusOverTimeLoading(true);
    try {
      const res = await apiFetch<{ data: StatsEntry[] }>(`/logs/stats?group=${group}`);
      setStatusOverTimeStats(res.data ?? []);
    } catch {
      setStatusOverTimeStats([]);
    } finally {
      setStatusOverTimeLoading(false);
    }
  }, []);

  const fetchCategoryOverTimeStats = useCallback(async (group: "categoryByMonth" | "categoryByYear") => {
    setCategoryOverTimeLoading(true);
    try {
      const res = await apiFetch<{ data: CategoryOverTimeEntry[] }>(`/logs/stats?group=${group}`);
      setCategoryOverTimeStats(res.data ?? []);
    } catch {
      setCategoryOverTimeStats([]);
    } finally {
      setCategoryOverTimeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPro) fetchStats(statsGroup);
  }, [isPro, statsGroup, fetchStats]);

  useEffect(() => {
    if (isPro) fetchGenreStats();
  }, [isPro, fetchGenreStats]);

  useEffect(() => {
    if (isPro && genreGraphMode === "statusOverTime") {
      fetchStatusOverTimeStats(statusOverTimeGroup === "year" ? "completedByYear" : "completedByMonth");
    }
  }, [isPro, genreGraphMode, statusOverTimeGroup, fetchStatusOverTimeStats]);

  useEffect(() => {
    if (isPro && genreGraphMode === "byCategory") {
      fetchCategoryOverTimeStats(categoryOverTimeGroup === "year" ? "categoryByYear" : "categoryByMonth");
    }
  }, [isPro, genreGraphMode, categoryOverTimeGroup, fetchCategoryOverTimeStats]);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    apiFetchCached<Log[] | { data: Log[]; nextCursor: string | null }>("/logs?limit=5&sort=date", {
      ttlMs: 2 * 60 * 1000,
    })
      .then((res) => setLogs(Array.isArray(res) ? res : res.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const handleExportClick = useCallback(() => {
    if (!isPro) {
      setShowProModal(true);
      return;
    }
    setExporting(true);
    apiFetchFile("/logs/export")
      .then(({ blob, filename }) => downloadFile(blob, filename).then(() => toast.success(t("tiers.exportSuccess"))))
      .catch((err) => toast.error(err instanceof Error ? err.message : t("tiers.exportFailed")))
      .finally(() => setExporting(false));
  }, [isPro, t]);

  useEffect(() => {
    setPageTitle?.(t("nav.statistics"));
    setRightSlot?.(
      <Button
        variant="outline"
        size="sm"
        className="gap-2 shrink-0"
        onClick={handleExportClick}
        disabled={exporting}
        aria-label={t("tiers.exportLogs")}
      >
        <Download className="h-4 w-4" aria-hidden />
        {exporting ? t("common.saving") : t("tiers.exportLogs")}
      </Button>
    );
    return () => {
      setPageTitle?.(null);
      setRightSlot?.(null);
    };
  }, [t, setPageTitle, setRightSlot, handleExportClick, exporting]);

  useEffect(() => {
    if (isPro) fetchLogs();
    else {
      setLoading(false);
      setStatsLoading(false);
    }
  }, [isPro, fetchLogs]);

  useEffect(() => {
    if (!isPro) setShowProModal(true);
  }, [isPro]);

  const recent = logs.slice(0, 5); // Show only the 5 most recent logs
  const displayedStats =
    statsGroup === "category"
      ? visibleTypes.map((period) => ({
          period,
          hours: stats.find((s) => s.period === period)?.hours ?? 0,
        }))
      : stats;
  const maxHours = displayedStats.length > 0 ? Math.max(...displayedStats.map((s) => s.hours), 1) : 1;
  const maxGenreCount =
    genreStats.length > 0 ? Math.max(...genreStats.map((s) => s.hours), 1) : 1;
  const maxStatusOverTimeCount =
    statusOverTimeStats.length > 0 ? Math.max(...statusOverTimeStats.map((s) => s.hours), 1) : 1;
  const maxCategoryOverTimeCount =
    categoryOverTimeStats.length > 0 ? Math.max(...categoryOverTimeStats.map((s) => s.hours), 1) : 1;
  const categoryOverTimeByPeriod = categoryOverTimeStats.reduce<Record<string, CategoryOverTimeEntry[]>>(
    (acc, entry) => {
      if (!acc[entry.period]) acc[entry.period] = [];
      acc[entry.period].push(entry);
      return acc;
    },
    {}
  );
  const categoryOverTimePeriods = Object.keys(categoryOverTimeByPeriod).sort();

  if (isPro && loading && logs.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        <StatisticsSkeleton />
      </motion.div>
    );
  }

  return (
    <div className="relative flex min-w-0 flex-col gap-10 overflow-x-hidden">
      <Dialog open={showProModal && !isPro} onOpenChange={setShowProModal}>
        <DialogContent onClose={() => setShowProModal(false)}>
          <DialogHeader>
            <DialogTitle className="text-[var(--color-lightest)]">
              {t("statistics.proOnlyTitle")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-light)]">
            {t("statistics.proOnlyMessage")}
          </p>
          <Button asChild className="btn-gradient w-fit">
            <Link to="/tiers" onClick={() => setShowProModal(false)}>
              {t("tiers.upgradeToPro")}
            </Link>
          </Button>
        </DialogContent>
      </Dialog>

      <div className={`flex flex-col gap-12 ${!isPro ? "pointer-events-none select-none blur-sm" : ""}`}>
      <div className="grid min-w-0 grid-cols-1 gap-6 overflow-hidden md:grid-cols-2 md:gap-8">
        <section aria-label={t("dashboard.calendarTitle")} className="min-w-0 w-full">
          <DashboardCalendar isPro={isPro} />
        </section>
        <Card className="min-w-0 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4" style={paperShadow}>
          <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
            <Select
              value={genreGraphMode}
              onValueChange={(v) => setGenreGraphMode(v as GenreGraphMode)}
              options={[
                { value: "genre", label: t("dashboard.byGenre") },
                { value: "statusOverTime", label: t("dashboard.byStatusOverTime") },
                { value: "byCategory", label: t("dashboard.byCategory") },
              ]}
              aria-label={t("dashboard.byGenre")}
              className="w-full max-w-[220px]"
            />
            {genreGraphMode === "statusOverTime" && (
              <div className="ml-1 flex gap-1">
                <Button
                  variant={statusOverTimeGroup === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusOverTimeGroup("month")}
                >
                  {t("dashboard.byMonth")}
                </Button>
                <Button
                  variant={statusOverTimeGroup === "year" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusOverTimeGroup("year")}
                >
                  {t("dashboard.byYear")}
                </Button>
              </div>
            )}
            {genreGraphMode === "byCategory" && (
              <div className="ml-1 flex gap-1">
                <Button
                  variant={categoryOverTimeGroup === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryOverTimeGroup("month")}
                >
                  {t("dashboard.byMonth")}
                </Button>
                <Button
                  variant={categoryOverTimeGroup === "year" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryOverTimeGroup("year")}
                >
                  {t("dashboard.byYear")}
                </Button>
              </div>
            )}
          </div>
          {genreGraphMode === "genre" && (
            genreStatsLoading ? (
              <div className="h-48 animate-pulse rounded-md bg-[var(--color-darkest)]" />
            ) : genreStats.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-light)]">
                {t("dashboard.noStatsYet")}
              </p>
            ) : (
              <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
                {genreStats.map(({ period, hours }) => (
                  <div key={period} className="flex min-w-0 items-center gap-3">
                    <span className="min-w-0 max-w-[8rem] shrink-0 truncate text-xs text-[var(--color-light)]">
                      {period}
                    </span>
                    <div className="h-6 flex-1 min-w-0 rounded bg-[var(--color-darkest)]">
                      <div
                        className="h-full rounded bg-[var(--color-mid)]"
                        style={{ width: `${Math.max(5, (hours / maxGenreCount) * 100)}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-xs text-[var(--color-lightest)]">
                      {t("dashboard.logsCount", { count: String(Math.round(hours)) })}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
          {genreGraphMode === "statusOverTime" && (
            statusOverTimeLoading ? (
              <div className="h-48 animate-pulse rounded-md bg-[var(--color-darkest)]" />
            ) : statusOverTimeStats.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-light)]">
                {t("dashboard.noStatusOverTimeYet")}
              </p>
            ) : (
              <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
                {statusOverTimeStats.map(({ period, hours }) => (
                  <div key={period} className="flex min-w-0 items-center gap-3">
                    <span className="w-14 shrink-0 truncate text-xs text-[var(--color-light)] sm:w-20">
                      {statusOverTimeGroup === "year" ? period : period.slice(0, 7)}
                    </span>
                    <div className="h-6 flex-1 min-w-0 rounded bg-[var(--color-darkest)]">
                      <div
                        className="h-full rounded bg-[var(--color-mid)]"
                        style={{ width: `${Math.max(5, (hours / maxStatusOverTimeCount) * 100)}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs text-[var(--color-lightest)]">
                      {t("dashboard.completedCount", { count: String(Math.round(hours)) })}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
          {genreGraphMode === "byCategory" && (
            categoryOverTimeLoading ? (
              <div className="h-48 animate-pulse rounded-md bg-[var(--color-darkest)]" />
            ) : categoryOverTimePeriods.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-light)]">
                {t("dashboard.noStatsYet")}
              </p>
            ) : (
              <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
                {categoryOverTimePeriods.map((period) => (
                  <div key={period} className="flex min-w-0 flex-col gap-1.5">
                    <span className="shrink-0 text-xs font-medium text-[var(--color-light)]">
                      {categoryOverTimeGroup === "year" ? period : period.slice(0, 7)}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1 pl-0">
                      {(categoryOverTimeByPeriod[period] ?? []).map(({ mediaType, hours }) => (
                        <div key={`${period}-${mediaType}`} className="flex min-w-0 items-center gap-3">
                          <span className="min-w-0 max-w-[7rem] shrink-0 truncate text-xs text-[var(--color-light)]">
                            {t(`nav.${mediaType}`)}
                          </span>
                          <div className="h-5 flex-1 min-w-0 rounded bg-[var(--color-darkest)]">
                            <div
                              className="h-full rounded bg-[var(--color-mid)]"
                              style={{ width: `${Math.max(5, (hours / maxCategoryOverTimeCount) * 100)}%` }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs text-[var(--color-lightest)]">
                            {t("dashboard.logsCount", { count: String(Math.round(hours)) })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </Card>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-10 overflow-hidden md:grid-cols-2 md:gap-10">
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <button
            type="button"
            onClick={() => setStatsCollapsed(!statsCollapsed)}
            className="flex w-full items-center gap-2 rounded-lg py-2 max-md:min-h-[44px] max-md:py-3 text-left text-sm font-medium uppercase text-[var(--color-light)] hover:bg-[var(--color-mid)]/20 hover:text-[var(--color-lightest)] focus:outline-none"
            aria-expanded={!statsCollapsed}
          >
            {statsCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{t("dashboard.statsTitle")}</span>
          </button>
          {!statsCollapsed && (
            <>
              <Card className="min-w-0 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4" style={paperShadow}>
                <div className="flex min-w-0 flex-col gap-4 overflow-hidden">
                  <div className="md:hidden w-full min-w-0">
                    <Select
                      value={statsGroup}
                      onValueChange={(v) => setStatsGroup(v as StatsGroup)}
                      options={[
                        { value: "category", label: t("dashboard.byCategory") },
                        { value: "month", label: t("dashboard.byMonth") },
                        { value: "year", label: t("dashboard.byYear") },
                      ]}
                      aria-label={t("dashboard.statsTitle")}
                      className="min-w-0 w-full"
                      triggerClassName="w-full max-w-none min-w-0"
                    />
                  </div>
                  <div className="hidden md:flex flex-wrap gap-2">
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
                    <div className="h-48 animate-pulse rounded-md bg-[var(--color-darkest)]" />
                  ) : stats.length === 0 ? (
                    <p className="text-center text-sm text-[var(--color-light)]">
                      {t("dashboard.noStatsYet")}
                    </p>
                  ) : (
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
                  )}
                </div>
              </Card>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <button
            type="button"
            onClick={() => setRecentLogsCollapsed(!recentLogsCollapsed)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2 max-md:min-h-[44px] max-md:py-3 text-left text-sm font-medium uppercase text-[var(--color-light)] hover:bg-[var(--color-mid)]/20 hover:text-[var(--color-lightest)] focus:outline-none"
            aria-expanded={!recentLogsCollapsed}
          >
            {recentLogsCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{t("dashboard.recentLogs")}</span>
          </button>
          {!recentLogsCollapsed && (
            <>
              {recent.length === 0 ? (
                <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6" style={paperShadow}>
                  <p className="text-center text-[var(--color-light)]">
                    {t("dashboard.noLogsYet")}{" "}
                    <Link to="/search" className="text-[var(--color-lightest)] underline hover:no-underline">
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
                            className="flex min-w-0 gap-3 overflow-hidden rounded-md border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 text-inherit no-underline"
                            style={paperShadow}
                          >
                            <ItemImage src={log.image} className="h-12 w-9 shrink-0 rounded" />
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <p className="min-w-0 truncate font-medium text-[var(--color-lightest)]">
                                  {log.title}
                                </p>
                                <div className="flex shrink-0 items-center gap-2">
                                {(() => {
                                  const duration = log.startedAt && log.completedAt ? formatTimeToFinish(log.startedAt, log.completedAt) : "";
                                  return duration ? (
                                    <span className="whitespace-nowrap text-xs text-[var(--color-light)]">
                                      {t("dashboard.finishedIn", { duration })}
                                    </span>
                                  ) : null;
                                })()}
                                {log.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log.status) ? (
                                  <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-medium text-white">
                                    {t("common.inProgress")}
                                  </span>
                                ) : log.grade != null ? (
                                  <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                                ) : (
                                  <span className="text-[var(--color-light)]">—</span>
                                )}
                                </div>
                              </div>
                              {log.genres && log.genres.length > 0 && (
                                <GenreBadges genres={log.genres} maxCount={1} />
                              )}
                            </div>
                          </Link>
                        </motion.div>
                      </motion.li>
                    ))}
                  </div>
                </motion.ul>
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
