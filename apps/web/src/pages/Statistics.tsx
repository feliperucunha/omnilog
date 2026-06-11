import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MotionLink } from "@/components/MotionLink";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  Layers,
  Scale,
  Star,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  apiFetch,
  ApiError,
  getCachedEntry,
  HEAVY_PAGE_TTL_MS,
  apiFetchSWR,
  invalidateLogsAndItemsCache,
  LOGS_INVALIDATED_EVENT,
  requestLogsCacheWarm,
} from "@/lib/api";
import { useAppPtrRefresh } from "@/hooks/useAppPtrRefresh";
import {
  loadWithSWR,
  registerLogsPageCacheContext,
} from "@/lib/logsPageCache";
import {
  StatisticsSummarySkeleton,
  StatisticsBarsSkeleton,
  StatisticsSpendByCategorySkeleton,
  StatisticsCategoryOverTimeSkeleton,
  StatisticsRecentLogsSkeleton,
} from "@/components/skeletons";
import {
  BoardGameRecentStatsWidget,
  type RecentBoardGameStatEntry,
} from "@/components/BoardGameRecentStatsWidget";
import { GamePlatformStatsWidget } from "@/components/GamePlatformStatsWidget";
import { ItemImage } from "@/components/ItemImage";
import { GenreBadges } from "@/components/GenreBadges";
import { tapScale, tapTransition } from "@/lib/animations";
import { listStaggerItemClassName, listStaggerItemVariants, listStaggerParentProps } from "@/lib/motionPolicy";
import { itemDetailPath } from "@/lib/itemRoutes";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { tierHasProFeatures } from "@/lib/userTier";
import {
  COMPLETED_STATUSES,
  IN_PROGRESS_STATUSES,
  LOG_STATUS_OPTIONS,
  SPEND_TRACKED_MEDIA_TYPES,
  type Log,
  type MediaType,
} from "@geeklogs/shared";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToBeatHours, formatTimeToFinish } from "@/lib/formatDuration";
import { getStatusLabel } from "@/lib/statusLabel";
import { decodeLogForDisplay } from "@/lib/decodeDisplayFields";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DashboardCalendar } from "@/components/DashboardCalendar";
import { LogActivitySheet } from "@/components/LogActivitySheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { showErrorToast } from "@/lib/errorToast";
import { buildRecapTitle, recapBoundsForPeriod, type RecapPeriod } from "@/lib/recapPeriodBounds";
import { RecapView } from "@/components/RecapView";
import * as storage from "@/lib/storage";
import { paperShadow } from "@/lib/paperShadow";
import { currencyMinorDecimals } from "@/lib/moneyInput";
import { formatStatsTimeAxisLabel } from "@/lib/formatStatsPeriod";
import { cn } from "@/lib/utils";
import { OnboardingSpotlight } from "@/components/OnboardingSpotlight";
import { ONBOARDING_SPOTLIGHT_KEYS } from "@/lib/onboardingSpotlightStorage";
import { StickyCategoryStrip } from "@/components/StickyCategoryStrip";

function formatMinorAsMoney(minor: number, currency: string): string {
  const d = currencyMinorDecimals(currency);
  const n = minor / 10 ** d;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
}

function formatSignedMinorAsMoney(minor: number, currency: string): string {
  const abs = Math.abs(minor);
  const formatted = formatMinorAsMoney(abs, currency);
  if (minor > 0) return `+${formatted}`;
  if (minor < 0) return `−${formatMinorAsMoney(abs, currency)}`;
  return formatMinorAsMoney(0, currency);
}

/** One track: emerald (sales) left, rose (purchases) right — width vs global max. */
function SpendCategorySegmentBar({
  purchaseMinor,
  saleMinor,
  globalMaxMinor,
}: {
  purchaseMinor: number;
  saleMinor: number;
  globalMaxMinor: number;
}) {
  const total = purchaseMinor + saleMinor;
  if (globalMaxMinor <= 0 || total <= 0) {
    return <div className="h-1.5 w-full rounded-full bg-[var(--color-mid)]/12" aria-hidden />;
  }
  const widthPct = Math.max(6, Math.min(100, (total / globalMaxMinor) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--color-mid)]/12" aria-hidden>
      <div
        className="flex h-full min-w-0 overflow-hidden rounded-full"
        style={{ width: `${widthPct}%` }}
      >
        {saleMinor > 0 ? (
          <div
            className="h-full min-w-0 shrink-0 bg-emerald-500/50"
            style={{ width: `${(saleMinor / total) * 100}%` }}
          />
        ) : null}
        {purchaseMinor > 0 ? (
          <div
            className="h-full min-w-0 shrink-0 bg-rose-500/45"
            style={{ width: `${(purchaseMinor / total) * 100}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

type SpendFinanceT = (key: string, values?: Record<string, string>) => string;

function getLogCashFlow(log: Log): {
  hasPurchase: boolean;
  hasSale: boolean;
  purchaseMinor: number | null;
  purchaseCurrency: string | null;
  saleMinor: number | null;
  saleCurrency: string | null;
  netMinor: number | null;
  netCurrency: string | null;
  netMixed: boolean;
} {
  const pm = log.purchaseAmountMinor ?? null;
  const pc = log.purchaseCurrency?.trim() || null;
  const sm = log.saleAmountMinor ?? null;
  const sc = log.saleCurrency?.trim() || null;
  const hasPurchase = pm != null && !!pc;
  const hasSale = sm != null && !!sc;
  let netMinor: number | null = null;
  let netCurrency: string | null = null;
  let netMixed = false;
  if (hasPurchase && hasSale) {
    if (pc === sc) {
      netMinor = sm! - pm!;
      netCurrency = pc;
    } else {
      netMixed = true;
    }
  } else if (hasPurchase) {
    netMinor = -pm!;
    netCurrency = pc;
  } else if (hasSale) {
    netMinor = sm!;
    netCurrency = sc;
  }
  return {
    hasPurchase,
    hasSale,
    purchaseMinor: pm,
    purchaseCurrency: pc,
    saleMinor: sm,
    saleCurrency: sc,
    netMinor,
    netCurrency,
    netMixed,
  };
}

/** Stock-style row: cost / proceeds columns and signed net when computable. */
function SpendFinanceLogRow({ log, t, onNavigate }: { log: Log; t: SpendFinanceT; onNavigate: () => void }) {
  const cf = getLogCashFlow(log);
  const netTone =
    cf.netMinor != null
      ? cf.netMinor > 0
        ? "text-emerald-400"
        : cf.netMinor < 0
          ? "text-rose-400/95"
          : "text-[var(--color-lightest)]"
      : "text-[var(--color-light)]";

  const cellBase =
    "flex min-w-0 flex-col items-center justify-center rounded-lg bg-[var(--color-dark)]/50 px-1.5 py-2 ring-1 ring-[var(--color-mid)]/25";

  return (
    <Link
      to={itemDetailPath(log.mediaType, log.externalId)}
      onClick={onNavigate}
      className="relative z-0 block rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-3.5 text-inherit no-underline shadow-sm transition-[border-color,box-shadow,transform] hover:border-[var(--color-mid)]/60 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex gap-3">
        <ItemImage
          src={log.image}
          className="h-[4.5rem] w-[3.25rem] shrink-0 rounded-lg object-cover ring-1 ring-black/20 sm:h-[3.6rem] sm:w-[2.6rem]"
          mediaType={log.mediaType}
          boardGameSource={log.boardGameSource}
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <OverflowMarquee className="text-[15px] font-semibold leading-snug tracking-tight text-[var(--color-lightest)]">
            {log.title}
          </OverflowMarquee>
          <p className="text-[11px] text-[var(--color-light)]">
            {t(`nav.${log.mediaType}`)}
            {(() => {
              const duration =
                log.startedAt && log.completedAt ? formatTimeToFinish(log.startedAt, log.completedAt) : "";
              return duration ? <> · {t("dashboard.finishedIn", { duration })}</> : null;
            })()}
          </p>
          {log.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log.status) ? (
            <span className="w-fit rounded-full bg-amber-600/95 px-2 py-0.5 text-[10px] font-medium text-white">
              {t("common.inProgress")}
            </span>
          ) : log.grade != null ? (
            <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
          ) : null}
        </div>
      </div>

      {cf.hasPurchase && cf.hasSale ? (
        cf.netMixed ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className={cellBase}>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-rose-300/80">
                {t("statistics.detailCost")}
              </span>
              <span className="mt-1 text-sm font-semibold tabular-nums text-rose-100/95">
                {cf.purchaseMinor != null && cf.purchaseCurrency
                  ? formatMinorAsMoney(cf.purchaseMinor, cf.purchaseCurrency)
                  : "—"}
              </span>
            </div>
            <div className={cellBase}>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-300/85">
                {t("statistics.detailProceeds")}
              </span>
              <span className="mt-1 text-sm font-semibold tabular-nums text-emerald-200/95">
                {cf.saleMinor != null && cf.saleCurrency
                  ? formatMinorAsMoney(cf.saleMinor, cf.saleCurrency)
                  : "—"}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className={cellBase}>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-rose-300/80">
                {t("statistics.detailCost")}
              </span>
              <span className="mt-1 text-sm font-semibold tabular-nums text-rose-100/95">
                {cf.purchaseMinor != null && cf.purchaseCurrency
                  ? formatMinorAsMoney(cf.purchaseMinor, cf.purchaseCurrency)
                  : "—"}
              </span>
            </div>
            <div className={cellBase}>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-300/85">
                {t("statistics.detailProceeds")}
              </span>
              <span className="mt-1 text-sm font-semibold tabular-nums text-emerald-200/95">
                {cf.saleMinor != null && cf.saleCurrency
                  ? formatMinorAsMoney(cf.saleMinor, cf.saleCurrency)
                  : "—"}
              </span>
            </div>
            <div className={cellBase}>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-light)]">
                {t("statistics.detailNet")}
              </span>
              <span className={cn("mt-1 text-sm font-bold tabular-nums tracking-tight", netTone)}>
                {cf.netMinor != null && cf.netCurrency
                  ? formatSignedMinorAsMoney(cf.netMinor, cf.netCurrency)
                  : "—"}
              </span>
            </div>
          </div>
        )
      ) : cf.hasPurchase ? (
        <div className="mt-3">
          <div className={cn(cellBase, "w-full")}>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-rose-300/80">
              {t("statistics.detailCost")}
            </span>
            <span className="mt-1 text-sm font-semibold tabular-nums text-rose-100/95">
              {cf.purchaseMinor != null && cf.purchaseCurrency
                ? formatMinorAsMoney(cf.purchaseMinor, cf.purchaseCurrency)
                : "—"}
            </span>
          </div>
        </div>
      ) : cf.hasSale ? (
        <div className="mt-3">
          <div className={cn(cellBase, "w-full")}>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-300/85">
              {t("statistics.detailProceeds")}
            </span>
            <span className="mt-1 text-sm font-semibold tabular-nums text-emerald-200/95">
              {cf.saleMinor != null && cf.saleCurrency
                ? formatMinorAsMoney(cf.saleMinor, cf.saleCurrency)
                : "—"}
            </span>
          </div>
        </div>
      ) : null}

      {cf.netMixed ? (
        <p className="mt-2 text-center text-[10px] leading-snug text-[var(--color-light)]">
          {t("statistics.detailNetMixed")}
        </p>
      ) : null}
    </Link>
  );
}

function SpendFinanceDetailHeader({ categoryKey, t }: { categoryKey: string; t: SpendFinanceT }) {
  return (
    <div className="space-y-1 shrink-0">
      <OverflowMarquee className="min-w-0 text-xl font-semibold tracking-tight text-[var(--color-lightest)]">
        {t(`nav.${categoryKey}`)}
      </OverflowMarquee>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-light)]">
        {t("statistics.financeDetailSubtitle")}
      </p>
    </div>
  );
}

function SpendFinanceDetailList({
  loading,
  logs,
  t,
  onNavigate,
  listGapClassName,
}: {
  loading: boolean;
  logs: Log[];
  t: SpendFinanceT;
  onNavigate: () => void;
  listGapClassName?: string;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-mid)] border-t-[var(--color-lightest)]" />
      </div>
    );
  }
  if (logs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-light)]">{t("statistics.financeDetailEmpty")}</p>
    );
  }
  return (
    <ul className={cn("m-0 flex list-none flex-col p-0", listGapClassName ?? "gap-3")}>
      {logs.map((log) => (
        <li key={log.id}>
          <SpendFinanceLogRow log={log} t={t} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  );
}

function StatsTimeSectionDivider({ label }: { label: string }) {
  return (
    <div
      className="relative flex w-full items-center gap-3 py-1.5 first:pt-0"
      role="separator"
      aria-label={label}
    >
      <div
        className="h-px min-w-[1.25rem] flex-1 bg-gradient-to-r from-transparent via-[var(--color-mid)]/45 to-[var(--color-mid)]/20"
        aria-hidden
      />
      <span className="max-w-[min(100%,18rem)] shrink-0 truncate rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3.5 py-1 text-center text-[11px] font-semibold leading-tight tracking-wide text-[var(--color-lightest)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        {label}
      </span>
      <div
        className="h-px min-w-[1.25rem] flex-1 bg-gradient-to-l from-transparent via-[var(--color-mid)]/45 to-[var(--color-mid)]/20"
        aria-hidden
      />
    </div>
  );
}

const logsPeriodActivityBtnClass =
  "relative flex w-full items-center gap-3 rounded-lg py-1.5 text-left transition-colors first:pt-0 hover:bg-[var(--color-mid)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] max-md:min-h-[44px]";

type PurchasePeriod = "month" | "year" | "all";
type BoardGameMatchesPeriod = "month" | "year";
type BoardGameMatchesSort = "recent" | "mostPlayed" | "leastPlayed";

const STORAGE_KEY_STATS = "geeklogs.statistics.statsCollapsed";
const STORAGE_KEY_RECENT = "geeklogs.statistics.recentLogsCollapsed";
const STORAGE_KEY_SUMMARY = "geeklogs.statistics.summaryCollapsed";
const STORAGE_KEY_PURCHASE = "geeklogs.statistics.purchaseCollapsed";
const STORAGE_KEY_BOARD_GAME_MATCHES = "geeklogs.statistics.boardGameMatchesCollapsed";
const STORAGE_KEY_GAME_PLATFORMS = "geeklogs.statistics.gamePlatformsCollapsed";
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
  /** All-time net per ISO 4217 currency (sale proceeds − purchases). */
  lifetimeNetByCurrency?: Record<string, number>;
  /** books / manga / comics filter only */
  totalPagesRead?: number;
  /** boardgames filter only */
  boardGamesWon?: number;
}

const EMPTY_SUMMARY: LogStatsSummary = {
  totalLogs: 0,
  completedLogs: 0,
  reviewedLogs: 0,
  totalContentHours: 0,
  completedLogsWithHours: 0,
  lifetimeNetByCurrency: {},
};

/** Desktop: icon column + gap — value lines up under label text. */
const OVERVIEW_STAT_VALUE_INSET = "md:pl-[calc(2.5rem+0.75rem)]";

function OverviewStatCard({
  icon: Icon,
  label,
  value,
  sub,
  valueClassName,
}: {
  icon: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  /** Optional size override (e.g. multi-line currency totals). */
  valueClassName?: string;
}) {
  const iconBox = (compact: boolean) => (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border border-[var(--color-mid)]/25 bg-[var(--color-mid)]/10 text-[var(--color-lightest)]",
        compact ? "h-9 w-9" : "h-10 w-10 rounded-xl border-[var(--color-mid)]/30 bg-[var(--color-mid)]/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
      )}
      aria-hidden
    >
      <Icon className={compact ? "h-4 w-4" : "h-[1.125rem] w-[1.125rem]"} strokeWidth={2.25} />
    </div>
  );

  return (
    <Card
      className={cn(
        "min-w-0 overflow-hidden border border-[var(--color-surface-border)]/90 bg-[var(--color-dark)]",
        "rounded-xl p-3.5 shadow-none",
        "md:relative md:rounded-2xl md:bg-gradient-to-b md:from-[var(--color-dark)] md:to-[var(--color-darkest)]/50 md:p-5 md:shadow-[var(--shadow-sm)] md:transition-[border-color] md:duration-200",
        "md:min-h-[6.75rem] md:hover:border-[var(--color-mid)]/40",
        "group"
      )}
    >
      {/* Mobile: one full-width row — icon, then label / value / sub (no indent, no decoration). */}
      <div className="flex items-center gap-3 md:hidden">
        {iconBox(true)}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">{label}</p>
          <div
            className={cn(
              "mt-1 w-full min-w-0 text-xl font-semibold tabular-nums leading-none text-[var(--color-lightest)]",
              valueClassName
            )}
          >
            {value}
          </div>
          {sub ? <div className="mt-1 text-[11px] leading-snug text-[var(--color-light)]">{sub}</div> : null}
        </div>
      </div>

      {/* Desktop */}
      <div className="relative hidden min-w-0 md:block">
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--color-mid)]/[0.07]" />
        </div>
        <div className="relative flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {iconBox(false)}
            <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase leading-snug tracking-[0.1em] text-[var(--color-light)]">
              {label}
            </p>
          </div>
          <div className={cn("min-w-0 w-full max-w-full", OVERVIEW_STAT_VALUE_INSET)}>
            <div
              className={cn(
                "w-full min-w-0 text-3xl font-semibold tabular-nums leading-none tracking-tight text-[var(--color-lightest)]",
                valueClassName
              )}
            >
              {value}
            </div>
            {sub ? <div className="mt-2 text-xs leading-snug text-[var(--color-light)]">{sub}</div> : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function CategoryOrderSkeletonStrip() {
  return (
    <div className="scrollbar-hide flex min-h-[3rem] min-w-0 overflow-x-auto scroll-smooth [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [touch-action:pan-x]" aria-busy>
      <div className="flex min-w-max items-stretch gap-6 pl-2.5 pr-2.5 md:pl-3 md:pr-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex shrink-0 flex-col items-center justify-start pt-3">
            <div className="h-4 w-16 max-w-[5rem] animate-pulse rounded bg-[var(--color-mid)]/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Statistics() {
  const { t, locale } = useLocale();
  const { me } = useMe();
  const { visibleTypes, visibleTypesOrderReady } = useVisibleMediaTypes();
  const { setPageTitle, setRightSlot, setBelowNavbar } = usePageTitle() ?? {};
  const [categoryFilter, setCategoryFilter] = useState<"all" | MediaType>("all");
  const isPro = tierHasProFeatures(me?.tier);
  const [logs, setLogs] = useState<Log[]>([]);
  const [summary, setSummary] = useState<LogStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsGroup, setStatsGroup] = useState<StatsGroup>("category");
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [genreStats, setGenreStats] = useState<StatsEntry[]>([]);
  const [gamePlatformStats, setGamePlatformStats] = useState<StatsEntry[]>([]);
  const [gamePlatformStatsLoading, setGamePlatformStatsLoading] = useState(false);
  const [recentBoardGames, setRecentBoardGames] = useState<RecentBoardGameStatEntry[]>([]);
  const [recentBoardGamesLoading, setRecentBoardGamesLoading] = useState(false);
  const [boardGameMatchesPeriod, setBoardGameMatchesPeriod] = useState<BoardGameMatchesPeriod>("month");
  const [boardGameMatchesSort, setBoardGameMatchesSort] = useState<BoardGameMatchesSort>("recent");
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
  const [boardGameMatchesCollapsed, setBoardGameMatchesCollapsedState] = useState(false);
  const [gamePlatformsCollapsed, setGamePlatformsCollapsedState] = useState(false);
  const [calendarCollapsed, setCalendarCollapsedState] = useState(false);
  const [chartsCollapsed, setChartsCollapsedState] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [recapPickerOpen, setRecapPickerOpen] = useState(false);
  const [recapView, setRecapView] = useState<{ title: string; logs: Log[] } | null>(null);
  const [recapCategory, setRecapCategory] = useState<"all" | MediaType>("all");
  /** Only used when `recapCategory` is a single media type; `"all"` = no status filter. */
  const [recapStatusFilter, setRecapStatusFilter] = useState<"all" | string>("all");
  const [recapPeriod, setRecapPeriod] = useState<RecapPeriod>("week");
  const [recapSubmitting, setRecapSubmitting] = useState(false);
  const [purchasePeriod, setPurchasePeriod] = useState<PurchasePeriod>("month");
  const [purchaseSpending, setPurchaseSpending] = useState<Record<string, Record<string, number>> | null>(
    null
  );
  const [saleProceedsByCategory, setSaleProceedsByCategory] = useState<Record<
    string,
    Record<string, number>
  > | null>(null);
  /** Log rows counted per spend-tracked category (same period as spending). */
  const [purchaseItemCounts, setPurchaseItemCounts] = useState<Record<string, number> | null>(null);
  const [saleItemCounts, setSaleItemCounts] = useState<Record<string, number> | null>(null);
  const [purchaseSpendingLoading, setPurchaseSpendingLoading] = useState(true);
  const [spendDetailMediaType, setSpendDetailMediaType] = useState<string | null>(null);
  const [spendDetailLogs, setSpendDetailLogs] = useState<Log[]>([]);
  const [spendDetailLoading, setSpendDetailLoading] = useState(false);
  const [logsPeriodActivity, setLogsPeriodActivity] = useState<{
    period: string;
    granularity: StatusOverTimeGroup;
    title: string;
    mediaType?: MediaType;
  } | null>(null);
  const [logsPeriodActivityLogs, setLogsPeriodActivityLogs] = useState<Log[]>([]);
  const [logsPeriodActivityLoading, setLogsPeriodActivityLoading] = useState(false);

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      storage.getItem(STORAGE_KEY_STATS),
      storage.getItem(STORAGE_KEY_RECENT),
      storage.getItem(STORAGE_KEY_SUMMARY),
      storage.getItem(STORAGE_KEY_PURCHASE),
      storage.getItem(STORAGE_KEY_BOARD_GAME_MATCHES),
      storage.getItem(STORAGE_KEY_GAME_PLATFORMS),
      storage.getItem(STORAGE_KEY_CALENDAR),
      storage.getItem(STORAGE_KEY_CHARTS),
    ]).then(([statsVal, recentVal, summaryVal, purchaseVal, boardGameMatchesVal, gamePlatformsVal, calendarVal, chartsVal]) => {
      if (cancelled) return;
      if (statsVal === "true") setStatsCollapsedState(true);
      if (recentVal === "true") setRecentLogsCollapsedState(true);
      if (summaryVal === "true") setSummaryCollapsedState(true);
      if (purchaseVal === "true") setPurchaseCollapsedState(true);
      if (boardGameMatchesVal === "true") setBoardGameMatchesCollapsedState(true);
      if (gamePlatformsVal === "true") setGamePlatformsCollapsedState(true);
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

  const setBoardGameMatchesCollapsed = useCallback((value: boolean) => {
    setBoardGameMatchesCollapsedState(value);
    void storage.setItem(STORAGE_KEY_BOARD_GAME_MATCHES, String(value));
  }, []);

  const setGamePlatformsCollapsed = useCallback((value: boolean) => {
    setGamePlatformsCollapsedState(value);
    void storage.setItem(STORAGE_KEY_GAME_PLATFORMS, String(value));
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
  const statBarMarqueeClass = "block min-w-0 text-xs text-[var(--color-light)]";
  const statBarValueClass = "shrink-0 text-right text-xs tabular-nums text-[var(--color-lightest)]";

  const statsMediaQuery = useCallback(() => {
    return categoryFilter === "all" ? "" : `&mediaType=${encodeURIComponent(categoryFilter)}`;
  }, [categoryFilter]);

  const fetchStats = useCallback(async () => {
    if (categoryFilter !== "all") {
      setStats([]);
      setStatsLoading(false);
      return;
    }
    const path = `/logs/stats?group=${statsGroup}&timezoneOffsetMinutes=${tzOffsetMinutes}${statsMediaQuery()}`;
    await loadWithSWR<{ data: StatsEntry[] }>(
      path,
      (res) => setStats(res.data ?? []),
      { setLoading: setStatsLoading, onError: () => setStats([]) }
    );
  }, [categoryFilter, statsGroup, tzOffsetMinutes, statsMediaQuery]);

  const fetchGamePlatformStats = useCallback(async () => {
    if (categoryFilter !== "games" && categoryFilter !== "all") {
      setGamePlatformStats([]);
      setGamePlatformStatsLoading(false);
      return;
    }
    const path = `/logs/stats?group=gamePlatforms&timezoneOffsetMinutes=${tzOffsetMinutes}${statsMediaQuery()}`;
    await loadWithSWR<{ data: StatsEntry[] }>(
      path,
      (res) => setGamePlatformStats(res.data ?? []),
      { setLoading: setGamePlatformStatsLoading, onError: () => setGamePlatformStats([]) }
    );
  }, [categoryFilter, tzOffsetMinutes, statsMediaQuery]);

  const fetchRecentBoardGames = useCallback(async () => {
    if (categoryFilter !== "boardgames" && categoryFilter !== "all") {
      setRecentBoardGames([]);
      setRecentBoardGamesLoading(false);
      return;
    }
    const path = `/logs/stats?group=recentBoardGames&period=${boardGameMatchesPeriod}&sort=${boardGameMatchesSort}&timezoneOffsetMinutes=${tzOffsetMinutes}${statsMediaQuery()}`;
    await loadWithSWR<{ data: RecentBoardGameStatEntry[] }>(
      path,
      (res) => setRecentBoardGames(res.data ?? []),
      { setLoading: setRecentBoardGamesLoading, onError: () => setRecentBoardGames([]) }
    );
  }, [boardGameMatchesPeriod, boardGameMatchesSort, categoryFilter, tzOffsetMinutes, statsMediaQuery]);

  const fetchGenreStats = useCallback(async () => {
    const path = `/logs/stats?group=genre&timezoneOffsetMinutes=${tzOffsetMinutes}${statsMediaQuery()}`;
    await loadWithSWR<{ data: StatsEntry[] }>(
      path,
      (res) => setGenreStats(res.data ?? []),
      { setLoading: setGenreStatsLoading, onError: () => setGenreStats([]) }
    );
  }, [tzOffsetMinutes, statsMediaQuery]);

  const fetchStatusOverTimeStats = useCallback(
    async (group: "completedByMonth" | "completedByYear") => {
      const path = `/logs/stats?group=${group}&timezoneOffsetMinutes=${tzOffsetMinutes}${statsMediaQuery()}`;
      await loadWithSWR<{ data: StatsEntry[] }>(
        path,
        (res) => setStatusOverTimeStats(res.data ?? []),
        { setLoading: setStatusOverTimeLoading, onError: () => setStatusOverTimeStats([]) }
      );
    },
    [tzOffsetMinutes, statsMediaQuery]
  );

  const fetchCategoryOverTimeStats = useCallback(
    async (group: "categoryByMonth" | "categoryByYear") => {
      const path = `/logs/stats?group=${group}&timezoneOffsetMinutes=${tzOffsetMinutes}${statsMediaQuery()}`;
      await loadWithSWR<{ data: CategoryOverTimeEntry[] }>(
        path,
        (res) => setCategoryOverTimeStats(res.data ?? []),
        { setLoading: setCategoryOverTimeLoading, onError: () => setCategoryOverTimeStats([]) }
      );
    },
    [tzOffsetMinutes, statsMediaQuery]
  );

  type PurchaseSpendingResponse = {
    data: Record<string, Record<string, number>>;
    saleData?: Record<string, Record<string, number>>;
    counts?: Record<string, number>;
    saleCounts?: Record<string, number>;
  };

  const fetchPurchaseSpending = useCallback(async () => {
    const path = `/logs/stats?group=purchaseSpending&period=${purchasePeriod}&timezoneOffsetMinutes=${tzOffsetMinutes}${statsMediaQuery()}`;
    await loadWithSWR<PurchaseSpendingResponse>(
      path,
      (res) => {
        setPurchaseSpending(res.data ?? null);
        setSaleProceedsByCategory(res.saleData ?? null);
        setPurchaseItemCounts(res.counts ?? null);
        setSaleItemCounts(res.saleCounts ?? null);
      },
      {
        setLoading: setPurchaseSpendingLoading,
        onError: () => {
          setPurchaseSpending(null);
          setSaleProceedsByCategory(null);
          setPurchaseItemCounts(null);
          setSaleItemCounts(null);
        },
      }
    );
  }, [purchasePeriod, tzOffsetMinutes, statsMediaQuery]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!visibleTypesOrderReady || visibleTypes.length === 0) return;
    registerLogsPageCacheContext({
      mediaTypes: visibleTypes,
      tzOffsetMinutes,
      isPro,
    });
  }, [visibleTypes, visibleTypesOrderReady, tzOffsetMinutes, isPro]);

  useEffect(() => {
    void fetchGenreStats();
  }, [fetchGenreStats]);

  useEffect(() => {
    void fetchGamePlatformStats();
  }, [fetchGamePlatformStats]);

  useEffect(() => {
    void fetchRecentBoardGames();
  }, [fetchRecentBoardGames]);

  useEffect(() => {
    if (genreGraphMode === "statusOverTime") {
      const apiGroup =
        !isPro ? "completedByMonth" : statusOverTimeGroup === "year" ? "completedByYear" : "completedByMonth";
      fetchStatusOverTimeStats(apiGroup);
    }
  }, [isPro, genreGraphMode, statusOverTimeGroup, fetchStatusOverTimeStats]);

  useEffect(() => {
    if (genreGraphMode === "byCategory") {
      const apiGroup =
        !isPro ? "categoryByMonth" : categoryOverTimeGroup === "year" ? "categoryByYear" : "categoryByMonth";
      fetchCategoryOverTimeStats(apiGroup);
    }
  }, [isPro, genreGraphMode, categoryOverTimeGroup, fetchCategoryOverTimeStats]);

  useEffect(() => {
    if (!isPro && purchasePeriod !== "month") setPurchasePeriod("month");
  }, [isPro, purchasePeriod]);

  useEffect(() => {
    if (!isPro && boardGameMatchesPeriod !== "month") setBoardGameMatchesPeriod("month");
  }, [isPro, boardGameMatchesPeriod]);

  useEffect(() => {
    if (!isPro && statsGroup !== "category") setStatsGroup("category");
  }, [isPro, statsGroup]);

  useEffect(() => {
    if (!isPro && statusOverTimeGroup !== "month") setStatusOverTimeGroup("month");
  }, [isPro, statusOverTimeGroup]);

  useEffect(() => {
    if (!isPro && categoryOverTimeGroup !== "month") setCategoryOverTimeGroup("month");
  }, [isPro, categoryOverTimeGroup]);

  useEffect(() => {
    void fetchPurchaseSpending();
  }, [fetchPurchaseSpending]);

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
        setSpendDetailLogs((res.data ?? []).map(decodeLogForDisplay));
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

  const openLogsPeriodActivity = useCallback(
    (
      period: string,
      granularity: StatusOverTimeGroup,
      title: string,
      mediaType?: MediaType
    ) => {
      setLogsPeriodActivity({ period, granularity, title, mediaType });
    },
    []
  );

  useEffect(() => {
    if (!logsPeriodActivity) {
      setLogsPeriodActivityLogs([]);
      setLogsPeriodActivityLoading(false);
      return;
    }
    let cancelled = false;
    setLogsPeriodActivityLoading(true);
    setLogsPeriodActivityLogs([]);
    const mediaQ = logsPeriodActivity.mediaType
      ? `&mediaType=${encodeURIComponent(logsPeriodActivity.mediaType)}`
      : categoryFilter === "all"
        ? ""
        : `&mediaType=${encodeURIComponent(categoryFilter)}`;
    const path = `/logs/by-period?period=${encodeURIComponent(logsPeriodActivity.period)}&granularity=${logsPeriodActivity.granularity}&timezoneOffsetMinutes=${tzOffsetMinutes}${mediaQ}`;
    void apiFetch<{ data: Log[] }>(path)
      .then((res) => {
        if (!cancelled) setLogsPeriodActivityLogs((res.data ?? []).map(decodeLogForDisplay));
      })
      .catch(() => {
        if (!cancelled) setLogsPeriodActivityLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLogsPeriodActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [logsPeriodActivity, categoryFilter, tzOffsetMinutes]);

  const fetchLogs = useCallback(() => {
    const mediaQ = statsMediaQuery();
    const logsQuery = isPro
      ? `/logs?limit=5&sort=dateDesc${mediaQ}`
      : `/logs?limit=5&sort=dateDesc&forStatistics=1&timezoneOffsetMinutes=${tzOffsetMinutes}${mediaQ}`;
    const summaryPath = `/logs/stats?group=summary&timezoneOffsetMinutes=${tzOffsetMinutes}${mediaQ}`;

    const logsCached = getCachedEntry<Log[] | { data: Log[]; nextCursor: string | null }>("GET", logsQuery);
    const summaryCached = getCachedEntry<{ data: LogStatsSummary }>("GET", summaryPath);
    if (!logsCached && !summaryCached) setLoading(true);
    else setLoading(false);

    if (logsCached) {
      const raw = Array.isArray(logsCached.data) ? logsCached.data : logsCached.data.data;
      setLogs((raw ?? []).map(decodeLogForDisplay));
    }
    if (summaryCached) setSummary(summaryCached.data.data ?? null);

    void apiFetchSWR<Log[] | { data: Log[]; nextCursor: string | null }>(logsQuery, {
      ttlMs: HEAVY_PAGE_TTL_MS,
      onUpdate: (res) => {
        const raw = Array.isArray(res) ? res : (res as { data: Log[] }).data;
        setLogs((raw ?? []).map(decodeLogForDisplay));
      },
    })
      .then(({ data, fromCache }) => {
        if (!fromCache) {
          const raw = Array.isArray(data) ? data : data.data;
          setLogs((raw ?? []).map(decodeLogForDisplay));
        }
      })
      .catch(() => {
        if (!logsCached) setLogs([]);
      });

    void apiFetchSWR<{ data: LogStatsSummary }>(summaryPath, {
      ttlMs: HEAVY_PAGE_TTL_MS,
      onUpdate: (res) => setSummary((res as { data: LogStatsSummary }).data ?? null),
    })
      .then(({ data, fromCache }) => {
        if (!fromCache) setSummary(data.data ?? null);
      })
      .catch(() => {
        if (!summaryCached) setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [isPro, tzOffsetMinutes, statsMediaQuery]);

  useEffect(() => {
    const onLogsInvalidated = () => {
      void fetchGamePlatformStats();
      void fetchLogs();
    };
    window.addEventListener(LOGS_INVALIDATED_EVENT, onLogsInvalidated);
    return () => window.removeEventListener(LOGS_INVALIDATED_EVENT, onLogsInvalidated);
  }, [fetchGamePlatformStats, fetchLogs]);

  const recapCategoryOptions = useMemo(
    () => [
      { value: "all", label: t("recap.allMyMedia") },
      ...visibleTypes.map((mt) => ({ value: mt, label: t(`nav.${mt}`) })),
    ],
    [visibleTypes, t]
  );

  const recapPeriodOptions = useMemo(
    () => [
      { value: "week" as const, label: t("recap.periodLastWeek"), disabled: false },
      { value: "month" as const, label: t("recap.periodLastMonth"), disabled: !isPro },
      { value: "year" as const, label: t("recap.periodLastYear"), disabled: !isPro },
    ],
    [isPro, t]
  );

  const recapStatusOptions = useMemo(() => {
    const allOpt = { value: "all", label: t("recap.statusAll") };
    if (recapCategory === "all") {
      return [allOpt];
    }
    const statuses = LOG_STATUS_OPTIONS[recapCategory];
    return [
      allOpt,
      ...statuses.map((s) => ({
        value: s,
        label: getStatusLabel(t, s, recapCategory),
      })),
    ];
  }, [recapCategory, t]);

  useEffect(() => {
    if (recapPickerOpen && !isPro && recapPeriod !== "week") {
      setRecapPeriod("week");
    }
  }, [recapPickerOpen, isPro, recapPeriod]);

  const handleOpenRecapPicker = useCallback(() => {
    setRecapPickerOpen(true);
  }, []);

  const handleSeeRecap = useCallback(async () => {
    const bounds = recapBoundsForPeriod(recapPeriod, tzOffsetMinutes);
    setRecapSubmitting(true);
    try {
      const params = new URLSearchParams({
        recap: "1",
        recapPeriod,
        updatedFrom: bounds.from.toISOString(),
        updatedTo: bounds.to.toISOString(),
        limit: "400",
        sort: "dateDesc",
        timezoneOffsetMinutes: String(tzOffsetMinutes),
      });
      if (recapCategory !== "all") {
        params.set("mediaType", recapCategory);
        if (recapStatusFilter !== "all") {
          params.set("status", recapStatusFilter);
        }
      }
      const res = await apiFetch<{ data: Log[]; nextCursor: string | null }>(`/logs?${params.toString()}`);
      const categoryLabel =
        recapCategory === "all" ? t("recap.allMyMedia") : t(`nav.${recapCategory}`);
      const title = buildRecapTitle({
        period: recapPeriod,
        categoryLabel,
        locale,
        tzOffsetMinutes,
        weekLabel: t("recap.periodLastWeek"),
      });
      setRecapView({ title, logs: (res.data ?? []).map(decodeLogForDisplay) });
      setRecapPickerOpen(false);
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 403) {
        setShowProModal(true);
        return;
      }
      showErrorToast(t, "E010", { originalError: e });
    } finally {
      setRecapSubmitting(false);
    }
  }, [recapPeriod, tzOffsetMinutes, recapCategory, recapStatusFilter, t, locale]);

  useEffect(() => {
    setPageTitle?.(t("nav.statistics"));
    setRightSlot?.(
      <Button
        id="onboarding-statistics-recap"
        variant="outline"
        size="sm"
        className="gap-2 shrink-0 btn-recap-attention"
        onClick={handleOpenRecapPicker}
        aria-label={t("recap.open")}
      >
        {t("recap.button")}
      </Button>
    );
    return () => {
      setPageTitle?.(null);
      setRightSlot?.(null);
      setBelowNavbar?.(null);
    };
  }, [t, setPageTitle, setRightSlot, setBelowNavbar, handleOpenRecapPicker]);

  useEffect(() => {
    if (visibleTypes.length === 0) {
      setBelowNavbar?.(null);
      return;
    }
    if (!visibleTypesOrderReady) {
      setBelowNavbar?.(
        <div className="sticky top-14 z-20 w-full shrink-0 self-start border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)]">
          <CategoryOrderSkeletonStrip />
        </div>
      );
      return () => setBelowNavbar?.(null);
    }
    setBelowNavbar?.(
      <div className="sticky top-14 z-20 w-full shrink-0 self-start border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)]">
        <StickyCategoryStrip
          items={[
            { value: "all", label: t("statistics.filterAll") },
            ...visibleTypes.map((type) => ({
              value: type,
              label: t(`nav.${type}`),
            })),
          ]}
          selectedValue={categoryFilter}
          onSelect={(v) => setCategoryFilter(v === "all" ? "all" : (v as MediaType))}
          showCount={false}
          mobileOnly={false}
          bare
          stickyTop=""
          aria-label={t("statistics.categoryFilter")}
        />
      </div>
    );
    return () => setBelowNavbar?.(null);
  }, [visibleTypes, visibleTypesOrderReady, categoryFilter, t, setBelowNavbar]);

  useEffect(() => {
    if (categoryFilter !== "all" && spendDetailMediaType && spendDetailMediaType !== categoryFilter) {
      setSpendDetailMediaType(null);
    }
  }, [categoryFilter, spendDetailMediaType]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const refreshAll = useCallback(() => {
    invalidateLogsAndItemsCache();
    requestLogsCacheWarm();
    void fetchStats();
    void fetchGenreStats();
    void fetchGamePlatformStats();
    void fetchRecentBoardGames();
    void fetchPurchaseSpending();
    if (genreGraphMode === "statusOverTime") {
      const apiGroup =
        !isPro ? "completedByMonth" : statusOverTimeGroup === "year" ? "completedByYear" : "completedByMonth";
      void fetchStatusOverTimeStats(apiGroup);
    }
    if (genreGraphMode === "byCategory") {
      const apiGroup =
        !isPro ? "categoryByMonth" : categoryOverTimeGroup === "year" ? "categoryByYear" : "categoryByMonth";
      void fetchCategoryOverTimeStats(apiGroup);
    }
    fetchLogs();
  }, [
    fetchStats,
    fetchGenreStats,
    fetchGamePlatformStats,
    fetchRecentBoardGames,
    fetchPurchaseSpending,
    genreGraphMode,
    isPro,
    statusOverTimeGroup,
    categoryOverTimeGroup,
    fetchStatusOverTimeStats,
    fetchCategoryOverTimeStats,
    fetchLogs,
  ]);

  useAppPtrRefresh(refreshAll);

  const recent = logs.slice(0, 5);
  const displayedStats = useMemo(() => {
    if (statsGroup === "category") {
      if (categoryFilter !== "all") {
        const row = stats.find((s) => s.period === categoryFilter);
        return [
          {
            period: categoryFilter,
            hours: row?.hours ?? 0,
            count: row?.count ?? 0,
          },
        ];
      }
      return visibleTypes.map((period) => {
        const row = stats.find((s) => s.period === period);
        return {
          period,
          hours: row?.hours ?? 0,
          count: row?.count ?? 0,
        };
      });
    }
    return stats;
  }, [statsGroup, stats, visibleTypes, categoryFilter]);
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

  const totalSaleItems = useMemo(() => {
    if (!saleItemCounts) return 0;
    return SPEND_TRACKED_MEDIA_TYPES.reduce((acc, mt) => acc + (saleItemCounts[mt] ?? 0), 0);
  }, [saleItemCounts]);

  /** Rows with purchase and/or sale in period (counts may overlap if one log has both). */
  const totalFinanceItems = totalPurchaseItems + totalSaleItems;

  const hasAnyFinanceActivity = useMemo(() => {
    if (purchaseSpendingLoading) return true;
    const spend =
      purchaseSpending &&
      SPEND_TRACKED_MEDIA_TYPES.some((mt) => {
        const by = purchaseSpending[mt];
        return by && Object.keys(by).length > 0;
      });
    const sales =
      saleProceedsByCategory &&
      SPEND_TRACKED_MEDIA_TYPES.some((mt) => {
        const by = saleProceedsByCategory[mt];
        return by && Object.keys(by).length > 0;
      });
    return Boolean(spend || sales);
  }, [purchaseSpending, saleProceedsByCategory, purchaseSpendingLoading]);

  /** Categories with purchase/sale data in the period (counts and/or non-zero totals). */
  const showFinanceSection =
    categoryFilter === "all" ||
    (SPEND_TRACKED_MEDIA_TYPES as readonly string[]).includes(categoryFilter);

  const isAllCategories = categoryFilter === "all";
  const isReadingCategory =
    isAllCategories ||
    categoryFilter === "books" ||
    categoryFilter === "manga" ||
    categoryFilter === "comics";
  const showPagesReadHighlight = isReadingCategory;
  const showBoardGamesWonHighlight = isAllCategories || categoryFilter === "boardgames";
  const showBoardGamesRecentWidget = isAllCategories || categoryFilter === "boardgames";
  const showGamePlatformsWidget = isAllCategories || categoryFilter === "games";
  const showTimeConsumedWidget = isAllCategories;

  const chartModeOptions = useMemo(
    () => [
      { value: "genre" as const, label: t("dashboard.byGenre") },
      { value: "statusOverTime" as const, label: t("dashboard.byStatusOverTime") },
      { value: "byCategory" as const, label: t("dashboard.byCategory") },
    ],
    [t]
  );

  const spendMediaTypesWithActivity = useMemo(() => {
    const active = SPEND_TRACKED_MEDIA_TYPES.filter((mt) => {
      const pCount = purchaseItemCounts?.[mt] ?? 0;
      const sCount = saleItemCounts?.[mt] ?? 0;
      if (pCount > 0 || sCount > 0) return true;
      const spend = Object.values(purchaseSpending?.[mt] ?? {}).some((v) => v > 0);
      const sale = Object.values(saleProceedsByCategory?.[mt] ?? {}).some((v) => v > 0);
      return spend || sale;
    });
    if (categoryFilter === "all") return active;
    if (!showFinanceSection) return [];
    return active.filter((mt) => mt === categoryFilter);
  }, [purchaseItemCounts, saleItemCounts, purchaseSpending, saleProceedsByCategory, categoryFilter, showFinanceSection]);

  const getRecapSpotlightTarget = useCallback(
    () => document.getElementById("onboarding-statistics-recap"),
    []
  );

  return (
    <div className="relative flex min-w-0 flex-col gap-10 overflow-x-hidden">
      <Dialog open={showProModal && !isPro} onOpenChange={setShowProModal}>
        <DialogContent onClose={() => setShowProModal(false)}>
          <DialogHeader>
            <DialogTitle className="min-w-0 text-[var(--color-lightest)]">
              <OverflowMarquee>{t("statistics.proOnlyTitle")}</OverflowMarquee>
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

      {recapPickerOpen ? (
        isMobile ? (
          <Drawer open onOpenChange={(open) => !open && setRecapPickerOpen(false)}>
            <DrawerContent
              mobileHeight="auto"
              className="flex max-h-[min(92dvh,640px)] flex-col gap-4 p-4 sm:p-6"
              onClose={() => setRecapPickerOpen(false)}
            >
              <div className="mt-4 space-y-1">
                <h2 className="text-lg font-semibold text-[var(--color-lightest)]">{t("recap.pickerTitle")}</h2>
                <p className="text-sm text-[var(--color-light)]">{t("recap.pickerSubtitle")}</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-light)]">
                    {t("recap.categoryLabel")}
                  </p>
                  <Select
                    value={recapCategory}
                    onValueChange={(v) => {
                      setRecapStatusFilter("all");
                      setRecapCategory(v === "all" ? "all" : (v as MediaType));
                    }}
                    options={recapCategoryOptions}
                    aria-label={t("recap.categoryLabel")}
                    className="w-full min-w-0"
                    triggerClassName="w-full min-w-0 justify-between gap-2 py-2 h-auto max-md:min-h-[44px] [&>:first-child]:text-left [&>:first-child]:leading-snug"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-light)]">
                    {t("recap.statusLabel")}
                  </p>
                  <Select
                    value={recapStatusFilter}
                    onValueChange={(v) => setRecapStatusFilter(v)}
                    options={recapStatusOptions}
                    disabled={recapCategory === "all"}
                    aria-label={t("recap.statusLabel")}
                    className="w-full min-w-0"
                    triggerClassName="w-full min-w-0 justify-between gap-2 py-2 h-auto max-md:min-h-[44px] [&>:first-child]:text-left [&>:first-child]:leading-snug"
                    contentScrollable
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-light)]">
                    {t("recap.periodLabel")}
                  </p>
                  <Select
                    value={recapPeriod}
                    onValueChange={(v) => setRecapPeriod(v as RecapPeriod)}
                    options={recapPeriodOptions}
                    aria-label={t("recap.periodLabel")}
                    className="w-full min-w-0"
                    triggerClassName="w-full min-w-0 justify-between gap-2 py-2 h-auto max-md:min-h-[44px] [&>:first-child]:text-left [&>:first-child]:leading-snug"
                  />
                </div>
                <Button
                  type="button"
                  className="btn-gradient mt-2 w-full mb-4"
                  disabled={recapSubmitting}
                  onClick={() => void handleSeeRecap()}
                >
                  {recapSubmitting ? t("recap.submitting") : t("recap.seeRecap")}
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open onOpenChange={(open) => !open && setRecapPickerOpen(false)}>
            <DialogContent className="max-w-md" onClose={() => setRecapPickerOpen(false)}>
              <DialogHeader>
                <DialogTitle className="min-w-0 text-[var(--color-lightest)]">{t("recap.pickerTitle")}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-[var(--color-light)]">{t("recap.pickerSubtitle")}</p>
              <div className="flex flex-col gap-3 pt-1">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-light)]">
                    {t("recap.categoryLabel")}
                  </p>
                  <Select
                    value={recapCategory}
                    onValueChange={(v) => {
                      setRecapStatusFilter("all");
                      setRecapCategory(v === "all" ? "all" : (v as MediaType));
                    }}
                    options={recapCategoryOptions}
                    aria-label={t("recap.categoryLabel")}
                    className="w-full min-w-0"
                    triggerClassName="w-full min-w-0 justify-between gap-2 py-2 h-auto max-md:min-h-[44px] [&>:first-child]:text-left [&>:first-child]:leading-snug"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-light)]">
                    {t("recap.statusLabel")}
                  </p>
                  <Select
                    value={recapStatusFilter}
                    onValueChange={(v) => setRecapStatusFilter(v)}
                    options={recapStatusOptions}
                    disabled={recapCategory === "all"}
                    aria-label={t("recap.statusLabel")}
                    className="w-full min-w-0"
                    triggerClassName="w-full min-w-0 justify-between gap-2 py-2 h-auto max-md:min-h-[44px] [&>:first-child]:text-left [&>:first-child]:leading-snug"
                    contentScrollable
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-light)]">
                    {t("recap.periodLabel")}
                  </p>
                  <Select
                    value={recapPeriod}
                    onValueChange={(v) => setRecapPeriod(v as RecapPeriod)}
                    options={recapPeriodOptions}
                    aria-label={t("recap.periodLabel")}
                    className="w-full min-w-0"
                    triggerClassName="w-full min-w-0 justify-between gap-2 py-2 h-auto max-md:min-h-[44px] [&>:first-child]:text-left [&>:first-child]:leading-snug"
                  />
                </div>
                <Button
                  type="button"
                  className="btn-gradient mt-2 w-full"
                  disabled={recapSubmitting}
                  onClick={() => void handleSeeRecap()}
                >
                  {recapSubmitting ? t("recap.submitting") : t("recap.seeRecap")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      ) : null}

      {recapView ? (
        <RecapView title={recapView.title} logs={recapView.logs} onClose={() => setRecapView(null)} />
      ) : null}

      <div className="flex flex-col gap-12">
      {!isPro && (
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-mid)]/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-sm leading-snug text-[var(--color-light)]">
            {t("statistics.freeMonthNotice")}
          </p>
          <Button asChild className="btn-gradient w-full shrink-0 sm:w-auto">
            <Link to="/tiers">{t("tiers.upgradeToPro")}</Link>
          </Button>
        </div>
      )}
      {loading && <StatisticsSummarySkeleton />}
      {!loading && (
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
          className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 md:gap-4"
        >
          {showPagesReadHighlight && (
            <OverviewStatCard
              icon={BookOpen}
              label={t("statistics.pagesReadTitle")}
              value={(summaryData.totalPagesRead ?? 0).toLocaleString(locale)}
            />
          )}
          {showBoardGamesWonHighlight && (
            <OverviewStatCard
              icon={Trophy}
              label={t("statistics.boardGamesWonTitle")}
              value={(summaryData.boardGamesWon ?? 0).toLocaleString(locale)}
            />
          )}
          <OverviewStatCard
            icon={Layers}
            label={t("statistics.summaryTotalLogs")}
            value={summaryData.totalLogs}
          />
          <OverviewStatCard
            icon={CircleCheck}
            label={t("statistics.summaryCompleted")}
            value={summaryData.completedLogs}
          />
          <OverviewStatCard
            icon={Clock}
            label={t("statistics.summaryHours")}
            value={summaryData.totalContentHours.toFixed(1)}
          />
          <OverviewStatCard
            icon={Star}
            label={t("statistics.summaryReviewed")}
            value={summaryData.reviewedLogs}
          />
          <OverviewStatCard
            icon={Scale}
            label={
              isPro ? t("statistics.summaryLifetimeBalance") : t("statistics.summaryMonthBalance")
            }
            valueClassName="!text-base sm:!text-lg md:!text-lg lg:!text-xl xl:!text-xl 2xl:!text-2xl !leading-snug !tracking-tight"
            value={(() => {
              const net = summaryData.lifetimeNetByCurrency ?? {};
              const entries = Object.entries(net).sort(([a], [b]) => a.localeCompare(b));
              if (entries.length === 0) {
                return <span className="text-[var(--color-light)]">—</span>;
              }
              return (
                <div className="flex min-w-0 w-full flex-col gap-1">
                  {entries.map(([currency, minor]) => {
                    const tone =
                      minor > 0
                        ? "text-emerald-400"
                        : minor < 0
                          ? "text-rose-400/90"
                          : "text-[var(--color-lightest)]";
                    return (
                      <span
                        key={currency}
                        className={cn(
                          "min-w-0 max-w-full break-words [overflow-wrap:anywhere] leading-tight",
                          tone
                        )}
                      >
                        {formatSignedMinorAsMoney(minor, currency)}
                      </span>
                    );
                  })}
                </div>
              );
            })()}
          />
        </section>
          )}
        </div>
      )}

      {!loading && showBoardGamesRecentWidget && (
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <button
            type="button"
            onClick={() => setBoardGameMatchesCollapsed(!boardGameMatchesCollapsed)}
            className={collapsibleSectionBtnClass}
            aria-expanded={!boardGameMatchesCollapsed}
          >
            {boardGameMatchesCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{t("statistics.matchesPlayedTitle")}</span>
          </button>
          {!boardGameMatchesCollapsed && (
            <section aria-label={t("statistics.matchesPlayedTitle")} className="min-w-0 w-full">
              <Card
                className="flex min-h-0 min-w-0 flex-col gap-3 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
                style={paperShadow}
              >
                <div className="grid min-w-0 shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  <Select
                    value={boardGameMatchesPeriod}
                    onValueChange={(v) => setBoardGameMatchesPeriod(v as BoardGameMatchesPeriod)}
                    options={
                      isPro
                        ? [
                            { value: "month", label: t("statistics.purchasePeriodMonth") },
                            { value: "year", label: t("statistics.purchasePeriodYear") },
                          ]
                        : [{ value: "month", label: t("statistics.purchasePeriodMonth") }]
                    }
                    aria-label={t("statistics.boardGameMatchesPeriodLabel")}
                    className="min-w-0 w-full"
                    triggerClassName="w-full min-w-0"
                  />
                  <Select
                    value={boardGameMatchesSort}
                    onValueChange={(v) => setBoardGameMatchesSort(v as BoardGameMatchesSort)}
                    options={[
                      { value: "recent", label: t("statistics.boardGameMatchesSortRecent") },
                      { value: "mostPlayed", label: t("statistics.boardGameMatchesSortMostPlayed") },
                      { value: "leastPlayed", label: t("statistics.boardGameMatchesSortLeastPlayed") },
                    ]}
                    aria-label={t("statistics.boardGameMatchesSortLabel")}
                    className="min-w-0 w-full"
                    triggerClassName="w-full min-w-0"
                  />
                </div>
                <BoardGameRecentStatsWidget
                  games={recentBoardGames}
                  loading={recentBoardGamesLoading}
                  locale={locale}
                  t={t}
                />
              </Card>
            </section>
          )}
        </div>
      )}

      {showGamePlatformsWidget && visibleTypesOrderReady && (
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <button
            type="button"
            onClick={() => setGamePlatformsCollapsed(!gamePlatformsCollapsed)}
            className={collapsibleSectionBtnClass}
            aria-expanded={!gamePlatformsCollapsed}
          >
            {gamePlatformsCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{t("statistics.mostPlayedPlatformsTitle")}</span>
          </button>
          {!gamePlatformsCollapsed && (
            <section aria-label={t("statistics.mostPlayedPlatformsTitle")} className="min-w-0 w-full">
              <Card
                className="flex min-h-0 min-w-0 flex-col gap-3 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
                style={paperShadow}
              >
                <GamePlatformStatsWidget
                  stats={gamePlatformStats}
                  loading={gamePlatformStatsLoading}
                  t={t}
                />
              </Card>
            </section>
          )}
        </div>
      )}

      {!loading && showFinanceSection && (
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
            className="overflow-hidden border-[var(--color-surface-border)]/80 bg-[var(--color-dark)] p-4 md:p-6"
            style={paperShadow}
          >
            <div className="mb-5 flex min-w-0 flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              {!purchaseSpendingLoading && totalFinanceItems > 0 && (
                <p className="min-w-0 text-sm text-[var(--color-light)] sm:max-w-[55%]">
                  {t(
                    totalFinanceItems === 1
                      ? "statistics.financeItemsLabel_one"
                      : "statistics.financeItemsLabel_other",
                    { count: String(totalFinanceItems) }
                  )}
                </p>
              )}
              <div className="w-full min-w-0 sm:ml-auto sm:w-auto sm:max-w-[min(18rem,calc(100vw-2rem))] sm:shrink-0">
                <Select
                  value={purchasePeriod}
                  onValueChange={(v) => setPurchasePeriod(v as PurchasePeriod)}
                  options={
                    isPro
                      ? [
                          { value: "month", label: t("statistics.purchasePeriodMonth") },
                          { value: "year", label: t("statistics.purchasePeriodYear") },
                          { value: "all", label: t("statistics.purchasePeriodAll") },
                        ]
                      : [{ value: "month", label: t("statistics.purchasePeriodMonth") }]
                  }
                  aria-label={t("statistics.purchasePeriodLabel")}
                  className="w-full min-w-0"
                  triggerClassName="w-full min-w-0 justify-between gap-2 py-2 h-auto max-md:min-h-[44px] [&>:first-child]:text-left [&>:first-child]:leading-snug"
                />
              </div>
            </div>
            <div className="min-h-[12.5rem] min-w-0">
              {purchaseSpendingLoading ? (
                <StatisticsSpendByCategorySkeleton rows={5} />
              ) : !hasAnyFinanceActivity || spendMediaTypesWithActivity.length === 0 ? (
                <p className="flex min-h-[12.5rem] items-center justify-center px-2 text-center text-sm text-[var(--color-light)]">
                  {t("statistics.purchaseEmpty")}
                </p>
              ) : (
                (() => {
                  let maxMinorGlobal = 0;
                  for (const mt of spendMediaTypesWithActivity) {
                    const spendCur = purchaseSpending?.[mt] ?? {};
                    for (const v of Object.values(spendCur)) {
                      if (v > maxMinorGlobal) maxMinorGlobal = v;
                    }
                    const saleCur = saleProceedsByCategory?.[mt] ?? {};
                    for (const v of Object.values(saleCur)) {
                      if (v > maxMinorGlobal) maxMinorGlobal = v;
                    }
                  }
                  if (maxMinorGlobal === 0) maxMinorGlobal = 1;
                  return (
                    <div className="flex min-w-0 flex-col gap-3">
                      <p className="text-[11px] text-[var(--color-light)]">{t("statistics.spendBarCaption")}</p>
                      {spendMediaTypesWithActivity.map((mt) => {
                        const byCurrency = purchaseSpending?.[mt] ?? {};
                        const bySaleCurrency = saleProceedsByCategory?.[mt] ?? {};
                        const entries = Object.entries(byCurrency).sort(([a], [b]) => a.localeCompare(b));
                        const saleEntries = Object.entries(bySaleCurrency).sort(([a], [b]) =>
                          a.localeCompare(b)
                        );
                        const maxPurchase = Math.max(0, ...entries.map(([, v]) => v), 0);
                        const maxSale = Math.max(0, ...saleEntries.map(([, v]) => v), 0);
                        const pCount = purchaseItemCounts?.[mt] ?? 0;
                        const sCount = saleItemCounts?.[mt] ?? 0;
                        const categoryFinanceItems = pCount + sCount;
                        const currencyKeys = Array.from(
                          new Set([...Object.keys(byCurrency), ...Object.keys(bySaleCurrency)])
                        ).sort((a, b) => a.localeCompare(b));
                        const netSpans = currencyKeys
                          .filter((c) => (byCurrency[c] ?? 0) + (bySaleCurrency[c] ?? 0) > 0)
                          .map((currency) => {
                            const net = (bySaleCurrency[currency] ?? 0) - (byCurrency[currency] ?? 0);
                            const tone =
                              net > 0
                                ? "text-emerald-400"
                                : net < 0
                                  ? "text-rose-400/90"
                                  : "text-[var(--color-light)]";
                            return (
                              <span
                                key={`${mt}-net-${currency}`}
                                className={cn("text-sm font-semibold tabular-nums tracking-tight", tone)}
                              >
                                {formatSignedMinorAsMoney(net, currency)}
                              </span>
                            );
                          });
                        const shell =
                          "rounded-2xl border border-[var(--color-surface-border)]/55 bg-[var(--color-darkest)]/20 px-4 py-3.5 sm:px-5 sm:py-4";
                        const body = (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[var(--color-lightest)]">
                                  {t(`nav.${mt}`)}
                                </p>
                                {categoryFinanceItems > 0 ? (
                                  <p className="mt-0.5 text-xs tabular-nums text-[var(--color-light)]">
                                    {t(
                                      categoryFinanceItems === 1
                                        ? "statistics.financeItemsLabel_one"
                                        : "statistics.financeItemsLabel_other",
                                      { count: String(categoryFinanceItems) }
                                    )}
                                  </p>
                                ) : null}
                              </div>
                              <ChevronRight
                                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mid)]"
                                aria-hidden
                              />
                            </div>
                            <div className="mt-3">
                              <SpendCategorySegmentBar
                                purchaseMinor={maxPurchase}
                                saleMinor={maxSale}
                                globalMaxMinor={maxMinorGlobal}
                              />
                            </div>
                            <div className="mt-3 flex min-w-0 flex-col items-end gap-1 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-x-4 sm:gap-y-1">
                              {netSpans.length === 0 ? (
                                <span className="text-sm text-[var(--color-light)]">—</span>
                              ) : (
                                netSpans
                              )}
                            </div>
                          </>
                        );
                        return (
                          <button
                            key={mt}
                            type="button"
                            onClick={() => setSpendDetailMediaType(mt)}
                            className={cn(
                              shell,
                              "w-full cursor-pointer text-left transition-[transform,background-color,border-color] hover:border-[var(--color-mid)]/40 hover:bg-[var(--color-mid)]/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] active:scale-[0.995]"
                            )}
                            title={t("statistics.financeDetailOpen", { category: t(`nav.${mt}`) })}
                            aria-label={t("statistics.financeDetailOpen", { category: t(`nav.${mt}`) })}
                          >
                            {body}
                          </button>
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

      {spendDetailMediaType &&
        (isMobile ? (
          <Drawer open onOpenChange={(open) => !open && setSpendDetailMediaType(null)}>
            <DrawerContent
              mobileHeight="auto"
              className="flex max-h-[min(92dvh,640px)] flex-col gap-4 p-4 sm:p-6"
              onClose={() => setSpendDetailMediaType(null)}
            >
              {/* Single scroll surface: DrawerContent already wraps body in overflow-y-auto on mobile (nested flex+overflow breaks touch scroll on WebKit). */}
              <div className="mt-2 flex min-w-0 flex-col gap-4">
                <SpendFinanceDetailHeader categoryKey={spendDetailMediaType} t={t} />
                <SpendFinanceDetailList
                  loading={spendDetailLoading}
                  logs={spendDetailLogs}
                  t={t}
                  onNavigate={() => setSpendDetailMediaType(null)}
                />
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open onOpenChange={(open) => !open && setSpendDetailMediaType(null)}>
            <DialogContent
              className="flex max-h-[85vh] max-w-md flex-col"
              onClose={() => setSpendDetailMediaType(null)}
            >
              <DialogHeader className="shrink-0 space-y-2 pr-8 text-left sm:pr-10">
                <DialogTitle asChild>
                  <div className="min-w-0">
                    <SpendFinanceDetailHeader categoryKey={spendDetailMediaType} t={t} />
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="min-h-0 -mx-1 max-h-[min(60vh,520px)] flex-1 overflow-y-auto overscroll-contain px-1 [-webkit-overflow-scrolling:touch]">
                <SpendFinanceDetailList
                  loading={spendDetailLoading}
                  logs={spendDetailLogs}
                  t={t}
                  onNavigate={() => setSpendDetailMediaType(null)}
                  listGapClassName="gap-3"
                />
              </div>
            </DialogContent>
          </Dialog>
        ))}

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
          <DashboardCalendar
            access={isPro ? "full" : "monthOnly"}
            fillColumnHeight
            mediaType={categoryFilter === "all" ? undefined : categoryFilter}
          />
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
              options={chartModeOptions}
              aria-label={t("dashboard.byGenre")}
              className="w-full min-w-0 sm:max-w-[220px]"
              triggerClassName="w-full min-w-0"
            />
            {genreGraphMode === "statusOverTime" && isPro && (
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
            {genreGraphMode === "byCategory" && isPro && (
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
                          <OverflowMarquee className={statBarMarqueeClass}>{period}</OverflowMarquee>
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
                <div className="flex min-w-0 flex-col gap-4 overflow-hidden">
                  {statusOverTimeStats.map(({ period, hours, count }) => {
                    const itemCount = count ?? hours;
                    const timeLabel = formatStatsTimeAxisLabel(
                      period,
                      statusOverTimeGroup === "year" ? "year" : "month",
                      locale
                    );
                    const activityTitle = t("statistics.activityInPeriod", { period: timeLabel });
                    const periodBody = (
                      <>
                        <StatsTimeSectionDivider label={timeLabel} />
                        <div className={statBarGridClass}>
                          <div className="flex min-h-[2.25rem] min-w-0 flex-col justify-center gap-0.5 leading-tight">
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
                      </>
                    );
                    return (
                      <div key={period} className="flex min-w-0 flex-col gap-2">
                        {itemCount > 0 ? (
                          <button
                            type="button"
                            className={cn(logsPeriodActivityBtnClass, "flex-col items-stretch gap-2")}
                            onClick={() =>
                              openLogsPeriodActivity(period, statusOverTimeGroup, activityTitle)
                            }
                            aria-label={activityTitle}
                          >
                            {periodBody}
                          </button>
                        ) : (
                          periodBody
                        )}
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
                <div className="flex min-w-0 flex-col gap-4 overflow-hidden">
                  {categoryOverTimePeriods.map((period) => {
                    const timeLabel = formatStatsTimeAxisLabel(
                      period,
                      categoryOverTimeGroup === "year" ? "year" : "month",
                      locale
                    );
                    const periodActivityTitle = t("statistics.activityInPeriod", { period: timeLabel });
                    const periodRows = categoryOverTimeByPeriod[period] ?? [];
                    const periodHasActivity = periodRows.some(({ hours, count }) => (count ?? hours) > 0);
                    return (
                      <div key={period} className="flex min-w-0 flex-col gap-2">
                        {periodHasActivity ? (
                          <button
                            type="button"
                            className={logsPeriodActivityBtnClass}
                            onClick={() =>
                              openLogsPeriodActivity(period, categoryOverTimeGroup, periodActivityTitle)
                            }
                            aria-label={periodActivityTitle}
                          >
                            <StatsTimeSectionDivider label={timeLabel} />
                          </button>
                        ) : (
                          <StatsTimeSectionDivider label={timeLabel} />
                        )}
                        <div className="flex min-w-0 flex-col gap-1">
                          {periodRows.map(({ mediaType, hours, count }) => {
                            const itemCount = count ?? hours;
                            const rowTitle = t("statistics.activityInPeriodCategory", {
                              period: timeLabel,
                              category: t(`nav.${mediaType}`),
                            });
                            const rowBody = (
                              <>
                                <div className="flex min-h-[2.25rem] min-w-0 flex-col justify-center gap-0.5 leading-tight">
                                  <OverflowMarquee className={statBarMarqueeClass}>
                                    {t(`nav.${mediaType}`)}
                                  </OverflowMarquee>
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
                                    style={{
                                      width: `${Math.max(5, (hours / maxCategoryOverTimeCount) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className={statBarValueClass}>
                                  {t("dashboard.logsCount", { count: String(Math.round(hours)) })}
                                </span>
                              </>
                            );
                            return (
                              <div key={`${period}-${mediaType}`}>
                                {itemCount > 0 ? (
                                  <button
                                    type="button"
                                    className={cn(
                                      statBarGridClass,
                                      "w-full rounded-lg transition-colors hover:bg-[var(--color-mid)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] max-md:min-h-[44px]"
                                    )}
                                    onClick={() =>
                                      openLogsPeriodActivity(
                                        period,
                                        categoryOverTimeGroup,
                                        rowTitle,
                                        mediaType as MediaType
                                      )
                                    }
                                    aria-label={rowTitle}
                                  >
                                    {rowBody}
                                  </button>
                                ) : (
                                  <div className={statBarGridClass}>{rowBody}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          </div>
        </Card>
          )}
        </div>
      </div>

      <div
        className={cn(
          "grid min-w-0 grid-cols-1 gap-10 overflow-hidden md:items-stretch md:gap-10",
          showTimeConsumedWidget && "md:grid-cols-2"
        )}
      >
        {showTimeConsumedWidget && (
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
                        options={
                          isPro
                            ? [
                                { value: "category", label: t("dashboard.byCategory") },
                                { value: "month", label: t("dashboard.byMonth") },
                                { value: "year", label: t("dashboard.byYear") },
                              ]
                            : [{ value: "category", label: t("dashboard.byCategory") }]
                        }
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
                        <div
                          className={cn(
                            "flex min-w-0 flex-col overflow-hidden",
                            statsGroup === "category" ? "gap-2" : "gap-4"
                          )}
                        >
                          {displayedStats.map(({ period, hours, count }) => {
                            const isTimeAxis = statsGroup === "month" || statsGroup === "year";
                            const timeLabel = isTimeAxis
                              ? formatStatsTimeAxisLabel(
                                  period,
                                  statsGroup === "year" ? "year" : "month",
                                  locale
                                )
                              : null;
                            const barRow = (
                              <div className={statBarGridClass}>
                                <div className="flex min-h-[2.25rem] min-w-0 flex-col justify-center gap-0.5 leading-tight">
                                  {!isTimeAxis && (
                                    <OverflowMarquee className={statBarMarqueeClass}>
                                      {t(`nav.${period}`)}
                                    </OverflowMarquee>
                                  )}
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
                            );
                            return (
                              <div key={period} className={cn(isTimeAxis && "flex min-w-0 flex-col gap-2")}>
                                {isTimeAxis && timeLabel != null && (
                                  <StatsTimeSectionDivider label={timeLabel} />
                                )}
                                {barRow}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

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
                      <Link to="/" className="text-[var(--color-lightest)] underline hover:no-underline">
                        {t("dashboard.searchAndAddFirst")}
                      </Link>
                    </span>
                  </p>
                </Card>
              ) : (
                <motion.ul
                  className="m-0 flex min-h-0 min-w-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-0"
                  {...listStaggerParentProps}
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
                      <motion.li
                        key={log.id}
                        variants={listStaggerItemVariants}
                        className={`list-none ${listStaggerItemClassName}`}
                      >
                        <MotionLink
                          to={itemDetailPath(log.mediaType, log.externalId)}
                          whileTap={tapScale}
                          transition={tapTransition}
                          className={`flex min-w-0 flex-row overflow-hidden rounded-lg border bg-[var(--color-dark)] text-left text-inherit no-underline shadow-[var(--shadow-card)] transition-[opacity,border-color] hover:opacity-95 max-md:min-h-[44px] ${listBorderClass} ${status == null ? "hover:border-black" : ""}`}
                        >
                            <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-l-lg sm:h-[5.6rem] sm:w-16">
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
                              <OverflowMarquee className="text-[10px] font-medium uppercase text-[var(--color-light)]">
                                {t(`nav.${log.mediaType}`)}
                              </OverflowMarquee>
                              <OverflowMarquee className="text-sm font-semibold text-[var(--color-lightest)]">
                                {log.title}
                              </OverflowMarquee>
                              {log.genres && log.genres.length > 0 && (
                                <GenreBadges genres={log.genres} maxCount={1} />
                              )}
                              {log.grade != null && (
                                <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                              )}
                              <OverflowMarquee className="text-xs leading-snug text-[var(--color-light)]">
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
                              </OverflowMarquee>
                            </div>
                        </MotionLink>
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
      <LogActivitySheet
        open={logsPeriodActivity != null}
        onClose={() => setLogsPeriodActivity(null)}
        title={logsPeriodActivity?.title ?? ""}
        logs={logsPeriodActivityLogs}
        loading={logsPeriodActivityLoading}
      />

      <OnboardingSpotlight
        storageKey={ONBOARDING_SPOTLIGHT_KEYS.statisticsRecap}
        getTarget={getRecapSpotlightTarget}
        message={t("onboarding.spotlightStatisticsRecap")}
      />
    </div>
  );
}
