import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MediaType, Log } from "@geeklogs/shared";
import { LOG_STATUS_OPTIONS } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import {
  logStatusSelectTriggerClass,
  logStatusSoftBadgeClass,
  mediaTypeUsesEpisodeStatusColors,
} from "@/lib/logStatusColors";
import { cn } from "@/lib/utils";
import {
  apiFetch,
  apiFetchCached,
  apiFetchSWR,
  apiFetchPublic,
  getCachedEntry,
  HEAVY_PAGE_TTL_MS,
  invalidateLogsAndItemsCache,
  apiFetchFile,
  downloadFile,
  LOGS_INVALIDATED_EVENT,
} from "@/lib/api";
import {
  buildLogsListPath,
  buildLogsListPathFromFilters,
  readCachedLogsListResponse,
  upsertLogInClientCaches,
  removeLogFromClientCaches,
} from "@/lib/logsPageCache";
import { LogForm } from "@/components/LogForm";
import { CustomBatchEntryModal } from "@/components/CustomBatchEntryModal";
import { ExportLogsModal, type ExportLogsOptions } from "@/components/ExportLogsModal";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { LevelBadge } from "@/components/LevelBadge";
import { MEDIA_BADGE_ICONS } from "@/lib/mediaBadgeIcons";
import { MediaLogsListSkeleton, MediaLogsSkeleton } from "@/components/skeletons";
import { Logo } from "@/components/Logo";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { tapScale, tapTransition } from "@/lib/animations";
import { listStaggerItemClassName, listStaggerItemVariants, listStaggerParentProps, visibleEnterProps } from "@/lib/motionPolicy";
import { LogViewSelector } from "@/components/LogViewSelector";
import { MediaLogCard } from "@/components/MediaLogCard";
import { useLogViewPreference } from "@/hooks/useLogViewPreference";
import { resolveLogViewForContext } from "@/lib/logViewPreference";
import {
  LOG_LIST_CARD_GRID,
  LOG_LIST_CARD_GRID_DENSE,
  LOG_LIST_CARD_GRID_MULTI,
} from "@/lib/logCardLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { useLogComplete } from "@/contexts/LogCompleteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import { skipApiKeyMissingUi } from "@/lib/featureFlags";
import { tierHasProFeatures } from "@/lib/userTier";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { mediaTypeHasCollectionOwnership, mediaTypeHasMarketTab } from "@/lib/mediaTypeFeatures";
import { buildLogsExportFilename, userSlugFromMe } from "@/lib/exportFilename";
import { decodeLogForDisplay } from "@/lib/decodeDisplayFields";
import { UnifiedSearchBar } from "@/components/UnifiedSearchBar";

const LOGS_PAGE_SIZE = 24;

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

export type MediaLogsSort =
  | "dateAsc"
  | "dateDesc"
  | "gradeAsc"
  | "gradeDesc"
  | "matchesPlayedAsc"
  | "matchesPlayedDesc"
  | "timeToBeatAsc"
  | "timeToBeatDesc";

/** List filter for board games + video games (maps to API `own` / `wantToBuy` query params). */
export type CollectionListFilter = "" | "owned" | "wantToBuy";

export interface SharedFilters {
  status: string;
  sort: MediaLogsSort;
  search: string;
  collection: CollectionListFilter;
  /** Exact genre name from log metadata; empty = all genres. */
  genre: string;
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
  /** Initial filter values (e.g. from shared profile URL). */
  initialFilters?: Partial<SharedFilters>;
  /** When this string changes (e.g. `searchParams.toString()`), re-apply `initialFilters` from the URL. */
  initialFiltersSyncKey?: string;
  /** When embedded, called when filters change so parent can include them in share URL. */
  onFiltersChange?: (filters: SharedFilters) => void;
}

const DEFAULT_SORT: MediaLogsSort = "dateDesc";

export function MediaLogs({
  mediaType,
  embedded = false,
  publicUserId,
  milestoneProgress: milestoneProgressProp,
  initialLogs: initialLogsProp,
  initialNextCursor: initialNextCursorProp,
  initialFilters,
  initialFiltersSyncKey,
  onFiltersChange,
}: MediaLogsProps) {
  const onFiltersChangeRef = useRef(onFiltersChange);
  onFiltersChangeRef.current = onFiltersChange;

  const { t } = useLocale();
  const navigate = useNavigate();
  const { showLogComplete } = useLogComplete();
  const { token } = useAuth();
  const { me, loading: meLoading } = useMe();
  const boardGameProvider = me?.boardGameProvider ?? "bgg";
  const provider = getApiKeyProviderForMediaType(mediaType, boardGameProvider);
  const hasBoardGameKey = !!(me?.apiKeys?.bgg || me?.apiKeys?.ludopedia);
  const needsKeyBanner =
    !publicUserId &&
    !skipApiKeyMissingUi(me, { token: !!token, meLoading }) &&
    provider != null &&
    (mediaType === "boardgames" ? !hasBoardGameKey : me?.apiKeys && !me.apiKeys[provider]);
  const readOnly = !!publicUserId;
  const showCollectionOwnershipFilters = mediaTypeHasCollectionOwnership(mediaType);

  const embeddedCacheOnMount = (() => {
    if (publicUserId || !embedded) return null;
    if (initialLogsProp !== undefined) {
      return { logs: initialLogsProp, cursor: initialNextCursorProp ?? null };
    }
    const path = buildLogsListPathFromFilters(
      mediaType,
      {
        sort: initialFilters?.sort,
        status: initialFilters?.status,
        search: initialFilters?.search,
        collection: initialFilters?.collection,
        genre: initialFilters?.genre,
      },
      showCollectionOwnershipFilters
    );
    const hit = readCachedLogsListResponse(path);
    if (!hit) return null;
    return { logs: hit.list.map(decodeLogForDisplay), cursor: hit.cursor };
  })();

  const [logs, setLogs] = useState<Log[]>(() => embeddedCacheOnMount?.logs ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(() => embeddedCacheOnMount?.cursor ?? null);
  const [loading, setLoading] = useState(() => !publicUserId && !embeddedCacheOnMount);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [logEditTab, setLogEditTab] = useState<"review" | "matches" | "market">("review");
  const [editingLogEpisodesCount, setEditingLogEpisodesCount] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(() => initialFilters?.status ?? "");
  const [statusCounts, setStatusCounts] = useState<{
    total: number;
    byStatus: Record<string, number>;
    owned?: number;
    wantToBuy?: number;
    byGenre?: Array<{ name: string; count: number }>;
  } | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<CollectionListFilter>(
    () => initialFilters?.collection ?? ""
  );
  const [genreFilter, setGenreFilter] = useState(() => (initialFilters?.genre ?? "").trim());
  const [sortBy, setSortBy] = useState<MediaLogsSort>(() => (initialFilters?.sort as MediaLogsSort) ?? DEFAULT_SORT);
  const [showCustomEntry, setShowCustomEntry] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  /** Applied filter (API + URL); updated on submit, not on every keystroke. */
  const [categorySearchQuery, setCategorySearchQuery] = useState(() => (initialFilters?.search ?? "").trim());
  /** In-progress text in the search field. */
  const [categorySearchDraft, setCategorySearchDraft] = useState(() => initialFilters?.search ?? "");
  const [incrementingId, setIncrementingId] = useState<string | null>(null);
  const [exportingCategory, setExportingCategory] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  /** Log id whose review is expanded in-card (no modal). */
  const [expandedReviewLogId, setExpandedReviewLogId] = useState<string | null>(null);
  const [milestoneProgressFetched, setMilestoneProgressFetched] = useState<CategoryMilestoneProgress | null>(null);
  /** When embedded (home): start with Load more button; after first click, switch to infinite scroll. When not embedded, use infinite scroll from the start. */
  const [infiniteScrollEnabled, setInfiniteScrollEnabled] = useState(() => !embedded);
  const logViewEnabled = embedded && !publicUserId;
  const [dashboardLogView, setDashboardLogView] = useLogViewPreference("dashboard", logViewEnabled);

  const buildLogsPath = useCallback(
    (cursor?: string | null) => {
      const params: Parameters<typeof buildLogsListPath>[0] = {
        mediaType,
        sort: sortBy,
      };
      if (statusFilter) params.status = statusFilter;
      if (showCollectionOwnershipFilters && collectionFilter === "owned") params.own = true;
      if (showCollectionOwnershipFilters && collectionFilter === "wantToBuy") params.wantToBuy = true;
      const q = categorySearchQuery.trim();
      if (q) params.q = q;
      if (genreFilter) params.genre = genreFilter;
      if (cursor) params.cursor = cursor;
      return buildLogsListPath(params);
    },
    [
      mediaType,
      sortBy,
      statusFilter,
      collectionFilter,
      categorySearchQuery,
      genreFilter,
      showCollectionOwnershipFilters,
    ]
  );

  const milestoneProgress = milestoneProgressProp ?? (readOnly ? null : milestoneProgressFetched);

  useEffect(() => {
    if (!embedded) return;
    const notify = onFiltersChangeRef.current;
    if (!notify) return;
    notify({
      status: statusFilter,
      sort: sortBy,
      search: categorySearchQuery,
      collection: collectionFilter,
      genre: genreFilter,
    });
  }, [embedded, statusFilter, sortBy, categorySearchQuery, collectionFilter, genreFilter]);

  useEffect(() => {
    if (initialFiltersSyncKey == null) return;
    setStatusFilter(initialFilters?.status ?? "");
    setSortBy((initialFilters?.sort as MediaLogsSort) ?? DEFAULT_SORT);
    setCategorySearchQuery((initialFilters?.search ?? "").trim());
    setCategorySearchDraft(initialFilters?.search ?? "");
    setCollectionFilter((initialFilters?.collection as CollectionListFilter) ?? "");
    setGenreFilter((initialFilters?.genre ?? "").trim());
  }, [initialFiltersSyncKey, initialFilters]);

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

  const getProgress = (log: Log): { field: "episode" | "chapter" | "volume"; value: number; labelKey: string } => {
    if (EPISODE_TYPES.includes(log.mediaType))
      return { field: "episode", value: log.episode ?? 0, labelKey: "itemReviewForm.episode" };
    if (CHAPTER_TYPES.includes(log.mediaType))
      return { field: "chapter", value: log.chapter ?? 0, labelKey: "itemReviewForm.chapter" };
    return { field: "volume", value: log.volume ?? 0, labelKey: "itemReviewForm.volume" };
  };

  const applyLogsResponse = useCallback((response: LogsResponse, reset: boolean) => {
    const list = Array.isArray(response) ? response : response.data;
    const decoded = list.map(decodeLogForDisplay);
    const cursor = Array.isArray(response) ? null : response.nextCursor;
    setLogs((prev) => (reset ? decoded : [...prev, ...decoded]));
    setNextCursor(cursor);
  }, []);

  const fetchLogs = useCallback(
    (reset = true) => {
      if (!reset && (loadingMore || !nextCursor)) return;
      if (reset) {
        setError(null);
        setNextCursor(null);
        setListRefreshing(true);
        if (logsRef.current.length === 0) {
          setLoading(true);
        }
      } else {
        setLoadingMore(true);
      }
      const params = new URLSearchParams({
        mediaType,
        sort: sortBy,
        limit: String(LOGS_PAGE_SIZE),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (showCollectionOwnershipFilters && collectionFilter === "owned") params.set("own", "true");
      if (showCollectionOwnershipFilters && collectionFilter === "wantToBuy") params.set("wantToBuy", "true");
      const q = categorySearchQuery.trim();
      if (q) params.set("q", q);
      if (genreFilter) params.set("genre", genreFilter);
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const path = publicUserId
        ? `/users/${publicUserId}/logs?${params.toString()}`
        : buildLogsPath(!reset ? nextCursor : undefined);

      const finish = () => {
        setLoading(false);
        setListRefreshing(false);
        setLoadingMore(false);
      };

      if (publicUserId) {
        if (reset) {
          setLoading(true);
          setListRefreshing(true);
        }
        void apiFetchPublic<LogsResponse>(path)
          .then((response) => {
            applyLogsResponse(response, reset);
            setError(null);
          })
          .catch((err) => {
            if (reset) setLogs([]);
            setError(err instanceof Error ? err.message : t("mediaLogs.couldntLoadLogs"));
          })
          .finally(finish);
        return;
      }

      if (!reset) {
        void apiFetch<LogsResponse>(path)
          .then((response) => {
            applyLogsResponse(response, false);
            setError(null);
          })
          .catch((err) => {
            setError(err instanceof Error ? err.message : t("mediaLogs.couldntLoadLogs"));
          })
          .finally(finish);
        return;
      }

      const cached = getCachedEntry<LogsResponse>("GET", path);
      if (cached) {
        applyLogsResponse(cached.data, true);
        setLoading(false);
      }

      void apiFetchSWR<LogsResponse>(path, {
        ttlMs: HEAVY_PAGE_TTL_MS,
        onUpdate: (data) => {
          applyLogsResponse(data as LogsResponse, true);
          setError(null);
        },
      })
        .then(({ data, fromCache }) => {
          if (!fromCache) applyLogsResponse(data, true);
          setError(null);
        })
        .catch((err) => {
          if (!cached) setLogs([]);
          setError(err instanceof Error ? err.message : t("mediaLogs.couldntLoadLogs"));
        })
        .finally(finish);
    },
    [
      mediaType,
      statusFilter,
      collectionFilter,
      sortBy,
      nextCursor,
      loadingMore,
      t,
      publicUserId,
      showCollectionOwnershipFilters,
      categorySearchQuery,
      genreFilter,
      applyLogsResponse,
      buildLogsPath,
    ]
  );

  type StatusCountsPayload = {
    data: {
      total: number;
      byStatus: Record<string, number>;
      owned?: number;
      wantToBuy?: number;
      byGenre?: Array<{ name: string; count: number }>;
    };
  };

  const fetchStatusCounts = useCallback(() => {
    const path = publicUserId
      ? `/users/${publicUserId}/logs/status-counts?mediaType=${encodeURIComponent(mediaType)}`
      : `/logs/status-counts?mediaType=${encodeURIComponent(mediaType)}`;

    if (publicUserId) {
      void apiFetchPublic<StatusCountsPayload>(path)
        .then((res) => setStatusCounts(res.data ?? null))
        .catch(() => setStatusCounts(null));
      return;
    }

    const cached = getCachedEntry<StatusCountsPayload>("GET", path);
    if (cached) setStatusCounts(cached.data.data ?? null);

    void apiFetchSWR<StatusCountsPayload>(path, {
      ttlMs: HEAVY_PAGE_TTL_MS,
      onUpdate: (res) => setStatusCounts((res as StatusCountsPayload).data ?? null),
    })
      .then(({ data, fromCache }) => {
        if (!fromCache) setStatusCounts(data.data ?? null);
      })
      .catch(() => {
        if (!cached) setStatusCounts(null);
      });
  }, [mediaType, publicUserId]);

  useEffect(() => {
    setCategorySearchQuery("");
    setCategorySearchDraft("");
    setGenreFilter("");
    if (!mediaTypeHasCollectionOwnership(mediaType)) {
      setCollectionFilter("");
    }
    if (mediaType !== "boardgames") {
      setSortBy((prev) => (prev === "matchesPlayedAsc" || prev === "matchesPlayedDesc" ? "dateDesc" : prev));
    }
    if (mediaType !== "games") {
      setSortBy((prev) => (prev === "timeToBeatAsc" || prev === "timeToBeatDesc" ? "dateDesc" : prev));
    }
  }, [mediaType]);

  useEffect(() => {
    if (publicUserId) {
      setLogs([]);
      setNextCursor(null);
      setError(null);
      setLoading(true);
      fetchLogsRef.current(true);
      return;
    }

    const path = buildLogsPath();
    setListRefreshing(true);
    setError(null);

    const cached = readCachedLogsListResponse(path);
    if (cached) {
      setLogs(cached.list.map(decodeLogForDisplay));
      setNextCursor(cached.cursor);
      setLoading(false);
      void apiFetchSWR<LogsResponse>(path, { ttlMs: HEAVY_PAGE_TTL_MS }).finally(() =>
        setListRefreshing(false)
      );
      return;
    }

    if (logsRef.current.length === 0) {
      setLogs([]);
      setNextCursor(null);
      setLoading(true);
    }
    fetchLogsRef.current(true);
  }, [
    mediaType,
    statusFilter,
    collectionFilter,
    sortBy,
    categorySearchQuery,
    publicUserId,
    genreFilter,
    buildLogsPath,
  ]);

  /** When embedded, start with Load more again when category or filters change. */
  useEffect(() => {
    if (embedded) setInfiniteScrollEnabled(false);
  }, [embedded, mediaType, statusFilter, collectionFilter, sortBy, categorySearchQuery, genreFilter]);

  useEffect(() => {
    fetchStatusCounts();
  }, [fetchStatusCounts]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const categorySearchInputRef = useRef<HTMLInputElement>(null);
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const fetchLogsRef = useRef(fetchLogs);
  fetchLogsRef.current = fetchLogs;
  const skipLogsInvalidatedRefetchRef = useRef(false);

  useEffect(() => {
    if (publicUserId) return;
    const onInvalidated = () => {
      fetchStatusCounts();
      if (skipLogsInvalidatedRefetchRef.current) {
        skipLogsInvalidatedRefetchRef.current = false;
        return;
      }
      fetchLogsRef.current(true);
    };
    window.addEventListener(LOGS_INVALIDATED_EVENT, onInvalidated);
    return () => window.removeEventListener(LOGS_INVALIDATED_EVENT, onInvalidated);
  }, [publicUserId, fetchStatusCounts]);

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
      skipLogsInvalidatedRefetchRef.current = true;
      setLogs((prev) => prev.filter((l) => l.id !== id));
      removeLogFromClientCaches(id);
      invalidateLogsAndItemsCache();
      setEditingLog(null);
      fetchStatusCounts();
      toast.success(t("toast.logDeleted"));
    } catch (err) {
      showErrorToast(t, "E014", { originalError: err });
      throw err;
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = (completion?: LogCompleteState, savedLog?: Log) => {
    setEditingLog(null);
    setLogEditTab("review");
    if (savedLog) {
      skipLogsInvalidatedRefetchRef.current = true;
      const normalized = decodeLogForDisplay(savedLog);
      setLogs((prev) => {
        const idx = prev.findIndex((l) => l.id === normalized.id);
        if (idx >= 0) return prev.map((l) => (l.id === normalized.id ? normalized : l));
        return [normalized, ...prev];
      });
      upsertLogInClientCaches(normalized);
    } else {
      invalidateLogsAndItemsCache();
      fetchLogs();
    }
    fetchStatusCounts();
    if (completion) showLogComplete(completion);
  };

  const handleIncrement = async (log: Log) => {
    const { field, value } = getProgress(log);
    const next = value + 1;
    setIncrementingId(log.id);
    const optimistic = decodeLogForDisplay({ ...log, [field]: next });
    setLogs((prev) => prev.map((l) => (l.id === log.id ? optimistic : l)));
    try {
      const updated = await apiFetch<Log>(
        `/logs/${log.id}`,
        { method: "PATCH", body: JSON.stringify({ [field]: next }) }
      );
      const normalized = decodeLogForDisplay(updated);
      setLogs((prev) => prev.map((l) => (l.id === log.id ? normalized : l)));
      upsertLogInClientCaches(normalized);
      skipLogsInvalidatedRefetchRef.current = true;
      invalidateLogsAndItemsCache();
      toast.success(t("toast.logUpdated"));
    } catch (err) {
      setLogs((prev) => prev.map((l) => (l.id === log.id ? log : l)));
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setIncrementingId(null);
    }
  };

  const label = t(`nav.${mediaType}`);

  const collectionOwnershipSelectOptions = useMemo(() => {
    const ownedBase = t("mediaLogs.filterOwned");
    const wtbBase = t("mediaLogs.filterWantToBuy");
    const ownedLabel =
      statusCounts != null && typeof statusCounts.owned === "number"
        ? `${ownedBase} (${statusCounts.owned})`
        : ownedBase;
    const wantToBuyLabel =
      statusCounts != null && typeof statusCounts.wantToBuy === "number"
        ? `${wtbBase} (${statusCounts.wantToBuy})`
        : wtbBase;
    return [
      { value: "" as CollectionListFilter, label: t("mediaLogs.filterAll") },
      { value: "owned" as const, label: ownedLabel },
      { value: "wantToBuy" as const, label: wantToBuyLabel },
    ];
  }, [t, statusCounts]);

  const colorizeTvStatuses = mediaTypeUsesEpisodeStatusColors(mediaType);
  const statusFilterSelectOptions = useMemo(
    () => [
      {
        value: "",
        label:
          statusCounts != null
            ? `${t("mediaLogs.filterAll")} (${statusCounts.total})`
            : t("mediaLogs.filterAll"),
      },
      ...LOG_STATUS_OPTIONS[mediaType].map((s) => ({
        value: s,
        label:
          statusCounts != null
            ? `${getStatusLabel(t, s, mediaType)} (${statusCounts.byStatus[s] ?? 0})`
            : getStatusLabel(t, s, mediaType),
        className: colorizeTvStatuses
          ? cn("rounded-sm", logStatusSoftBadgeClass(s))
          : undefined,
      })),
    ],
    [colorizeTvStatuses, mediaType, statusCounts, t]
  );

  const genreSelectOptions = useMemo(() => {
    const base = t("mediaLogs.filterAllGenres");
    const rows = statusCounts?.byGenre ?? [];
    return [
      { value: "", label: base },
      ...rows.map((g) => ({ value: g.name, label: `${g.name} (${g.count})` })),
    ];
  }, [t, statusCounts?.byGenre]);

  useEffect(() => {
    if (!genreFilter || !statusCounts?.byGenre?.length) return;
    const exists = statusCounts.byGenre.some((g) => g.name === genreFilter);
    if (!exists) setGenreFilter("");
  }, [statusCounts?.byGenre, genreFilter]);

  const handleListSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = categorySearchDraft.trim();
    setCategorySearchQuery(t);
    setCategorySearchDraft(t);
  };

  /** When the field is emptied, drop the applied filter so the list and URL match. */
  const handleCategorySearchDraftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setCategorySearchDraft(v);
    if (v.trim() === "") {
      setCategorySearchQuery("");
    }
  };

  const handleCategorySearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!embedded) {
      const q = categorySearchDraft.trim();
      setCategorySearchQuery(q);
      setCategorySearchDraft(q);
      navigate("/", { state: { mediaType, query: q || undefined } });
    }
  };

  const showCategorySearchClear =
    categorySearchDraft.trim() !== "" || categorySearchQuery !== "";

  const activeLogView = resolveLogViewForContext(logViewEnabled, dashboardLogView);

  const categorySearchBar = (
    <form onSubmit={handleListSearchSubmit} className="relative min-h-11 max-md:min-h-[44px] min-w-0 flex-1">
      <UnifiedSearchBar
        ref={categorySearchInputRef}
        value={categorySearchDraft}
        onChange={handleCategorySearchDraftChange}
        placeholder={t("mediaLogs.searchTitlesPlaceholder", { category: label })}
        title={t("mediaLogs.searchConfirmHint")}
        inputAriaLabel={t("mediaLogs.searchTitlesLabel")}
        clearAriaLabel={t("search.clearSearch")}
        submitAriaLabel={t("search.search")}
        showClear={showCategorySearchClear}
        onClear={() => {
          setCategorySearchDraft("");
          setCategorySearchQuery("");
          categorySearchInputRef.current?.focus();
        }}
        disableSubmitWhenEmpty={false}
      />
    </form>
  );

  const hasProFeatures = tierHasProFeatures(me?.tier);
  const handleOpenExport = () => {
    if (!hasProFeatures) {
      setShowProModal(true);
      return;
    }
    setShowExportModal(true);
  };
  const handleConfirmExport = async (opts: ExportLogsOptions) => {
    if (!hasProFeatures) {
      setShowExportModal(false);
      setShowProModal(true);
      return;
    }
    setExportingCategory(true);
    try {
      const params = new URLSearchParams();
      if (opts.mediaType !== "all") params.set("mediaType", opts.mediaType);
      if (opts.status) params.set("status", opts.status);
      if (opts.collection === "owned") params.set("own", "true");
      if (opts.collection === "wantToBuy") params.set("wantToBuy", "true");
      if (opts.sort) params.set("sort", opts.sort);
      const qs = params.toString();
      const { blob } = await apiFetchFile(`/logs/export${qs ? `?${qs}` : ""}`);
      const filename = buildLogsExportFilename({
        page: embedded ? "dashboard" : "logs",
        userSlug: userSlugFromMe(me),
        categoryKey: opts.mediaType === "all" ? "all-categories" : opts.mediaType,
      });
      await downloadFile(blob, filename);
      toast.success(t("mediaLogs.exportCategorySuccess"));
      setShowExportModal(false);
    } catch (err) {
      showErrorToast(t, "E010", { originalError: err });
    } finally {
      setExportingCategory(false);
    }
  };

  if (loading && logs.length === 0 && !listRefreshing) {
    return (
      <motion.div {...visibleEnterProps}>
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

  return (
    <div className={`relative min-h-full min-w-0 overflow-hidden pb-24 md:pb-20 ${embedded ? "" : ""}`}>
      {!readOnly && (
        <Dialog open={showProModal && !hasProFeatures} onOpenChange={setShowProModal}>
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
          <OverflowMarquee className="min-w-0 flex-1 text-sm font-medium text-[var(--color-warning-text)]">
            {t("apiKeyBanner.categoryMessage", {
              category: label,
              provider: API_KEY_META[provider!].name,
            })}
          </OverflowMarquee>
          <span className="shrink-0 text-xs font-medium text-[var(--color-warning-text-muted)]">
            {t("apiKeyBanner.addKeyInSettings")} →
          </span>
        </Link>
      )}
      {/* Desktop (embedded): row 1 = experience bar + action buttons; row 2 = filters + search */}
      {embedded && (
        <div className="hidden md:flex flex-col gap-3 min-w-0">
          {!readOnly && (
          <div className="flex justify-between items-center gap-4 flex-wrap min-w-0">
            {milestoneProgress && (() => {
              const scope = milestoneProgress.reviews.next ? milestoneProgress.reviews : milestoneProgress.logs;
              const currentBadge = scope.earned.length > 0 ? scope.earned[scope.earned.length - 1]! : null;
              const next = scope.next;
              const displayCurrent = next ? Math.min(scope.current, next.threshold) : scope.current;
              const displayPct = scope.progressPct;
              const kind = scope === milestoneProgress.reviews ? "reviews" : "logs";
              const categoryLabel = t(`nav.${mediaType}`);
              const badgeUser = t("mediaLogs.badgePopupYou");
              return (
                <div className="flex min-w-0 flex-1 items-center gap-2 ml-1 max-w-[400px]">
                  {currentBadge && (
                    <LevelBadge
                      icon={MEDIA_BADGE_ICONS[mediaType]}
                      level={scope.earned.length}
                      title={currentBadge.label}
                      popupDetail={{ user: badgeUser, categoryLabel, count: scope.current, kind }}
                    />
                  )}
                  {next && (
                    <div className="flex min-w-0 flex-1 items-center gap-2 min-w-[120px]">
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-darkest)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)] transition-all duration-500"
                          style={{ width: `${displayPct}%`, minWidth: displayCurrent > 0 ? "4px" : 0 }}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-[var(--color-light)]" title={next.label}>
                        {displayCurrent}/{next.threshold}
                      </span>
                      <LevelBadge
                        icon={MEDIA_BADGE_ICONS[mediaType]}
                        level={scope.earned.length + 1}
                        title={next.label}
                        popupDetail={{ user: badgeUser, categoryLabel, count: scope.current, kind }}
                      />
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center gap-3">
              <motion.div whileTap={tapScale} transition={tapTransition}>
                <Button
                  type="button"
                  variant="outline"
                  id="onboarding-dashboard-import-desktop"
                  onClick={() => setShowCustomEntry(true)}
                >
                  <span className="inline-flex items-center gap-2">
                    {t("customEntry.importButton")}
                  </span>
                </Button>
              </motion.div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn("shrink-0", !hasProFeatures && "opacity-60 cursor-pointer")}
                onClick={handleOpenExport}
                disabled={exportingCategory}
                title={t("mediaLogs.exportCategory")}
                aria-label={t("mediaLogs.exportCategory")}
              >
                {exportingCategory ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              </Button>
            </div>
          </div>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={statusFilterSelectOptions}
                aria-label={t("itemReviewForm.status")}
                className="min-w-0 w-[11rem] max-w-[min(100%,18rem)] shrink-0"
                triggerClassName={cn(
                  "w-full min-w-0 max-w-none",
                  colorizeTvStatuses && statusFilter
                    ? logStatusSelectTriggerClass(statusFilter)
                    : undefined
                )}
              />
              {showCollectionOwnershipFilters && (
                <Select
                  value={collectionFilter}
                  onValueChange={(v) => setCollectionFilter((v as CollectionListFilter) || "")}
                  options={collectionOwnershipSelectOptions}
                  aria-label={t("mediaLogs.filterCollection")}
                  className="min-w-0 w-[12rem] max-w-[min(100%,18rem)] shrink-0"
                  triggerClassName="w-full min-w-0 max-w-none"
                />
              )}
              <Select
                value={genreFilter}
                onValueChange={setGenreFilter}
                options={genreSelectOptions}
                aria-label={t("mediaLogs.filterGenre")}
                contentScrollable
                className="min-w-0 w-[12rem] max-w-[min(100%,20rem)] shrink-0"
                triggerClassName="w-full min-w-0 max-w-none"
              />
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as typeof sortBy)}
                options={[
                  { value: "dateDesc", label: t("mediaLogs.sortByDateDesc") },
                  { value: "dateAsc", label: t("mediaLogs.sortByDateAsc") },
                  { value: "gradeAsc", label: t("mediaLogs.sortByGradeAsc") },
                  { value: "gradeDesc", label: t("mediaLogs.sortByGradeDesc") },
                  ...(mediaType === "boardgames" ? [{ value: "matchesPlayedAsc" as const, label: t("mediaLogs.sortByMatchesPlayedAsc") }, { value: "matchesPlayedDesc" as const, label: t("mediaLogs.sortByMatchesPlayedDesc") }] : []),
                  ...(mediaType === "games" ? [{ value: "timeToBeatAsc" as const, label: t("mediaLogs.sortByTimeToBeatAsc") }, { value: "timeToBeatDesc" as const, label: t("mediaLogs.sortByTimeToBeatDesc") }] : []),
                ]}
                aria-label={t("mediaLogs.sortLabel")}
                className="min-w-0 w-[14rem] max-w-[min(100%,24rem)] shrink-0"
                triggerClassName="w-full min-w-0 max-w-none"
              />
            </div>
          </div>
        </div>
      )}

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

      {!readOnly && showExportModal && (
        <ExportLogsModal
          defaultMediaType={mediaType}
          defaultStatus={statusFilter}
          defaultCollection={collectionFilter}
          defaultSort={sortBy}
          exporting={exportingCategory}
          onExport={handleConfirmExport}
          onCancel={() => setShowExportModal(false)}
        />
      )}

      {/* Mobile when embedded: header, filters, search. Desktop when embedded uses the block above. When not embedded wrapper is always visible. */}
      <div className={cn("flex min-w-0 flex-col gap-3", embedded && "md:hidden")}>
      {/* 1. Header: left = title + experience bar; right = action buttons; bar shorter on mobile to fit one line */}
      <div className="flex min-w-0 flex-nowrap items-center justify-between gap-2 overflow-hidden max-md:gap-1.5 sm:flex-wrap sm:gap-3">
        {/* Left: title (when !embedded) + experience bar + badges */}
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden max-md:gap-1.5 sm:gap-3">
          {!embedded && (
            <OverflowMarquee className="min-w-0 text-2xl font-bold text-[var(--color-lightest)]">
              {label}
            </OverflowMarquee>
          )}
          {!readOnly && milestoneProgress && (() => {
            const scope = milestoneProgress.reviews.next ? milestoneProgress.reviews : milestoneProgress.logs;
            const currentBadge = scope.earned.length > 0 ? scope.earned[scope.earned.length - 1]! : null;
            const next = scope.next;
            const displayCurrent = next ? Math.min(scope.current, next.threshold) : scope.current;
            const displayPct = scope.progressPct;
            const kind = scope === milestoneProgress.reviews ? "reviews" : "logs";
            const categoryLabel = t(`nav.${mediaType}`);
            const badgeUser = t("mediaLogs.badgePopupYou");
            return (
              <div className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-visible max-md:min-w-[64px] max-md:gap-1 sm:gap-2">
                {currentBadge && (
                  <LevelBadge
                    icon={MEDIA_BADGE_ICONS[mediaType]}
                    level={scope.earned.length}
                    title={currentBadge.label}
                    className="max-md:scale-75"
                    popupDetail={{ user: badgeUser, categoryLabel, count: scope.current, kind }}
                  />
                )}
                {next && (
                  <div className="flex min-w-0 items-center gap-1 sm:gap-2 sm:min-w-[80px]">
                    <div className="h-1 min-w-[32px] flex-1 overflow-hidden rounded-full bg-[var(--color-darkest)] max-w-[90px] sm:h-1.5 sm:min-w-[48px] sm:max-w-[280px] md:h-2 md:max-w-[340px]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)] transition-all duration-500"
                        style={{
                          width: `${displayPct}%`,
                          minWidth: displayCurrent > 0 ? "4px" : 0,
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-[9px] text-[var(--color-light)] sm:text-[10px] md:text-xs" title={next.label}>
                      {displayCurrent}/{next.threshold}
                    </span>
                    <LevelBadge
                      icon={MEDIA_BADGE_ICONS[mediaType]}
                      level={scope.earned.length + 1}
                      title={next.label}
                      className="max-md:scale-75"
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
        {/* Right: action buttons */}
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-3 max-md:gap-1.5">
            <motion.div whileTap={tapScale} transition={tapTransition}>
              <Button
                type="button"
                variant="outline"
                className="h-8 shrink-0 px-2 text-xs md:h-9 md:px-4 md:py-2 md:text-sm"
                id={embedded ? "onboarding-dashboard-import-mobile" : undefined}
                onClick={() => setShowCustomEntry(true)}
                title={t("customEntry.importButton")}
                aria-label={t("customEntry.importButton")}
              >
                {t("customEntry.importButton")}
              </Button>
            </motion.div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "h-8 w-8 shrink-0 md:h-9 md:w-9",
                !hasProFeatures && "opacity-60 cursor-pointer"
              )}
              onClick={handleOpenExport}
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

      {/* 2. Filters row */}
      <div className="flex w-full min-w-0 flex-wrap items-center gap-3 overflow-hidden">
        {/* Mobile (< md): row1 = status [+ collection]; row2 = genre | sort */}
        <div className="flex w-full min-w-0 flex-col gap-2 md:hidden">
          <div
            className={cn(
              "grid w-full min-w-0 gap-2",
              showCollectionOwnershipFilters ? "grid-cols-2" : "grid-cols-1"
            )}
          >
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={statusFilterSelectOptions}
              aria-label={t("itemReviewForm.status")}
              className="min-w-0 w-full"
              triggerClassName={cn(
                "w-full max-w-none min-w-0",
                colorizeTvStatuses && statusFilter
                  ? logStatusSelectTriggerClass(statusFilter)
                  : undefined
              )}
            />
            {showCollectionOwnershipFilters && (
              <Select
                value={collectionFilter}
                onValueChange={(v) => setCollectionFilter((v as CollectionListFilter) || "")}
                options={collectionOwnershipSelectOptions}
                aria-label={t("mediaLogs.filterCollection")}
                className="min-w-0 w-full"
                triggerClassName="w-full max-w-none min-w-0"
              />
            )}
          </div>
          <div className="grid w-full min-w-0 grid-cols-2 gap-2">
            <Select
              value={genreFilter}
              onValueChange={setGenreFilter}
              options={genreSelectOptions}
              aria-label={t("mediaLogs.filterGenre")}
              contentScrollable
              className="min-w-0 w-full"
              triggerClassName="w-full max-w-none min-w-0"
            />
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as typeof sortBy)}
              options={[
                { value: "dateDesc", label: t("mediaLogs.sortByDateDesc") },
                { value: "dateAsc", label: t("mediaLogs.sortByDateAsc") },
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
        </div>
        {/* Desktop (md+): filters + sort wrap on narrow viewports; no search here (non-embedded uses floating search). */}
        <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-3 md:flex">
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={statusFilterSelectOptions}
          aria-label={t("itemReviewForm.status")}
          className="min-w-0 w-[11rem] max-w-[min(100%,18rem)] shrink-0"
          triggerClassName={cn(
            "w-full min-w-0 max-w-none",
            colorizeTvStatuses && statusFilter
              ? logStatusSelectTriggerClass(statusFilter)
              : undefined
          )}
        />
        {showCollectionOwnershipFilters && (
          <Select
            value={collectionFilter}
            onValueChange={(v) => setCollectionFilter((v as CollectionListFilter) || "")}
            options={collectionOwnershipSelectOptions}
            aria-label={t("mediaLogs.filterCollection")}
            className="min-w-0 w-[12rem] max-w-[min(100%,18rem)] shrink-0"
            triggerClassName="w-full min-w-0 max-w-none"
          />
        )}
        <Select
          value={genreFilter}
          onValueChange={setGenreFilter}
          options={genreSelectOptions}
          aria-label={t("mediaLogs.filterGenre")}
          contentScrollable
          className="min-w-0 w-[12rem] max-w-[min(100%,20rem)] shrink-0"
          triggerClassName="w-full min-w-0 max-w-none"
        />
        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as typeof sortBy)}
          options={[
            { value: "dateDesc", label: t("mediaLogs.sortByDateDesc") },
            { value: "dateAsc", label: t("mediaLogs.sortByDateAsc") },
            { value: "gradeAsc", label: t("mediaLogs.sortByGradeAsc") },
            { value: "gradeDesc", label: t("mediaLogs.sortByGradeDesc") },
            ...(mediaType === "boardgames" ? [{ value: "matchesPlayedAsc" as const, label: t("mediaLogs.sortByMatchesPlayedAsc") }, { value: "matchesPlayedDesc" as const, label: t("mediaLogs.sortByMatchesPlayedDesc") }] : []),
            ...(mediaType === "games" ? [{ value: "timeToBeatAsc" as const, label: t("mediaLogs.sortByTimeToBeatAsc") }, { value: "timeToBeatDesc" as const, label: t("mediaLogs.sortByTimeToBeatDesc") }] : []),
          ]}
          aria-label={t("mediaLogs.sortLabel")}
          className="min-w-0 w-[14rem] max-w-[min(100%,24rem)] shrink-0"
          triggerClassName="w-full min-w-0 max-w-none"
        />
      </div>
      </div>

      </div>

      {(embedded || readOnly) && (
        <div className="flex min-w-0 items-center gap-2">
          {categorySearchBar}
          {logViewEnabled && (
            <LogViewSelector value={dashboardLogView} onValueChange={setDashboardLogView} />
          )}
        </div>
      )}

      <div
        className="relative min-h-[10rem] min-w-0"
        aria-busy={listRefreshing || loading}
        aria-live="polite"
      >
        {listRefreshing && logs.length > 0 && (
          <div
            className="sticky top-0 z-20 flex items-center justify-center gap-2 border-b border-[var(--color-surface-border)] bg-[var(--color-dark)]/95 py-3 backdrop-blur-md"
            role="status"
          >
            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-lightest)]" aria-hidden />
            <p className="text-sm font-medium text-[var(--color-lightest)]">
              {t("mediaLogs.updatingList")}
            </p>
          </div>
        )}

        {logs.length === 0 && (loading || listRefreshing) ? (
          <MediaLogsListSkeleton
            count={embedded ? (activeLogView === "compact" ? 12 : activeLogView === "grid" ? 10 : 6) : 8}
            view={activeLogView}
          />
        ) : logs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex flex-1 flex-col items-center justify-center min-h-[50vh] py-12"
          >
            <p className="text-center text-[var(--color-light)]">
              {categorySearchQuery.trim()
                ? t("mediaLogs.noTitlesMatchSearch")
                : t("mediaLogs.noLogsFor", { label: label.toLowerCase() })}
            </p>
            {!readOnly && logs.length === 0 && !categorySearchQuery.trim() && (
              <Link
                to="/"
                state={{ mediaType }}
                className="mt-4 inline-block text-[var(--color-lightest)] underline hover:no-underline"
              >
                {t("mediaLogs.searchAndAddOne")}
              </Link>
            )}
          </motion.div>
        ) : (
          <motion.div {...listStaggerParentProps} className="min-w-0 overflow-hidden">
            <div
              className={
                activeLogView === "compact"
                  ? LOG_LIST_CARD_GRID_DENSE
                  : activeLogView === "grid"
                    ? LOG_LIST_CARD_GRID_MULTI
                    : LOG_LIST_CARD_GRID
              }
            >
            {logs.map((log) => (
              <motion.div
                key={log.id}
                variants={listStaggerItemVariants}
                className={cn(
                  "min-h-0",
                  activeLogView === "list" && "sm:h-full",
                  listStaggerItemClassName
                )}
              >
                <div className="h-full">
                  <MediaLogCard
                    log={log}
                    embedded={embedded}
                    readOnly={readOnly}
                    view={activeLogView}
                    mediaType={mediaType}
                    showCollectionOwnershipFilters={showCollectionOwnershipFilters}
                    hasProgressButton={hasProgressButton}
                    deletingId={deletingId}
                    incrementingId={incrementingId}
                    expandedReviewLogId={expandedReviewLogId}
                    onExpandReview={setExpandedReviewLogId}
                    onIncrement={handleIncrement}
                    onEdit={(lg, tab) => {
                      setLogEditTab(tab);
                      setEditingLog(lg);
                    }}
                    t={t}
                  />
                </div>
              </motion.div>
            ))}
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
      </div>

      {!readOnly && editingLog && (
        <LogForm
          mode="edit"
          log={editingLog}
          episodesCount={editingLogEpisodesCount}
          initialBoardGameTab={
            editingLog.mediaType === "boardgames" || mediaTypeHasMarketTab(editingLog.mediaType)
              ? logEditTab
              : undefined
          }
          onLogRefreshed={(lg) => {
            const normalized = decodeLogForDisplay(lg);
            setEditingLog(normalized);
            setLogs((prev) => prev.map((l) => (l.id === normalized.id ? normalized : l)));
          }}
          onSaved={handleSaved}
          onCancel={() => {
            setEditingLog(null);
            setLogEditTab("review");
          }}
          onDelete={editingLog ? (id) => handleDelete(id) : undefined}
        />
      )}

      {!readOnly && !embedded && (
      <form
        onSubmit={handleCategorySearchSubmit}
        className="fixed left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4 bottom-[max(5rem,calc(5rem+env(safe-area-inset-bottom)))] md:bottom-6 md:left-[calc(127.5px+50vw)]"
        aria-label={t("search.search")}
      >
        <UnifiedSearchBar
          ref={categorySearchInputRef}
          value={categorySearchDraft}
          onChange={handleCategorySearchDraftChange}
          placeholder={t("search.searchPlaceholder", { type: t(`nav.${mediaType}`).toLowerCase() })}
          title={t("mediaLogs.searchConfirmHint")}
          inputAriaLabel={t("search.search")}
          clearAriaLabel={t("search.clearSearch")}
          submitAriaLabel={t("search.search")}
          showClear={showCategorySearchClear}
          onClear={() => {
            setCategorySearchDraft("");
            setCategorySearchQuery("");
            categorySearchInputRef.current?.focus();
          }}
          disableSubmitWhenEmpty={false}
        />
      </form>
      )}
      </div>
    </div>
  );
}
