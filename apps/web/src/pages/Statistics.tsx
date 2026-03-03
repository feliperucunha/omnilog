import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { apiFetch, apiFetchCached, apiFetchFile } from "@/lib/api";
import { StatisticsSkeleton } from "@/components/skeletons";
import { ItemImage } from "@/components/ItemImage";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { type Log, type MediaType } from "@logeverything/shared";
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

const paperShadow = { boxShadow: "var(--shadow-sm)" };

const STORAGE_KEY_STATS = "logeverything.statistics.statsCollapsed";
const STORAGE_KEY_RECENT = "logeverything.statistics.recentLogsCollapsed";

function getStoredCollapsed(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

type StatsGroup = "category" | "month" | "year";
interface StatsEntry {
  period: string;
  hours: number;
}

export function Statistics() {
  const { t } = useLocale();
  const { me } = useMe();
  const { visibleTypes } = useVisibleMediaTypes();
  const isPro = me?.tier === "pro";
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsGroup, setStatsGroup] = useState<StatsGroup>("category");
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsCollapsed, setStatsCollapsedState] = useState(() => getStoredCollapsed(STORAGE_KEY_STATS));
  const [recentLogsCollapsed, setRecentLogsCollapsedState] = useState(() => getStoredCollapsed(STORAGE_KEY_RECENT));
  const [showProModal, setShowProModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const setStatsCollapsed = useCallback((value: boolean) => {
    setStatsCollapsedState(value);
    try {
      localStorage.setItem(STORAGE_KEY_STATS, String(value));
    } catch {
      // ignore
    }
  }, []);

  const setRecentLogsCollapsed = useCallback((value: boolean) => {
    setRecentLogsCollapsedState(value);
    try {
      localStorage.setItem(STORAGE_KEY_RECENT, String(value));
    } catch {
      // ignore
    }
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

  useEffect(() => {
    if (isPro) fetchStats(statsGroup);
  }, [isPro, statsGroup, fetchStats]);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    apiFetchCached<Log[] | { data: Log[]; nextCursor: string | null }>("/logs?limit=10&sort=date", {
      ttlMs: 2 * 60 * 1000,
    })
      .then((res) => setLogs(Array.isArray(res) ? res : res.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

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

  const recent = logs.slice(0, 10); // API returns up to 10 when using limit=10
  const displayedStats =
    statsGroup === "category"
      ? stats.filter((s) => visibleTypes.includes(s.period as MediaType))
      : stats;
  const maxHours = displayedStats.length > 0 ? Math.max(...displayedStats.map((s) => s.hours), 1) : 1;

  if (isPro && loading && logs.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        <StatisticsSkeleton />
      </motion.div>
    );
  }

  const handleExportClick = () => {
    if (!isPro) {
      setShowProModal(true);
      return;
    }
    setExporting(true);
    apiFetchFile("/logs/export")
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t("tiers.exportSuccess"));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : t("tiers.exportFailed")))
      .finally(() => setExporting(false));
  };

  return (
    <div className="relative flex min-w-0 flex-col gap-8 overflow-x-hidden">
      <Dialog open={showProModal} onOpenChange={setShowProModal}>
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

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-[var(--color-lightest)] sm:text-2xl">
          {t("nav.statistics")}
        </h2>
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
      </div>

      <div className={!isPro ? "pointer-events-none select-none blur-sm" : ""}>
      <section aria-label={t("dashboard.calendarTitle")} className="min-w-0 overflow-hidden">
        <DashboardCalendar isPro={isPro} />
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-8 overflow-hidden md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <button
            type="button"
            onClick={() => setStatsCollapsed(!statsCollapsed)}
            className="flex w-full items-center gap-2 rounded-lg text-left text-sm font-medium uppercase text-[var(--color-light)] hover:bg-[var(--color-mid)]/20 hover:text-[var(--color-lightest)]"
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
              <Card className="min-w-0 border-[var(--color-dark)] bg-[var(--color-dark)] p-4" style={paperShadow}>
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
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left text-sm font-medium uppercase text-[var(--color-light)] hover:bg-[var(--color-mid)]/20 hover:text-[var(--color-lightest)]"
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
                <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6" style={paperShadow}>
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
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
