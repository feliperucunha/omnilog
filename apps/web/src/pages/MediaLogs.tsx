import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, AlertTriangle, Plus, Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { MediaType, Log } from "@dogument/shared";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, LOG_STATUS_OPTIONS } from "@dogument/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { apiFetch, apiFetchCached, apiFetchPublic, invalidateLogsAndItemsCache, apiFetchFile } from "@/lib/api";
import { showAchievementToasts } from "@/lib/achievementToast";
import { LogForm } from "@/components/LogForm";
import { CustomBatchEntryModal } from "@/components/CustomBatchEntryModal";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { ItemImage } from "@/components/ItemImage";
import { GenreBadges } from "@/components/GenreBadges";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { MediaLogsSkeleton } from "@/components/skeletons";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { useLogComplete } from "@/contexts/LogCompleteContext";
import { useMe } from "@/contexts/MeContext";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const cardShadow = { boxShadow: "var(--shadow-card)" };

const LOGS_PAGE_SIZE = 24;
/** Character count for review preview before "View more". ~2 lines on mobile. */
const REVIEW_PREVIEW_LENGTH = 120;

type LogsResponse = Log[] | { data: Log[]; nextCursor: string | null };

/** Milestone progress for one category (reviews + logs). */
export interface CategoryMilestoneProgress {
  mediaType: string;
  reviews: {
    current: number;
    next: { threshold: number; label: string; icon: string } | null;
    progressPct: number;
    earned: Array<{ threshold: number; label: string; icon: string }>;
  };
  logs: {
    current: number;
    next: { threshold: number; label: string; icon: string } | null;
    progressPct: number;
    earned: Array<{ threshold: number; label: string; icon: string }>;
  };
}

interface MediaLogsProps {
  mediaType: MediaType;
  /** When true, rendered inside Dashboard: no watermark background. */
  embedded?: boolean;
  /** When set, read-only public profile: fetch from /users/:id/logs, hide all write UI. */
  publicUserId?: string;
  /** When set (e.g. from Dashboard), show next milestone progress for this category. */
  milestoneProgress?: CategoryMilestoneProgress | null;
  /** When set (e.g. from Dashboard), use as initial data so no skeleton is shown on first paint. */
  initialLogs?: Log[];
  initialNextCursor?: string | null;
}

export function MediaLogs({ mediaType, embedded = false, publicUserId, milestoneProgress: milestoneProgressProp, initialLogs: initialLogsProp, initialNextCursor: initialNextCursorProp }: MediaLogsProps) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { showLogComplete } = useLogComplete();
  const { me } = useMe();
  const boardGameProvider = me?.boardGameProvider ?? "bgg";
  const provider = getApiKeyProviderForMediaType(mediaType, boardGameProvider);
  const hasBoardGameKey = !!(me?.apiKeys?.bgg || me?.apiKeys?.ludopedia);
  const needsKeyBanner =
    !publicUserId &&
    provider != null &&
    (mediaType === "boardgames" ? !hasBoardGameKey : me?.apiKeys && !me.apiKeys[provider]);
  const readOnly = !!publicUserId;
  const hasInitialData = embedded && initialLogsProp !== undefined;
  const [logs, setLogs] = useState<Log[]>(() => (hasInitialData && initialLogsProp) ? initialLogsProp : []);
  const [nextCursor, setNextCursor] = useState<string | null>(() => (hasInitialData && initialNextCursorProp !== undefined) ? initialNextCursorProp : null);
  const [loading, setLoading] = useState(!(hasInitialData && initialLogsProp !== undefined));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [editingLogEpisodesCount, setEditingLogEpisodesCount] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [statusCounts, setStatusCounts] = useState<{ total: number; byStatus: Record<string, number> } | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "grade">("date");
  const [showCustomEntry, setShowCustomEntry] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [incrementingId, setIncrementingId] = useState<string | null>(null);
  const [exportingCategory, setExportingCategory] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  /** Log id whose review is expanded in-card (no modal). */
  const [expandedReviewLogId, setExpandedReviewLogId] = useState<string | null>(null);
  const [milestoneProgressFetched, setMilestoneProgressFetched] = useState<CategoryMilestoneProgress | null>(null);

  const milestoneProgress = milestoneProgressProp ?? (readOnly ? null : milestoneProgressFetched);

  useEffect(() => {
    if (readOnly || milestoneProgressProp != null || !me) return;
    apiFetch<{ perMedium: CategoryMilestoneProgress[] }>("/me/milestones/progress")
      .then((res) => {
        const forMedia = res.perMedium?.find((p) => p.mediaType === mediaType) ?? null;
        setMilestoneProgressFetched(forMedia);
      })
      .catch(() => setMilestoneProgressFetched(null));
  }, [readOnly, milestoneProgressProp, mediaType, me]);

  const EPISODE_TYPES: MediaType[] = ["tv", "anime"];
  const CHAPTER_TYPES: MediaType[] = ["manga"];
  const VOLUME_TYPES: MediaType[] = ["comics"];
  const hasProgressButton =
    EPISODE_TYPES.includes(mediaType) || CHAPTER_TYPES.includes(mediaType) || VOLUME_TYPES.includes(mediaType);

  const getProgress = (log: Log): { field: "episode" | "chapter" | "volume"; value: number; labelKey: string } => {
    if (EPISODE_TYPES.includes(log.mediaType))
      return { field: "episode", value: log.episode ?? 0, labelKey: "itemReviewForm.episode" };
    if (CHAPTER_TYPES.includes(log.mediaType))
      return { field: "chapter", value: log.chapter ?? 0, labelKey: "itemReviewForm.chapter" };
    return { field: "volume", value: log.volume ?? 0, labelKey: "itemReviewForm.volume" };
  };

  const fetchLogs = useCallback(
    (reset = true) => {
      if (!reset && (loadingMore || !nextCursor)) return;
      if (reset) {
        setError(null);
        setLoading(true);
        setNextCursor(null);
      } else {
        setLoadingMore(true);
      }
      const params = new URLSearchParams({
        mediaType,
        sort: sortBy,
        limit: String(LOGS_PAGE_SIZE),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const path = publicUserId
        ? `/users/${publicUserId}/logs?${params.toString()}`
        : `/logs?${params.toString()}`;
      const fetcher = publicUserId
        ? () => apiFetchPublic<LogsResponse>(path)
        : () =>
            reset && !nextCursor
              ? apiFetchCached<LogsResponse>(path, { ttlMs: 2 * 60 * 1000 })
              : apiFetch<LogsResponse>(path);
      fetcher()
        .then((response) => {
          const list = Array.isArray(response) ? response : response.data;
          const cursor = Array.isArray(response) ? null : response.nextCursor;
          setLogs((prev) => (reset ? list : [...prev, ...list]));
          setNextCursor(cursor);
        })
        .catch((err) => {
          if (reset) setLogs([]);
          setError(err instanceof Error ? err.message : t("mediaLogs.couldntLoadLogs"));
        })
        .finally(() => {
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [mediaType, statusFilter, sortBy, nextCursor, loadingMore, t, publicUserId]
  );

  const fetchStatusCounts = useCallback(() => {
    const path = publicUserId
      ? `/users/${publicUserId}/logs/status-counts?mediaType=${encodeURIComponent(mediaType)}`
      : `/logs/status-counts?mediaType=${encodeURIComponent(mediaType)}`;
    const fetcher = publicUserId
      ? () => apiFetchPublic<{ data: { total: number; byStatus: Record<string, number> } }>(path)
      : () => apiFetchCached<{ data: { total: number; byStatus: Record<string, number> } }>(path, { ttlMs: 2 * 60 * 1000 });
    fetcher()
      .then((res) => setStatusCounts(res.data ?? null))
      .catch(() => setStatusCounts(null));
  }, [mediaType, publicUserId]);

  useEffect(() => {
    const useInitial = embedded && initialLogsProp !== undefined;
    if (useInitial) {
      setLogs(initialLogsProp ?? []);
      setNextCursor(initialNextCursorProp ?? null);
      setError(null);
      setLoading(false);
    } else {
      setLogs([]);
      setNextCursor(null);
      setError(null);
      setLoading(true);
      fetchLogsRef.current(true);
    }
  }, [mediaType, statusFilter, sortBy, publicUserId, embedded, initialLogsProp, initialNextCursorProp]);

  useEffect(() => {
    setStatusCounts(null);
    fetchStatusCounts();
  }, [fetchStatusCounts]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fetchLogsRef = useRef(fetchLogs);
  fetchLogsRef.current = fetchLogs;
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        fetchLogsRef.current(false);
      },
      { rootMargin: "200px", threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!editingLog) {
      setEditingLogEpisodesCount(null);
      return;
    }
    if (editingLog.mediaType !== "tv" && editingLog.mediaType !== "anime") return;
    apiFetchCached<{ episodesCount?: number | null }>(
      `/items/${editingLog.mediaType}/${encodeURIComponent(editingLog.externalId)}`,
      { ttlMs: 5 * 60 * 1000 }
    )
      .then((item) => setEditingLogEpisodesCount(item.episodesCount ?? null))
      .catch(() => setEditingLogEpisodesCount(null));
  }, [editingLog]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/logs/${id}`, { method: "DELETE" });
      invalidateLogsAndItemsCache();
      setLogs((prev) => prev.filter((l) => l.id !== id));
      setEditingLog(null);
      fetchStatusCounts();
      toast.success(t("toast.logDeleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = (completion?: LogCompleteState) => {
    setEditingLog(null);
    invalidateLogsAndItemsCache();
    fetchLogs();
    fetchStatusCounts();
    if (completion) showLogComplete(completion);
  };

  const handleIncrement = async (log: Log) => {
    const { field, value } = getProgress(log);
    const next = value + 1;
    setIncrementingId(log.id);
    try {
      const updated = await apiFetch<Log & { newBadges?: Array<{ id: string; name: string; icon: string }> }>(
        `/logs/${log.id}`,
        { method: "PATCH", body: JSON.stringify({ [field]: next }) }
      );
      if (updated.newBadges?.length) showAchievementToasts(updated.newBadges, t("dashboard.badgesAchievementUnlocked"));
      invalidateLogsAndItemsCache();
      setLogs((prev) => prev.map((l) => (l.id === log.id ? updated : l)));
      toast.success(t("toast.logUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.failedToSave"));
    } finally {
      setIncrementingId(null);
    }
  };

  const label = t(`nav.${mediaType}`);

  const handleCategorySearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = categorySearchQuery.trim();
    navigate("/search", { state: { mediaType, query: q || undefined } });
  };

  const isPro = me?.tier === "pro";
  const handleExportCategory = async () => {
    if (!isPro) {
      setShowProModal(true);
      return;
    }
    setExportingCategory(true);
    try {
      const { blob, filename } = await apiFetchFile(`/logs/export?mediaType=${encodeURIComponent(mediaType)}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("mediaLogs.exportCategorySuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tiers.exportFailed"));
    } finally {
      setExportingCategory(false);
    }
  };

  if (loading && logs.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <MediaLogsSkeleton />
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
        <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-4">
            <p className="font-medium text-[var(--color-lightest)]">
              {t("mediaLogs.couldntLoadLogs")}
            </p>
            <p className="text-sm text-[var(--color-light)]">{error}</p>
            <Button onClick={() => fetchLogs(true)}>
              {t("common.tryAgain")}
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  const statusOptions = LOG_STATUS_OPTIONS[mediaType];

  return (
    <div className={`relative min-h-full min-w-0 overflow-hidden pb-24 md:pb-20 ${embedded ? "" : ""}`}>
      {!readOnly && (
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
      )}
      {!embedded && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center" aria-hidden>
          <Logo alt="" className="h-40 w-auto opacity-20 sm:h-52 md:h-64" />
        </div>
      )}
      <div className="relative z-10 flex min-w-0 flex-col gap-6 overflow-hidden">
      {needsKeyBanner && !embedded && (
        <Link
          to="/settings?open=api-keys"
          className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 max-md:min-h-[44px] text-left no-underline transition-colors text-[var(--color-warning-text)] hover:border-[var(--color-warning-hover-border)] hover:bg-[var(--color-warning-hover-bg)]"
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-[var(--color-warning-icon)]" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-warning-text)]">
            {t("apiKeyBanner.categoryMessage", {
              category: label,
              provider: API_KEY_META[provider!].name,
            })}
          </p>
          <span className="shrink-0 text-xs font-medium text-[var(--color-warning-text-muted)]">
            {t("apiKeyBanner.addKeyInSettings")} →
          </span>
        </Link>
      )}
      <div className="flex min-w-0 flex-col gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 overflow-hidden">
          <h1 className="min-w-0 truncate text-2xl font-bold text-[var(--color-lightest)]">
            {label}
          </h1>
          {!readOnly && (
          <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center gap-3">
            <motion.div whileTap={tapScale} transition={tapTransition}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCustomEntry(true)}
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t("customEntry.addCustomBatchEntry")}
                </span>
              </Button>
            </motion.div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "shrink-0",
                !isPro && "opacity-60 cursor-pointer"
              )}
              onClick={handleExportCategory}
              disabled={exportingCategory}
              title={t("mediaLogs.exportCategory")}
              aria-label={t("mediaLogs.exportCategory")}
            >
              {exportingCategory ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        )}
        </div>
        {!readOnly && milestoneProgress && (() => {
          const scope = milestoneProgress.reviews.next ? milestoneProgress.reviews : milestoneProgress.logs;
          const currentBadge = milestoneProgress.reviews.earned.length > 0
            ? milestoneProgress.reviews.earned[milestoneProgress.reviews.earned.length - 1]
            : milestoneProgress.logs.earned.length > 0
              ? milestoneProgress.logs.earned[milestoneProgress.logs.earned.length - 1]
              : null;
          const next = scope.next;
          const displayCurrent = next ? Math.min(scope.current, next.threshold) : scope.current;
          const displayPct = scope.progressPct;
          return (
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              {currentBadge && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-dark)]/80 px-2.5 py-1 text-xs font-medium text-[var(--color-lightest)] sm:px-3 sm:py-1.5 sm:text-sm"
                  title={currentBadge.label}
                >
                  <span aria-hidden>{currentBadge.icon}</span>
                  <span className="max-w-[120px] truncate sm:max-w-[180px]">{currentBadge.label}</span>
                </span>
              )}
              {next && (
                <div className="flex min-w-0 flex-1 items-center gap-2 min-[400px]:min-w-0">
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-darkest)] max-w-[200px] sm:max-w-[240px]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)] transition-all duration-500"
                      style={{
                        width: `${displayPct}%`,
                        minWidth: displayCurrent > 0 ? "4px" : 0,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-[var(--color-light)]" title={next.label}>
                    {t("mediaLogs.badgeProgressReviews", {
                      current: String(displayCurrent),
                      target: String(next.threshold),
                    })}
                  </span>
                </div>
              )}
            </div>
          );
        })()}
      </div>
      {!readOnly && showCustomEntry && (
        <CustomBatchEntryModal
          mediaType={mediaType}
          onSaved={(completion) => {
            setShowCustomEntry(false);
            if (completion) handleSaved(completion);
          }}
          onCancel={() => setShowCustomEntry(false)}
        />
      )}

      {!readOnly && (
      <div className="flex min-w-0 flex-wrap items-center gap-3 overflow-hidden">
        {/* Mobile (< md): custom dropdowns, no labels */}
        <div className="grid w-full grid-cols-2 gap-2 md:hidden">
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: "", label: statusCounts != null ? `${t("mediaLogs.filterAll")} (${statusCounts.total})` : t("mediaLogs.filterAll") },
              ...statusOptions.map((s) => ({
                value: s,
                label: statusCounts != null ? `${getStatusLabel(t, s, mediaType)} (${statusCounts.byStatus[s] ?? 0})` : getStatusLabel(t, s, mediaType),
              })),
            ]}
            aria-label={t("itemReviewForm.status")}
            className="min-w-0 w-full"
            triggerClassName="w-full max-w-none min-w-0"
          />
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as "date" | "grade")}
            options={[
              { value: "date", label: t("mediaLogs.sortByDate") },
              { value: "grade", label: t("mediaLogs.sortByGrade") },
            ]}
            aria-label={t("mediaLogs.sortLabel")}
            className="min-w-0 w-full"
            triggerClassName="w-full max-w-none min-w-0"
          />
        </div>
        {/* Desktop (md+): buttons with labels */}
        <div className="hidden md:flex min-w-0 flex-wrap items-center gap-3">
        <span className="shrink-0 text-sm text-[var(--color-light)]">{t("itemReviewForm.status")}:</span>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button
            type="button"
            variant={statusFilter === "" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("")}
          >
            {statusCounts != null ? `${t("mediaLogs.filterAll")} (${statusCounts.total})` : t("mediaLogs.filterAll")}
          </Button>
          {statusOptions.map((statusValue) => (
            <Button
              key={statusValue}
              type="button"
              variant={statusFilter === statusValue ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(statusValue)}
            >
              {statusCounts != null ? `${getStatusLabel(t, statusValue, mediaType)} (${statusCounts.byStatus[statusValue] ?? 0})` : getStatusLabel(t, statusValue, mediaType)}
            </Button>
          ))}
        </div>
        <span className="ml-2 shrink-0 text-sm text-[var(--color-light)] md:ml-4">{t("mediaLogs.sortLabel")}</span>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button
            type="button"
            variant={sortBy === "date" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("date")}
          >
            {t("mediaLogs.sortByDate")}
          </Button>
          <Button
            type="button"
            variant={sortBy === "grade" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("grade")}
          >
            {t("mediaLogs.sortByGrade")}
          </Button>
        </div>
        </div>
      </div>
      )}

      {logs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="flex flex-1 flex-col items-center justify-center min-h-[50vh] py-12"
        >
          <p className="text-center text-[var(--color-light)]">
            {t("mediaLogs.noLogsFor", { label: label.toLowerCase() })}
          </p>
          {!readOnly && (
            <Link
              to="/search"
              state={{ mediaType }}
              className="mt-4 inline-block text-[var(--color-lightest)] underline hover:no-underline"
            >
              {t("mediaLogs.searchAndAddOne")}
            </Link>
          )}
        </motion.div>
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="min-w-0 overflow-hidden">
          <div className="flex min-w-0 flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {logs.map((log) => {
              const isDropped = log.status === "dropped";
              const isInProgress = log.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log.status);
              const isCompleted = log.status != null && (COMPLETED_STATUSES as readonly string[]).includes(log.status);
              const listBorderClass =
                log.status == null
                  ? "border border-[var(--color-surface-border)]"
                  : isDropped
                    ? "border border-red-500"
                    : isInProgress
                      ? "border border-amber-400"
                      : isCompleted
                        ? "border border-emerald-600"
                        : "border border-[var(--color-mid)]";
              const isReviewExpanded = embedded && expandedReviewLogId === log.id;
              return (
              <motion.div key={log.id} variants={staggerItem} className="min-h-0 sm:h-full">
                <motion.div whileTap={tapScale} transition={tapTransition} className="h-full">
                  <Card
                    className={`relative flex flex-row min-h-0 overflow-hidden rounded-lg bg-[var(--color-dark)] p-0 ${embedded && !isReviewExpanded ? "h-[193px] min-h-[193px] max-h-[193px] sm:h-[193px] sm:min-h-[193px] sm:max-h-[193px]" : embedded ? "min-h-[160px]" : "min-h-[140px] sm:min-h-[160px]"} ${listBorderClass}`}
                    style={cardShadow}
                  >
                    {!readOnly && deletingId === log.id && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0D1B2A]/70">
                        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-light)]" />
                      </div>
                    )}
                    {/* Left: image full height – flush with card edge, radius matches card (rounded-lg); click goes to item page */}
                    <Link
                      to={`/item/${log.mediaType}/${log.externalId}`}
                      className="h-full min-h-full w-28 flex-shrink-0 overflow-hidden rounded-l-lg sm:w-32 block"
                    >
                      <ItemImage src={log.image} className="h-full w-full object-cover" />
                    </Link>
                    {/* Middle: title, grade, badge, episode, review */}
                    <div className={`flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden p-3 sm:p-4 ${embedded && !isReviewExpanded ? "min-h-0" : ""}`}>
                      <Link
                        to={`/item/${log.mediaType}/${log.externalId}`}
                        className="line-clamp-2 font-semibold text-[var(--color-lightest)] no-underline hover:underline text-sm sm:text-base"
                      >
                        {log.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        {log.grade != null ? (
                          <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                        ) : (
                          <span className="text-[var(--color-light)]">—</span>
                        )}
                        <GenreBadges genres={log.genres} maxCount={1} />
                        {(() => {
                          const duration = log.startedAt && log.completedAt ? formatTimeToFinish(log.startedAt, log.completedAt) : "";
                          return duration ? (
                            <span className="text-[10px] sm:text-xs text-[var(--color-light)]">
                              {t("dashboard.finishedIn", { duration })}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      {hasProgressButton && (() => {
                        const p = getProgress(log);
                        return (
                          <span className="text-xs text-[var(--color-light)]">
                            {t(p.labelKey)}: {p.value}
                          </span>
                        );
                      })()}
                      <div className={`flex flex-col items-start gap-1 min-h-0 ${embedded && !isReviewExpanded ? "flex-1 overflow-hidden" : ""}`}>
                        {log.review ? (
                          (() => {
                            const review = log.review;
                            const isExpanded = expandedReviewLogId === log.id;
                            const truncated = review.length > REVIEW_PREVIEW_LENGTH;
                            const preview = truncated && !isExpanded
                              ? review.slice(0, REVIEW_PREVIEW_LENGTH)
                              : review;
                            const showClamp = embedded && truncated && !isExpanded;
                            return (
                              <>
                                <div className={showClamp ? "line-clamp-2 w-full max-w-[240px]" : "w-full max-w-[240px]"}>
                                  <p className="text-xs sm:text-sm text-[var(--color-light)] whitespace-pre-wrap break-words">
                                    {preview}
                                    {truncated && !isExpanded && " ... "}
                                  </p>
                                </div>
                                {truncated && (
                                  <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    className="shrink-0 h-auto p-0 text-xs text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setExpandedReviewLogId(isExpanded ? null : log.id);
                                    }}
                                  >
                                    {isExpanded ? t("social.viewLess") : t("social.viewMore")}
                                  </Button>
                                )}
                              </>
                            );
                          })()
                        ) : (
                          <span className="invisible text-xs sm:text-sm line-clamp-2">—</span>
                        )}
                      </div>
                    </div>
                    {/* Right: +1 (primary) + edit */}
                    {!readOnly && (
                      <div className="flex flex-shrink-0 flex-col justify-center gap-2 border-l border-[var(--color-surface-border)] p-2">
                        {hasProgressButton && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleIncrement(log);
                            }}
                            disabled={incrementingId === log.id || deletingId === log.id}
                            aria-label={t("mediaLogs.addOne")}
                            className="flex h-10 min-w-10 items-center justify-center gap-1 rounded-xl border-0 bg-[var(--color-darkest)] px-2.5 shadow-[var(--shadow-sm)] transition-[transform,box-shadow] hover:scale-[1.04] hover:shadow-[var(--shadow-md)] active:scale-[0.98] disabled:scale-100 disabled:opacity-50 [@media(hover:hover)]:hover:bg-[var(--btn-gradient-start)] [@media(hover:hover)]:hover:shadow-[0_0_0_2px_var(--btn-gradient-start)]"
                          >
                            {incrementingId === log.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-lightest)]" aria-hidden />
                            ) : (
                              <>
                                <Plus className="h-4 w-4 shrink-0 text-[var(--color-lightest)]" aria-hidden />
                                <span className="text-xs font-semibold tabular-nums text-[var(--color-lightest)]">1</span>
                              </>
                            )}
                          </button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-lg text-[var(--color-light)] hover:bg-[var(--color-mid)]/40 hover:text-[var(--color-lightest)] transition-colors"
                          onClick={() => setEditingLog(log)}
                          disabled={deletingId === log.id}
                          aria-label={t("common.edit")}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </Card>
                </motion.div>
              </motion.div>
            );
            })}
          </div>
          {nextCursor != null && (
            <>
              <div ref={loadMoreRef} className="min-h-[1px] w-full" aria-hidden />
              <div className="flex flex-col items-center gap-2 py-4">
                {loadingMore ? (
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--color-light)]" aria-hidden />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fetchLogs(false)}
                    aria-label={t("mediaLogs.loadMore")}
                  >
                    {t("mediaLogs.loadMore")}
                  </Button>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}

      {!readOnly && editingLog && (
        <LogForm
          mode="edit"
          log={editingLog}
          episodesCount={editingLogEpisodesCount}
          onSaved={handleSaved}
          onCancel={() => setEditingLog(null)}
          onDelete={editingLog ? (id) => handleDelete(id) : undefined}
        />
      )}

      {!readOnly && !embedded && (
      <form
        onSubmit={handleCategorySearchSubmit}
        className="fixed left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4 bottom-[max(5rem,calc(5rem+env(safe-area-inset-bottom)))] md:bottom-6 md:left-[calc(127.5px+50vw)]"
        aria-label={t("search.search")}
      >
        <div className="relative flex rounded-lg border-2 border-[var(--color-mid)] bg-[var(--color-dark)] shadow-[var(--shadow-md)]">
          <span
            className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-[var(--color-lightest)]"
            aria-hidden
          >
            <Search className="size-5" />
          </span>
          <Input
            type="search"
            placeholder={t("search.searchPlaceholder", { type: t(`nav.${mediaType}`).toLowerCase() })}
            value={categorySearchQuery}
            onChange={(e) => setCategorySearchQuery(e.target.value)}
            className="h-11 min-w-0 flex-1 border-0 bg-transparent pl-10 pr-4 text-[var(--color-lightest)] placeholder:text-[var(--color-light)] focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label={t("search.search")}
          />
        </div>
      </form>
      )}
      </div>
    </div>
  );
}
