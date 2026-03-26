import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, CircleCheck, Clock, Download, Layers, Star, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { apiFetch, apiFetchCached, apiFetchFile, downloadFile } from "@/lib/api";
import {
  StatisticsSummarySkeleton,
  StatisticsBarsSkeleton,
  StatisticsCategoryOverTimeSkeleton,
  StatisticsRecentLogsSkeleton,
} from "@/components/skeletons";
import { ItemImage } from "@/components/ItemImage";
import { GenreBadges } from "@/components/GenreBadges";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { tierHasProFeatures } from "@/lib/userTier";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, SPEND_TRACKED_MEDIA_TYPES, type Log } from "@geeklogs/shared";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToBeatHours, formatTimeToFinish } from "@/lib/formatDuration";
import { getStatusLabel } from "@/lib/statusLabel";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DashboardCalendar } from "@/components/DashboardCalendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import * as storage from "@/lib/storage";
import { paperShadow } from "@/lib/paperShadow";
import { currencyMinorDecimals } from "@/lib/moneyInput";

function formatMinorAsMoney(minor: number, currency: string): string {
  const d = currencyMinorDecimals(currency);
  const n = minor / 10 ** d;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
}

type PurchasePeriod = "month" | "year" | "all";

const STORAGE_KEY_STATS = "geeklogs.statistics.statsCollapsed";
const STORAGE_KEY_RECENT = "geeklogs.statistics.recentLogsCollapsed";
const STORAGE_KEY_SUMMARY = "geeklogs.statistics.summaryCollapsed";
const STORAGE_KEY_PURCHASE = "geeklogs.statistics.purchaseCollapsed";
const STORAGE_KEY_CALENDAR = "geeklogs.statistics.calendarCollapsed";
const STORAGE_KEY_CHARTS = "geeklogs.statistics.chartsCollapsed";

type StatsGroup = "category" | "month" | "year";
type GenreGraphMode = "genre" | "statusOverTime" | "byCategory";
type StatusOverTimeGroup = "month" | "year";
interface StatsEntry {
  period: string;
  hours: number;
  /** Logs that contributed to this bucket (hours rollups) or completion/tag counts (charts). */
  count?: number;
}
/** For categoryByMonth / categoryByYear API response */
interface CategoryOverTimeEntry {
  period: string;
  mediaType: string;
  hours: number;
  count?: number;
}

/** GET /logs/stats?group=summary */
interface LogStatsSummary {
  totalLogs: number;
  completedLogs: number;
  reviewedLogs: number;
  totalContentHours: number;
  completedLogsWithHours: number;
}

const EMPTY_SUMMARY: LogStatsSummary = {
  totalLogs: 0,
  completedLogs: 0,
  reviewedLogs: 0,
  totalContentHours: 0,
  completedLogsWithHours: 0,
};

export function Statistics() {
  const { t } = useLocale();
  const { me } = useMe();
  const { visibleTypes } = useVisibleMediaTypes();
  const { setPageTitle, setRightSlot } = usePageTitle() ?? {};
  const isPro = tierHasProFeatures(me?.tier);
  const [logs, setLogs] = useState<Log[]>([]);
  const [summary, setSummary] = useState<LogStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsGroup, setStatsGroup] = useState<StatsGroup>("category");
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [genreStats, setGenreStats] = useState<StatsEntry[]>([]);
  const [genreStatsLoading, setGenreStatsLoading] = useState(true);
  const [genreGraphMode, setGenreGraphMode] = useState<GenreGraphMode>("byCategory");
  const [statusOverTimeGroup, setStatusOverTimeGroup] = useState<StatusOverTimeGroup>("month");
  const [statusOverTimeStats, setStatusOverTimeStats] = useState<StatsEntry[]>([]);
  const [statusOverTimeLoading, setStatusOverTimeLoading] = useState(true);
  const [categoryOverTimeGroup, setCategoryOverTimeGroup] = useState<StatusOverTimeGroup>("month");
  const [categoryOverTimeStats, setCategoryOverTimeStats] = useState<CategoryOverTimeEntry[]>([]);
  const [categoryOverTimeLoading, setCategoryOverTimeLoading] = useState(true);
  const [statsCollapsed, setStatsCollapsedState] = useState(false);
  const [recentLogsCollapsed, setRecentLogsCollapsedState] = useState(false);
  const [summaryCollapsed, setSummaryCollapsedState] = useState(false);
  const [purchaseCollapsed, setPurchaseCollapsedState] = useState(false);
  const [calendarCollapsed, setCalendarCollapsedState] = useState(false);
  const [chartsCollapsed, setChartsCollapsedState] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [purchasePeriod, setPurchasePeriod] = useState<PurchasePeriod>("month");
  const [purchaseSpending, setPurchaseSpending] = useState<Record<string, Record<string, number>> | null>(
    null
  );
  /** Log rows counted per spend-tracked category (same period as spending). */
  const [purchaseItemCounts, setPurchaseItemCounts] = useState<Record<string, number> | null>(null);
  const [purchaseSpendingLoading, setPurchaseSpendingLoading] = useState(true);
  const [spendDetailMediaType, setSpendDetailMediaType] = useState<string | null>(null);
  const [spendDetailLogs, setSpendDetailLogs] = useState<Log[]>([]);
  const [spendDetailLoading, setSpendDetailLoading] = useState(false);

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      storage.getItem(STORAGE_KEY_STATS),
      storage.getItem(STORAGE_KEY_RECENT),
      storage.getItem(STORAGE_KEY_SUMMARY),
      storage.getItem(STORAGE_KEY_PURCHASE),
      storage.getItem(STORAGE_KEY_CALENDAR),
      storage.getItem(STORAGE_KEY_CHARTS),
    ]).then(([statsVal, recentVal, summaryVal, purchaseVal, calendarVal, chartsVal]) => {
      if (cancelled) return;
      if (statsVal === "true") setStatsCollapsedState(true);
      if (recentVal === "true") setRecentLogsCollapsedState(true);
      if (summaryVal === "true") setSummaryCollapsedState(true);
      if (purchaseVal === "true") setPurchaseCollapsedState(true);
      if (calendarVal === "true") setCalendarCollapsedState(true);
      if (chartsVal === "true") setChartsCollapsedState(true);
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

  const setSummaryCollapsed = useCallback((value: boolean) => {
    setSummaryCollapsedState(value);
    void storage.setItem(STORAGE_KEY_SUMMARY, String(value));
  }, []);

  const setPurchaseCollapsed = useCallback((value: boolean) => {
    setPurchaseCollapsedState(value);
    void storage.setItem(STORAGE_KEY_PURCHASE, String(value));
  }, []);

  const setCalendarCollapsed = useCallback((value: boolean) => {
    setCalendarCollapsedState(value);
    void storage.setItem(STORAGE_KEY_CALENDAR, String(value));
  }, []);

  const setChartsCollapsed = useCallback((value: boolean) => {
    setChartsCollapsedState(value);
    void storage.setItem(STORAGE_KEY_CHARTS, String(value));
  }, []);

  const collapsibleSectionBtnClass =
    "flex w-full items-center gap-2 rounded-lg py-2 max-md:min-h-[44px] max-md:py-3 text-left text-sm font-medium uppercase text-[var(--color-light)] hover:bg-[var(--color-mid)]/20 hover:text-[var(--color-lightest)] focus:outline-none";

  /** Bar charts: same label column and track height as the time consumed (stats) widget. */
  const statBarGridClass =
    "grid w-full min-w-0 grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto]";
  const statBarTrackClass = "h-6 min-w-0 rounded bg-[var(--color-darkest)]";
  const statBarFillClass = "h-full rounded bg-[var(--color-mid)]";
  const statBarLabelTextClass = "min-w-0 truncate text-xs text-[var(--color-light)]";
  const statBarValueClass = "shrink-0 text-right text-xs tabular-nums text-[var(--color-lightest)]";

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

  const fetchPurchaseSpending = useCallback(async () => {
    setPurchaseSpendingLoading(true);
    try {
      const res = await apiFetch<{
        data: Record<string, Record<string, number>>;
        counts?: Record<string, number>;
      }>(`/logs/stats?group=purchaseSpending&period=${purchasePeriod}&timezoneOffsetMinutes=${tzOffsetMinutes}`);
      setPurchaseSpending(res.data ?? null);
      setPurchaseItemCounts(res.counts ?? null);
    } catch {
      setPurchaseSpending(null);
      setPurchaseItemCounts(null);
    } finally {
      setPurchaseSpendingLoading(false);
    }
  }, [purchasePeriod, tzOffsetMinutes]);

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

  useEffect(() => {
    if (isPro) void fetchPurchaseSpending();
  }, [isPro, fetchPurchaseSpending]);

  useEffect(() => {
    if (!spendDetailMediaType) {
      setSpendDetailLogs([]);
      setSpendDetailLoading(false);
      return;
    }
    let cancelled = false;
    setSpendDetailLoading(true);
    const params = new URLSearchParams({
      mediaType: spendDetailMediaType,
      purchased: "true",
      spendPeriod: purchasePeriod,
      timezoneOffsetMinutes: String(tzOffsetMinutes),
      sort: "dateDesc",
      limit: "100",
    });
    void apiFetch<{ data: Log[]; nextCursor: string | null }>(`/logs?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setSpendDetailLogs(res.data ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setSpendDetailLogs([]);
        showErrorToast(t, "E010", { originalError: err });
      })
      .finally(() => {
        if (!cancelled) setSpendDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spendDetailMediaType, purchasePeriod, tzOffsetMinutes, t]);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetchCached<Log[] | { data: Log[]; nextCursor: string | null }>("/logs?limit=5&sort=date", {
        ttlMs: 2 * 60 * 1000,
      }).then((res) => setLogs(Array.isArray(res) ? res : res.data)),
      apiFetch<{ data: LogStatsSummary }>("/logs/stats?group=summary")
        .then((res) => setSummary(res.data ?? null))
        .catch(() => setSummary(null)),
    ])
      .catch(() => {
        setLogs([]);
        setSummary(null);
      })
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
      .catch((err) => showErrorToast(t, "E010", { originalError: err }))
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
      setSummary(null);
    }
  }, [isPro, fetchLogs]);

  useEffect(() => {
    if (!isPro) setShowProModal(true);
  }, [isPro]);

  const recent = logs.slice(0, 5); // Show only the 5 most recent logs
  const displayedStats =
    statsGroup === "category"
      ? visibleTypes.map((period) => {
          const row = stats.find((s) => s.period === period);
          return {
            period,
            hours: row?.hours ?? 0,
            count: row?.count ?? 0,
          };
        })
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

  const summaryData = summary ?? EMPTY_SUMMARY;

  const totalPurchaseItems = useMemo(() => {
    if (!purchaseItemCounts) return 0;
    return SPEND_TRACKED_MEDIA_TYPES.reduce((acc, mt) => acc + (purchaseItemCounts[mt] ?? 0), 0);
  }, [purchaseItemCounts]);

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
      {isPro && loading && <StatisticsSummarySkeleton />}
      {isPro && !loading && (
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <button
            type="button"
            onClick={() => setSummaryCollapsed(!summaryCollapsed)}
            className={collapsibleSectionBtnClass}
            aria-expanded={!summaryCollapsed}
          >
            {summaryCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{t("statistics.summaryTitle")}</span>
          </button>
          {!summaryCollapsed && (
        <section
          aria-label={t("statistics.summaryTitle")}
          className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
        >
          <Card
            className="flex min-h-[5.5rem] min-w-0 flex-col justify-center border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
            style={paperShadow}
          >
            <div className="flex items-start gap-2">
              <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mid)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
                  {t("statistics.summaryTotalLogs")}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-lightest)] sm:text-2xl">
                  {summaryData.totalLogs}
                </p>
              </div>
            </div>
          </Card>
          <Card
            className="flex min-h-[5.5rem] min-w-0 flex-col justify-center border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
            style={paperShadow}
          >
            <div className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mid)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
                  {t("statistics.summaryCompleted")}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-lightest)] sm:text-2xl">
                  {summaryData.completedLogs}
                </p>
              </div>
            </div>
          </Card>
          <Card
            className="flex min-h-[5.5rem] min-w-0 flex-col justify-center border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
            style={paperShadow}
          >
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mid)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
                  {t("statistics.summaryHours")}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-lightest)] sm:text-2xl">
                  {summaryData.totalContentHours.toFixed(1)}
                </p>
                {summaryData.completedLogsWithHours > 0 && (
                  <p className="mt-1 text-xs tabular-nums text-[var(--color-light)]">
                    {t(
                      summaryData.completedLogsWithHours === 1
                        ? "statistics.summaryHoursItems_one"
                        : "statistics.summaryHoursItems_other",
                      { count: String(summaryData.completedLogsWithHours) }
                    )}
                  </p>
                )}
              </div>
            </div>
          </Card>
          <Card
            className="flex min-h-[5.5rem] min-w-0 flex-col justify-center border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
            style={paperShadow}
          >
            <div className="flex items-start gap-2">
              <Star className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mid)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
                  Com nota
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-lightest)] sm:text-2xl">
                  {summaryData.reviewedLogs}
                </p>
              </div>
            </div>
          </Card>
        </section>
          )}
        </div>
      )}

      {isPro && !loading && (
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <button
            type="button"
            onClick={() => setPurchaseCollapsed(!purchaseCollapsed)}
            className={collapsibleSectionBtnClass}
            aria-expanded={!purchaseCollapsed}
          >
            {purchaseCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{t("statistics.purchaseSpendingTitle")}</span>
          </button>
          {!purchaseCollapsed && (
        <section
          aria-label={t("statistics.purchaseSpendingTitle")}
          className="min-w-0 w-full"
        >
          <Card
            className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 md:p-5"
            style={paperShadow}
          >
            <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                <div className="flex min-w-0 shrink-0 items-center gap-2">
                  <Wallet className="h-5 w-5 shrink-0 text-[var(--color-mid)]" aria-hidden />
                  <h2 className="text-base font-semibold text-[var(--color-lightest)]">
                    {t("statistics.purchaseSpendingTitle")}
                  </h2>
                </div>
                {!purchaseSpendingLoading && totalPurchaseItems > 0 && (
                  <p className="text-sm text-[var(--color-light)]">
                    {t(
                      totalPurchaseItems === 1
                        ? "statistics.purchaseItemsTotal_one"
                        : "statistics.purchaseItemsTotal_other",
                      { count: String(totalPurchaseItems) }
                    )}
                  </p>
                )}
              </div>
              <div className="w-full min-w-0 sm:w-auto sm:max-w-[min(18rem,calc(100vw-2rem))] sm:shrink-0">
                <Select
                  value={purchasePeriod}
                  onValueChange={(v) => setPurchasePeriod(v as PurchasePeriod)}
                  options={[
                    { value: "month", label: t("statistics.purchasePeriodMonth") },
                    { value: "year", label: t("statistics.purchasePeriodYear") },
                    { value: "all", label: t("statistics.purchasePeriodAll") },
                  ]}
                  aria-label={t("statistics.purchasePeriodLabel")}
                  className="w-full min-w-0"
                  triggerClassName="w-full min-w-0 justify-between gap-2 py-2 h-auto min-h-[44px] [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:text-left [&>span]:leading-snug"
                />
              </div>
            </div>
            <div className="min-h-[12.5rem] min-w-0">
              {purchaseSpendingLoading ? (
                <StatisticsBarsSkeleton rows={4} />
              ) : !purchaseSpending ||
                SPEND_TRACKED_MEDIA_TYPES.every((mt) => {
                  const byCur = purchaseSpending[mt];
                  return !byCur || Object.keys(byCur).length === 0;
                }) ? (
                <p className="flex min-h-[12.5rem] items-center justify-center px-2 text-center text-sm text-[var(--color-light)]">
                  {t("statistics.purchaseEmpty")}
                </p>
              ) : (
                (() => {
                  let maxMinorGlobal = 0;
                  for (const mt of SPEND_TRACKED_MEDIA_TYPES) {
                    const byCur = purchaseSpending[mt] ?? {};
                    for (const v of Object.values(byCur)) {
                      if (v > maxMinorGlobal) maxMinorGlobal = v;
                    }
                  }
                  if (maxMinorGlobal === 0) maxMinorGlobal = 1;
                  return (
                    <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
                      {SPEND_TRACKED_MEDIA_TYPES.map((mt) => {
                        const byCurrency = purchaseSpending[mt] ?? {};
                        const entries = Object.entries(byCurrency).sort(([a], [b]) => a.localeCompare(b));
                        const maxInCategory = Math.max(0, ...entries.map(([, v]) => v), 0);
                        const itemCount = purchaseItemCounts?.[mt] ?? 0;
                        const rowInner = (
                          <>
                            <div className="flex min-h-[2.25rem] min-w-0 flex-col justify-center gap-0.5 leading-tight">
                              <span className={`block ${statBarLabelTextClass}`}>{t(`nav.${mt}`)}</span>
                              {itemCount > 0 && (
                                <span className="block text-[10px] tabular-nums text-[var(--color-light)]">
                                  {t(
                                    itemCount === 1
                                      ? "statistics.purchaseItemsInCategory_one"
                                      : "statistics.purchaseItemsInCategory_other",
                                    { count: String(itemCount) }
                                  )}
                                </span>
                              )}
                            </div>
                            <div className={statBarTrackClass}>
                              <div
                                className="h-full rounded bg-gradient-to-r from-[var(--color-mid)] to-[var(--color-mid)]/80"
                                style={{
                                  width: `${Math.max(4, (maxInCategory / maxMinorGlobal) * 100)}%`,
                                }}
                              />
                            </div>
                            <div className="flex min-w-0 flex-col items-end gap-0.5 text-right text-xs tabular-nums text-[var(--color-lightest)]">
                              {entries.length === 0 ? (
                                <span className="text-[var(--color-light)]">—</span>
                              ) : (
                                entries.map(([currency, minor]) => (
                                  <span key={`${mt}-${currency}`} className="leading-tight">
                                    {formatMinorAsMoney(minor, currency)}
                                  </span>
                                ))
                              )}
                            </div>
                          </>
                        );
                        const rowClass = `${statBarGridClass} rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-mid)]`;
                        return itemCount > 0 ? (
                          <button
                            key={mt}
                            type="button"
                            onClick={() => setSpendDetailMediaType(mt)}
                            className={`${rowClass} w-full cursor-pointer text-left hover:bg-[var(--color-mid)]/15`}
                            title={t("statistics.purchaseDetailOpen", { category: t(`nav.${mt}`) })}
                            aria-label={t("statistics.purchaseDetailOpen", { category: t(`nav.${mt}`) })}
                          >
                            {rowInner}
                          </button>
                        ) : (
                          <div key={mt} className={rowClass}>
                            {rowInner}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </Card>
        </section>
          )}
        </div>
      )}

      {isPro && spendDetailMediaType && (
        isMobile ? (
          <Drawer open onOpenChange={(open) => !open && setSpendDetailMediaType(null)}>
            <DrawerContent
              mobileHeight="95%"
              className="flex flex-col p-4 sm:p-6"
              onClose={() => setSpendDetailMediaType(null)}
            >
              <div className="mt-6">
                <h2 className="mb-4 min-w-0 truncate text-lg font-semibold text-[var(--color-lightest)]">
                  {t("statistics.purchaseSpendingDetailTitle", {
                    category: t(`nav.${spendDetailMediaType}`),
                  })}
                </h2>
                {spendDetailLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-mid)] border-t-[var(--color-lightest)]" />
                  </div>
                ) : spendDetailLogs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--color-light)]">
                    {t("statistics.purchaseDetailEmpty")}
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {spendDetailLogs.map((log) => (
                      <li key={log.id}>
                        <Link
                          to={`/item/${log.mediaType}/${log.externalId}`}
                          className="flex gap-3 rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-3 text-inherit no-underline hover:bg-[var(--color-mid)]/15"
                          onClick={() => setSpendDetailMediaType(null)}
                        >
                          <ItemImage
                            src={log.image}
                            className="h-14 w-10 shrink-0 rounded object-cover"
                            mediaType={log.mediaType}
                            boardGameSource={log.boardGameSource}
                          />
                          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                            <p className="truncate text-sm font-medium text-[var(--color-lightest)]">{log.title}</p>
                            <p className="text-xs text-[var(--color-light)]">
                              {t(`nav.${log.mediaType}`)}
                              {(() => {
                                const duration =
                                  log.startedAt && log.completedAt
                                    ? formatTimeToFinish(log.startedAt, log.completedAt)
                                    : "";
                                return duration ? <> · {t("dashboard.finishedIn", { duration })}</> : null;
                              })()}
                            </p>
                            {log.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log.status) ? (
                              <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-medium text-white">
                                {t("common.inProgress")}
                              </span>
                            ) : log.grade != null ? (
                              <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open onOpenChange={(open) => !open && setSpendDetailMediaType(null)}>
            <DialogContent
              className="flex max-h-[85vh] max-w-md flex-col"
              onClose={() => setSpendDetailMediaType(null)}
            >
              <DialogHeader className="shrink-0 space-y-0 pr-8 text-left sm:pr-10">
                <DialogTitle className="text-[var(--color-lightest)]">
                  {t("statistics.purchaseSpendingDetailTitle", {
                    category: t(`nav.${spendDetailMediaType}`),
                  })}
                </DialogTitle>
              </DialogHeader>
              <div className="min-h-0 -mx-1 max-h-[min(60vh,520px)] overflow-y-auto px-1">
                {spendDetailLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-mid)] border-t-[var(--color-lightest)]" />
                  </div>
                ) : spendDetailLogs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--color-light)]">
                    {t("statistics.purchaseDetailEmpty")}
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {spendDetailLogs.map((log) => (
                      <li key={log.id}>
                        <Link
                          to={`/item/${log.mediaType}/${log.externalId}`}
                          className="flex gap-3 rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-3 text-inherit no-underline hover:bg-[var(--color-mid)]/15"
                          onClick={() => setSpendDetailMediaType(null)}
                        >
                          <ItemImage
                            src={log.image}
                            className="h-14 w-10 shrink-0 rounded object-cover"
                            mediaType={log.mediaType}
                            boardGameSource={log.boardGameSource}
                          />
                          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                            <p className="truncate text-sm font-medium text-[var(--color-lightest)]">{log.title}</p>
                            <p className="text-xs text-[var(--color-light)]">
                              {t(`nav.${log.mediaType}`)}
                              {(() => {
                                const duration =
                                  log.startedAt && log.completedAt
                                    ? formatTimeToFinish(log.startedAt, log.completedAt)
                                    : "";
                                return duration ? <> · {t("dashboard.finishedIn", { duration })}</> : null;
                              })()}
                            </p>
                            {log.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log.status) ? (
                              <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-medium text-white">
                                {t("common.inProgress")}
                              </span>
                            ) : log.grade != null ? (
                              <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6 overflow-hidden md:grid-cols-2 md:items-stretch md:gap-8">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden md:h-full">
          <button
            type="button"
            onClick={() => setCalendarCollapsed(!calendarCollapsed)}
            className={collapsibleSectionBtnClass}
            aria-expanded={!calendarCollapsed}
          >
            {calendarCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{t("dashboard.calendarTitle")}</span>
          </button>
          {!calendarCollapsed && (
        <section
          aria-label={t("dashboard.calendarTitle")}
          className="flex min-h-0 min-w-0 flex-1 flex-col md:min-h-0"
        >
          <DashboardCalendar isPro={isPro} fillColumnHeight />
        </section>
          )}
        </div>
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden md:h-full">
          <button
            type="button"
            onClick={() => setChartsCollapsed(!chartsCollapsed)}
            className={collapsibleSectionBtnClass}
            aria-expanded={!chartsCollapsed}
          >
            {chartsCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{t("statistics.sectionChartsTitle")}</span>
          </button>
          {!chartsCollapsed && (
        <Card
          className="min-w-0 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 md:flex md:h-full md:min-h-0 md:flex-1 md:flex-col"
          style={paperShadow}
        >
          <div className="mb-3 flex min-w-0 shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Select
              value={genreGraphMode}
              onValueChange={(v) => setGenreGraphMode(v as GenreGraphMode)}
              options={[
                { value: "genre", label: t("dashboard.byGenre") },
                { value: "statusOverTime", label: t("dashboard.byStatusOverTime") },
                { value: "byCategory", label: t("dashboard.byCategory") },
              ]}
              aria-label={t("dashboard.byGenre")}
              className="w-full min-w-0 sm:max-w-[220px]"
              triggerClassName="w-full min-w-0"
            />
            {genreGraphMode === "statusOverTime" && (
              <Select
                value={statusOverTimeGroup}
                onValueChange={(v) => setStatusOverTimeGroup(v as StatusOverTimeGroup)}
                options={[
                  { value: "month", label: t("dashboard.byMonth") },
                  { value: "year", label: t("dashboard.byYear") },
                ]}
                aria-label={t("statistics.timeGranularityLabel")}
                className="w-full min-w-0 sm:w-auto sm:max-w-[min(18rem,calc(100vw-2rem))]"
                triggerClassName="w-full min-w-0"
              />
            )}
            {genreGraphMode === "byCategory" && (
              <Select
                value={categoryOverTimeGroup}
                onValueChange={(v) => setCategoryOverTimeGroup(v as StatusOverTimeGroup)}
                options={[
                  { value: "month", label: t("dashboard.byMonth") },
                  { value: "year", label: t("dashboard.byYear") },
                ]}
                aria-label={t("statistics.timeGranularityLabel")}
                className="w-full min-w-0 sm:w-auto sm:max-w-[min(18rem,calc(100vw-2rem))]"
                triggerClassName="w-full min-w-0"
              />
            )}
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {genreGraphMode === "genre" && (
            <div className="min-h-[12.5rem] min-w-0 flex-1">
              {genreStatsLoading ? (
                <StatisticsBarsSkeleton rows={6} />
              ) : genreStats.length === 0 ? (
                <p className="flex min-h-[12.5rem] items-center justify-center px-2 text-center text-sm text-[var(--color-light)]">
                  {t("dashboard.noStatsYet")}
                </p>
              ) : (
                <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
                  {genreStats.map(({ period, hours, count }) => {
                    const itemCount = count ?? hours;
                    return (
                      <div key={period} className={statBarGridClass}>
                        <div className="flex min-h-[2.25rem] min-w-0 flex-col justify-center gap-0.5 leading-tight">
                          <span className={`block ${statBarLabelTextClass}`}>{period}</span>
                          {itemCount > 0 && (
                            <span className="block text-[10px] tabular-nums text-[var(--color-light)]">
                              {t(
                                itemCount === 1
                                  ? "statistics.statItemsCount_one"
                                  : "statistics.statItemsCount_other",
                                { count: String(itemCount) }
                              )}
                            </span>
                          )}
                        </div>
                        <div className={statBarTrackClass}>
                          <div
                            className={statBarFillClass}
                            style={{ width: `${Math.max(5, (hours / maxGenreCount) * 100)}%` }}
                          />
                        </div>
                        <span className={statBarValueClass}>
                          {t("dashboard.logsCount", { count: String(Math.round(hours)) })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {genreGraphMode === "statusOverTime" && (
            <div className="min-h-[12.5rem] min-w-0 flex-1">
              {statusOverTimeLoading ? (
                <StatisticsBarsSkeleton rows={6} />
              ) : statusOverTimeStats.length === 0 ? (
                <p className="flex min-h-[12.5rem] items-center justify-center px-2 text-center text-sm text-[var(--color-light)]">
                  {t("dashboard.noStatusOverTimeYet")}
                </p>
              ) : (
                <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
                  {statusOverTimeStats.map(({ period, hours, count }) => {
                    const itemCount = count ?? hours;
                    return (
                      <div key={period} className={statBarGridClass}>
                        <div className="flex min-h-[2.25rem] min-w-0 flex-col justify-center gap-0.5 leading-tight">
                          <span className={`block ${statBarLabelTextClass}`}>
                            {statusOverTimeGroup === "year" ? period : period.slice(0, 7)}
                          </span>
                          {itemCount > 0 && (
                            <span className="block text-[10px] tabular-nums text-[var(--color-light)]">
                              {t(
                                itemCount === 1
                                  ? "statistics.statItemsCount_one"
                                  : "statistics.statItemsCount_other",
                                { count: String(itemCount) }
                              )}
                            </span>
                          )}
                        </div>
                        <div className={statBarTrackClass}>
                          <div
                            className={statBarFillClass}
                            style={{ width: `${Math.max(5, (hours / maxStatusOverTimeCount) * 100)}%` }}
                          />
                        </div>
                        <span className={statBarValueClass}>
                          {t("dashboard.completedCount", { count: String(Math.round(hours)) })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {genreGraphMode === "byCategory" && (
            <div className="min-h-[12.5rem] min-w-0 flex-1">
              {categoryOverTimeLoading ? (
                <StatisticsCategoryOverTimeSkeleton />
              ) : categoryOverTimePeriods.length === 0 ? (
                <p className="flex min-h-[12.5rem] items-center justify-center px-2 text-center text-sm text-[var(--color-light)]">
                  {t("dashboard.noStatsYet")}
                </p>
              ) : (
                <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
                  {categoryOverTimePeriods.map((period) => (
                    <div key={period} className="flex min-w-0 flex-col gap-1.5">
                      <span className="shrink-0 text-xs font-medium text-[var(--color-light)]">
                        {categoryOverTimeGroup === "year" ? period : period.slice(0, 7)}
                      </span>
                      <div className="flex min-w-0 flex-col gap-1">
                        {(categoryOverTimeByPeriod[period] ?? []).map(({ mediaType, hours, count }) => {
                          const itemCount = count ?? hours;
                          return (
                            <div key={`${period}-${mediaType}`} className={statBarGridClass}>
                              <div className="flex min-h-[2.25rem] min-w-0 flex-col justify-center gap-0.5 leading-tight">
                                <span className={`block ${statBarLabelTextClass}`}>{t(`nav.${mediaType}`)}</span>
                                {itemCount > 0 && (
                                  <span className="block text-[10px] tabular-nums text-[var(--color-light)]">
                                    {t(
                                      itemCount === 1
                                        ? "statistics.statItemsCount_one"
                                        : "statistics.statItemsCount_other",
                                      { count: String(itemCount) }
                                    )}
                                  </span>
                                )}
                              </div>
                              <div className={statBarTrackClass}>
                                <div
                                  className={statBarFillClass}
                                  style={{ width: `${Math.max(5, (hours / maxCategoryOverTimeCount) * 100)}%` }}
                                />
                              </div>
                              <span className={statBarValueClass}>
                                {t("dashboard.logsCount", { count: String(Math.round(hours)) })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </Card>
          )}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-10 overflow-hidden md:grid-cols-2 md:items-stretch md:gap-10">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden md:h-full">
          <button
            type="button"
            onClick={() => setStatsCollapsed(!statsCollapsed)}
            className={collapsibleSectionBtnClass}
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
              <Card
                className="min-w-0 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 md:flex md:h-full md:min-h-0 md:flex-1 md:flex-col"
                style={paperShadow}
              >
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
                  <div className="w-full min-w-0 shrink-0">
                    <Select
                      value={statsGroup}
                      onValueChange={(v) => setStatsGroup(v as StatsGroup)}
                      options={[
                        { value: "category", label: t("dashboard.byCategory") },
                        { value: "month", label: t("dashboard.byMonth") },
                        { value: "year", label: t("dashboard.byYear") },
                      ]}
                      aria-label={t("dashboard.statsTitle")}
                      className="min-w-0 w-full md:max-w-[min(20rem,100%)]"
                      triggerClassName="w-full min-w-0"
                    />
                  </div>
                  <div className="min-h-[12.5rem] min-w-0 flex-1">
                    {statsLoading ? (
                      <StatisticsBarsSkeleton rows={5} />
                    ) : stats.length === 0 ? (
                      <p className="flex min-h-[12.5rem] items-center justify-center px-2 text-center text-sm text-[var(--color-light)]">
                        {t("dashboard.noStatsYet")}
                      </p>
                    ) : (
                      <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
                        {displayedStats.map(({ period, hours, count }) => (
                          <div key={period} className={statBarGridClass}>
                            <div className="flex min-h-[2.25rem] min-w-0 flex-col justify-center gap-0.5 leading-tight">
                              <span className={`block ${statBarLabelTextClass}`}>
                                {statsGroup === "category"
                                  ? t(`nav.${period}`)
                                  : statsGroup === "year"
                                    ? period
                                    : period.slice(0, 7)}
                              </span>
                              {(count ?? 0) > 0 && (
                                <span className="block text-[10px] tabular-nums text-[var(--color-light)]">
                                  {t(
                                    (count ?? 0) === 1
                                      ? "statistics.statItemsCount_one"
                                      : "statistics.statItemsCount_other",
                                    { count: String(count ?? 0) }
                                  )}
                                </span>
                              )}
                            </div>
                            <div className={statBarTrackClass}>
                              <div
                                className={statBarFillClass}
                                style={{ width: `${Math.max(5, (hours / maxHours) * 100)}%` }}
                              />
                            </div>
                            <span className={statBarValueClass}>
                              {t("dashboard.hoursConsumed", { hours: hours.toFixed(1) })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden md:h-full">
          <button
            type="button"
            onClick={() => setRecentLogsCollapsed(!recentLogsCollapsed)}
            className={collapsibleSectionBtnClass}
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
            <div className="flex min-h-0 min-w-0 flex-1 flex-col md:min-h-0">
              {loading ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <StatisticsRecentLogsSkeleton rows={5} />
                </div>
              ) : recent.length === 0 ? (
                <Card
                  className="flex min-h-[14rem] flex-1 flex-col border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 md:min-h-0"
                  style={paperShadow}
                >
                  <p className="flex min-h-0 flex-1 items-center justify-center text-center text-[var(--color-light)]">
                    <span>
                      {t("dashboard.noLogsYet")}{" "}
                      <Link to="/search" className="text-[var(--color-lightest)] underline hover:no-underline">
                        {t("dashboard.searchAndAddFirst")}
                      </Link>
                    </span>
                  </p>
                </Card>
              ) : (
                <motion.ul
                  className="m-0 flex min-h-0 min-w-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-0"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {recent.map((log) => {
                    const status = log.status ?? undefined;
                    const isDropped = status === "dropped";
                    const isInProgress =
                      status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
                    const isCompleted =
                      status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
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
                    const duration =
                      log.startedAt && log.completedAt
                        ? formatTimeToFinish(log.startedAt, log.completedAt)
                        : "";
                    return (
                      <motion.li key={log.id} variants={staggerItem} className="list-none">
                        <motion.div whileTap={tapScale} transition={tapTransition}>
                          <Link
                            to={`/item/${log.mediaType}/${log.externalId}`}
                            className={`flex min-w-0 flex-row overflow-hidden rounded-lg border bg-[var(--color-dark)] text-left text-inherit no-underline shadow-[var(--shadow-card)] transition-[opacity,border-color] hover:opacity-95 max-md:min-h-[44px] ${listBorderClass} ${status == null ? "hover:border-black" : ""}`}
                          >
                            <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-l-lg">
                              <ItemImage
                                src={log.image}
                                className="h-full w-full"
                                mediaType={log.mediaType}
                                boardGameSource={log.boardGameSource}
                              />
                              {status && (
                                <span
                                  className={`absolute bottom-1 right-1 z-10 rounded px-1.5 py-0.5 text-[9px] font-medium ${badgeClass}`}
                                  title={getStatusLabel(t, status, log.mediaType)}
                                >
                                  {getStatusLabel(t, status, log.mediaType)}
                                </span>
                              )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden p-3">
                              <p className="truncate text-[10px] font-medium uppercase text-[var(--color-light)]">
                                {t(`nav.${log.mediaType}`)}
                              </p>
                              <p className="line-clamp-2 text-sm font-semibold text-[var(--color-lightest)]">
                                {log.title}
                              </p>
                              {log.genres && log.genres.length > 0 && (
                                <GenreBadges genres={log.genres} maxCount={1} />
                              )}
                              {!isInProgress && log.grade != null && (
                                <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                              )}
                              <p className="line-clamp-2 text-xs leading-snug text-[var(--color-light)]">
                                {(() => {
                                  const parts: string[] = [];
                                  if (duration) {
                                    parts.push(t("dashboard.finishedIn", { duration }));
                                  }
                                  if (
                                    log.mediaType === "games" &&
                                    log.hoursToBeat != null &&
                                    log.hoursToBeat > 0
                                  ) {
                                    const { hours, minutes } = formatTimeToBeatHours(log.hoursToBeat);
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
                          </Link>
                        </motion.div>
                      </motion.li>
                    );
                  })}
                </motion.ul>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
