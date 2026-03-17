import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, AlertTriangle, Plus, Download, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { MediaType, Log } from "@dogument/shared";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES, LOG_STATUS_OPTIONS } from "@dogument/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { apiFetch, apiFetchCached, apiFetchPublic, invalidateLogsAndItemsCache, apiFetchFile, downloadFile, LOGS_INVALIDATED_EVENT } from "@/lib/api";
import { showAchievementToasts } from "@/lib/achievementToast";
import { LogForm } from "@/components/LogForm";
import { CustomBatchEntryModal } from "@/components/CustomBatchEntryModal";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { ItemImage } from "@/components/ItemImage";
import { GenreBadges } from "@/components/GenreBadges";
import { LevelBadge } from "@/components/LevelBadge";
import { MEDIA_BADGE_ICONS } from "@/lib/mediaBadgeIcons";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { MediaLogsSkeleton } from "@/components/skeletons";
import { Logo } from "@/components/Logo";
import { showErrorToast } from "@/lib/errorToast";
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
  const [ownedFilter, setOwnedFilter] = useState<"" | "owned">("");
  const [sortBy, setSortBy] = useState<
    "dateAsc" | "dateDesc" | "gradeAsc" | "gradeDesc" | "matchesPlayedAsc" | "matchesPlayedDesc" | "timeToBeatAsc" | "timeToBeatDesc"
  >("dateAsc");
  const [showCustomEntry, setShowCustomEntry] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [incrementingId, setIncrementingId] = useState<string | null>(null);
  const [exportingCategory, setExportingCategory] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  /** Log id whose review is expanded in-card (no modal). */
  const [expandedReviewLogId, setExpandedReviewLogId] = useState<string | null>(null);
  const [milestoneProgressFetched, setMilestoneProgressFetched] = useState<CategoryMilestoneProgress | null>(null);
  /** When embedded (home): start with Load more button; after first click, switch to infinite scroll. When not embedded, use infinite scroll from the start. */
  const [infiniteScrollEnabled, setInfiniteScrollEnabled] = useState(() => !embedded);

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

  useEffect(() => {
    if (readOnly || milestoneProgressProp != null || !me) return;
    const refetch = () => {
      apiFetch<{ perMedium: CategoryMilestoneProgress[] }>("/me/milestones/progress")
        .then((res) => {
          const forMedia = res.perMedium?.find((p) => p.mediaType === mediaType) ?? null;
          setMilestoneProgressFetched(forMedia);
        })
        .catch(() => setMilestoneProgressFetched(null));
    };
    window.addEventListener(LOGS_INVALIDATED_EVENT, refetch);
    return () => window.removeEventListener(LOGS_INVALIDATED_EVENT, refetch);
  }, [readOnly, milestoneProgressProp, mediaType, me]);

  const EPISODE_TYPES: MediaType[] = ["tv", "anime"];
  const CHAPTER_TYPES: MediaType[] = ["manga"];
  const VOLUME_TYPES: MediaType[] = ["comics"];
  /** +1 button only for types that track progress (tv, anime, manga, comics). Not for games, boardgames, movies, books. */
  const hasProgressButton =
    EPISODE_TYPES.includes(mediaType) || CHAPTER_TYPES.includes(mediaType) || VOLUME_TYPES.includes(mediaType);
  /** Hide +1 when item is already complete/read/watched/played. */
  const showIncrementForLog = (log: Log) =>
    hasProgressButton &&
    log.status != null &&
    !(COMPLETED_STATUSES as readonly string[]).includes(log.status);

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
      if (mediaType === "boardgames" && ownedFilter === "owned") params.set("own", "true");
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
    [mediaType, statusFilter, ownedFilter, sortBy, nextCursor, loadingMore, t, publicUserId]
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
    setCategorySearchQuery("");
    if (mediaType !== "boardgames") {
      setOwnedFilter("");
      setSortBy((prev) => (prev === "matchesPlayedAsc" || prev === "matchesPlayedDesc" ? "dateAsc" : prev));
    }
    if (mediaType !== "games") {
      setSortBy((prev) => (prev === "timeToBeatAsc" || prev === "timeToBeatDesc" ? "dateAsc" : prev));
    }
  }, [mediaType]);

  useEffect(() => {
    const defaultsMatch = sortBy === "dateAsc" && statusFilter === "" && ownedFilter === "";
    const useInitial = embedded && initialLogsProp !== undefined && defaultsMatch;
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
  }, [mediaType, statusFilter, ownedFilter, sortBy, publicUserId, embedded, initialLogsProp, initialNextCursorProp]);

  /** When embedded, start with Load more again when category or filters change. */
  useEffect(() => {
    if (embedded) setInfiniteScrollEnabled(false);
  }, [embedded, mediaType, statusFilter, ownedFilter, sortBy]);

  useEffect(() => {
    setStatusCounts(null);
    fetchStatusCounts();
  }, [fetchStatusCounts]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fetchLogsRef = useRef(fetchLogs);
  fetchLogsRef.current = fetchLogs;
  useEffect(() => {
    if (!infiniteScrollEnabled) return;
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
  }, [infiniteScrollEnabled]);

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
      showErrorToast(t, "E014", { originalError: err });
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
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setIncrementingId(null);
    }
  };

  const label = t(`nav.${mediaType}`);

  const filteredLogs = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => log.title.toLowerCase().includes(q));
  }, [logs, categorySearchQuery]);

  const handleCategorySearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!embedded) {
      const q = categorySearchQuery.trim();
      navigate("/search", { state: { mediaType, query: q || undefined } });
    }
  };

  const hasProFeatures = me?.tier === "pro" || me?.tier === "admin";
  const handleExportCategory = async () => {
    if (!hasProFeatures) {
      setShowProModal(true);
      return;
    }
    setExportingCategory(true);
    try {
      const { blob, filename } = await apiFetchFile(`/logs/export?mediaType=${encodeURIComponent(mediaType)}`);
      await downloadFile(blob, filename);
      toast.success(t("mediaLogs.exportCategorySuccess"));
    } catch (err) {
      showErrorToast(t, "E010", { originalError: err });
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
        <Dialog open={showProModal && !hasProFeatures} onOpenChange={setShowProModal}>
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
        <div className={cn(
          "flex min-w-0 flex-wrap items-center gap-2 overflow-hidden",
          embedded ? "justify-end" : "justify-between"
        )}>
          {!embedded && (
            <h1 className="min-w-0 truncate text-2xl font-bold text-[var(--color-lightest)]">
              {label}
            </h1>
          )}
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
                !hasProFeatures && "opacity-60 cursor-pointer"
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
          // Use a single scope (reviews or logs) for the whole row so current badge, bar, and next badge match
          const scope = milestoneProgress.reviews.next ? milestoneProgress.reviews : milestoneProgress.logs;
          const currentBadge =
            scope.earned.length > 0 ? scope.earned[scope.earned.length - 1]! : null;
          const next = scope.next;
          const displayCurrent = next ? Math.min(scope.current, next.threshold) : scope.current;
          const displayPct = scope.progressPct;
          const kind = scope === milestoneProgress.reviews ? "reviews" : "logs";
          const categoryLabel = t(`nav.${mediaType}`);
          const badgeUser = t("mediaLogs.badgePopupYou");
          return (
            <div className="flex min-w-0 flex-wrap items-center gap-2 ml-1 sm:gap-3">
              {currentBadge && (
                <LevelBadge
                  icon={MEDIA_BADGE_ICONS[mediaType]}
                  level={scope.earned.length}
                  title={currentBadge.label}
                  popupDetail={{
                    user: badgeUser,
                    categoryLabel,
                    count: scope.current,
                    kind,
                  }}
                />
              )}
              {next && (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-darkest)] max-w-[280px] sm:max-w-[340px]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)] transition-all duration-500"
                      style={{
                        width: `${displayPct}%`,
                        minWidth: displayCurrent > 0 ? "4px" : 0,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-[var(--color-light)]" title={next.label}>
                    {displayCurrent}/{next.threshold}
                  </span>
                  <LevelBadge
                    icon={MEDIA_BADGE_ICONS[mediaType]}
                    level={scope.earned.length + 1}
                    title={next.label}
                    popupDetail={{
                      user: badgeUser,
                      categoryLabel,
                      count: scope.current,
                      kind,
                    }}
                  />
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
            handleSaved(completion);
          }}
          onCancel={() => setShowCustomEntry(false)}
        />
      )}

      <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
        {(embedded || readOnly) && (
          <div className="relative flex min-w-0 max-w-xs items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-[var(--color-light)]" aria-hidden />
            <Input
              type="search"
              placeholder={t("mediaLogs.searchTitlesPlaceholder", { category: label })}
              value={categorySearchQuery}
              onChange={(e) => setCategorySearchQuery(e.target.value)}
              className={cn(
                "border-[var(--color-mid)] bg-[var(--color-darkest)] text-[var(--color-lightest)] placeholder:text-[var(--color-light)]",
                categorySearchQuery.trim() !== "" ? "pr-9" : ""
              )}
              aria-label={t("mediaLogs.searchTitlesLabel")}
            />
            {categorySearchQuery.trim() !== "" && (
              <button
                type="button"
                onClick={() => setCategorySearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-light)] hover:text-[var(--color-lightest)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)]"
                aria-label={t("search.clearSearch")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      <div className="flex min-w-0 flex-wrap items-center gap-3 overflow-hidden">
        {/* Mobile (< md): custom dropdowns, no labels */}
        <div className={cn("grid w-full gap-2 md:hidden", mediaType === "boardgames" ? "grid-cols-3" : "grid-cols-2")}>
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
          {mediaType === "boardgames" && (
            <Select
              value={ownedFilter}
              onValueChange={(v) => setOwnedFilter((v as "" | "owned") || "")}
              options={[
                { value: "", label: t("mediaLogs.filterAll") },
                { value: "owned", label: t("mediaLogs.filterOwned") },
              ]}
              aria-label={t("itemReviewForm.own")}
              className="min-w-0 w-full"
              triggerClassName="w-full max-w-none min-w-0"
            />
          )}
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as typeof sortBy)}
            options={[
              { value: "dateAsc", label: t("mediaLogs.sortByDateAsc") },
              { value: "dateDesc", label: t("mediaLogs.sortByDateDesc") },
              { value: "gradeAsc", label: t("mediaLogs.sortByGradeAsc") },
              { value: "gradeDesc", label: t("mediaLogs.sortByGradeDesc") },
              ...(mediaType === "boardgames" ? [{ value: "matchesPlayedAsc" as const, label: t("mediaLogs.sortByMatchesPlayedAsc") }, { value: "matchesPlayedDesc" as const, label: t("mediaLogs.sortByMatchesPlayedDesc") }] : []),
              ...(mediaType === "games" ? [{ value: "timeToBeatAsc" as const, label: t("mediaLogs.sortByTimeToBeatAsc") }, { value: "timeToBeatDesc" as const, label: t("mediaLogs.sortByTimeToBeatDesc") }] : []),
            ]}
            aria-label={t("mediaLogs.sortLabel")}
            className="min-w-0 w-full"
            triggerClassName="w-full max-w-none min-w-0"
          />
        </div>
        {/* Desktop (md+): status buttons; sort = dropdown for games/boardgames, buttons for others */}
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
          {mediaType === "boardgames" && (
            <Button
              type="button"
              variant={ownedFilter === "owned" ? "default" : "outline"}
              size="sm"
              onClick={() => setOwnedFilter((prev) => (prev === "owned" ? "" : "owned"))}
            >
              {t("mediaLogs.filterOwned")}
            </Button>
          )}
        </div>
        <span className="ml-2 shrink-0 text-sm text-[var(--color-light)] md:ml-4">{t("mediaLogs.sortLabel")}</span>
        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as typeof sortBy)}
          options={[
            { value: "dateAsc", label: t("mediaLogs.sortByDateAsc") },
            { value: "dateDesc", label: t("mediaLogs.sortByDateDesc") },
            { value: "gradeAsc", label: t("mediaLogs.sortByGradeAsc") },
            { value: "gradeDesc", label: t("mediaLogs.sortByGradeDesc") },
            ...(mediaType === "boardgames" ? [{ value: "matchesPlayedAsc" as const, label: t("mediaLogs.sortByMatchesPlayedAsc") }, { value: "matchesPlayedDesc" as const, label: t("mediaLogs.sortByMatchesPlayedDesc") }] : []),
            ...(mediaType === "games" ? [{ value: "timeToBeatAsc" as const, label: t("mediaLogs.sortByTimeToBeatAsc") }, { value: "timeToBeatDesc" as const, label: t("mediaLogs.sortByTimeToBeatDesc") }] : []),
          ]}
          aria-label={t("mediaLogs.sortLabel")}
          className="min-w-0 w-[11rem]"
          triggerClassName="w-full min-w-0"
        />
        </div>
      </div>
      </div>

      {filteredLogs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="flex flex-1 flex-col items-center justify-center min-h-[50vh] py-12"
        >
          <p className="text-center text-[var(--color-light)]">
            {logs.length === 0
              ? t("mediaLogs.noLogsFor", { label: label.toLowerCase() })
              : t("mediaLogs.noTitlesMatchSearch")}
          </p>
          {!readOnly && logs.length === 0 && (
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
            {filteredLogs.map((log) => {
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
                      className="h-full min-h-full w-28 flex-shrink-0 overflow-hidden sm:w-32 block"
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
                        {mediaType === "boardgames" && (log.own === true || (log.matchesPlayed != null && log.matchesPlayed > 0)) && (
                          <>
                            {log.own === true && (
                              <span className="text-[10px] sm:text-xs text-[var(--color-light)]">{t("itemReviewForm.own")}</span>
                            )}
                            {log.matchesPlayed != null && log.matchesPlayed > 0 && (
                              <span className="text-[10px] sm:text-xs text-[var(--color-light)]">{t("itemReviewForm.matchesPlayed")}: {log.matchesPlayed}</span>
                            )}
                          </>
                        )}
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
                    {/* Right: +1 (primary) + edit — +1 only when progress type and not complete/read/watched */}
                    {!readOnly && (
                      <div className="flex flex-shrink-0 flex-col justify-center gap-2 border-l border-[var(--color-surface-border)] p-2">
                        {showIncrementForLog(log) && (
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
                ) : embedded && !infiniteScrollEnabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      fetchLogs(false);
                      setInfiniteScrollEnabled(true);
                    }}
                    aria-label={t("mediaLogs.loadMore")}
                  >
                    {t("mediaLogs.loadMore")}
                  </Button>
                ) : !embedded ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fetchLogs(false)}
                    aria-label={t("mediaLogs.loadMore")}
                  >
                    {t("mediaLogs.loadMore")}
                  </Button>
                ) : null}
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
            className={cn(
              "h-11 min-w-0 flex-1 border-0 bg-transparent pl-10 text-[var(--color-lightest)] placeholder:text-[var(--color-light)] focus-visible:ring-0 focus-visible:ring-offset-0",
              categorySearchQuery.trim() !== "" ? "pr-10" : "pr-4"
            )}
            aria-label={t("search.search")}
          />
          {categorySearchQuery.trim() !== "" && (
            <button
              type="button"
              onClick={() => setCategorySearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-light)] hover:text-[var(--color-lightest)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)]"
              aria-label={t("search.clearSearch")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
      )}
      </div>
    </div>
  );
}
