import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { MediaType, Log } from "@logeverything/shared";
import { LOG_STATUS_OPTIONS, STATUS_I18N_KEYS } from "@logeverything/shared";
import { apiFetch, apiFetchCached, apiFetchPublic, invalidateApiCache, invalidateLogsAndItemsCache } from "@/lib/api";
import { LogForm } from "@/components/LogForm";
import { CustomEntryForm } from "@/components/CustomEntryForm";
import { ItemImage } from "@/components/ItemImage";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { MediaLogsSkeleton } from "@/components/skeletons";
import { toast } from "sonner";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { useLogComplete } from "@/contexts/LogCompleteContext";
import { useMe } from "@/contexts/MeContext";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BOARD_GAME_PROVIDERS, type BoardGameProvider } from "@logeverything/shared";

const cardShadow = { boxShadow: "var(--shadow-card)" };

interface MediaLogsProps {
  mediaType: MediaType;
  /** When true, rendered inside Dashboard: no watermark background. */
  embedded?: boolean;
  /** When set, read-only public profile: fetch from /users/:id/logs, hide all write UI. */
  publicUserId?: string;
}

export function MediaLogs({ mediaType, embedded = false, publicUserId }: MediaLogsProps) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { showLogComplete } = useLogComplete();
  const { me, refetch: refetchMe } = useMe();
  const boardGameProvider = me?.boardGameProvider ?? "bgg";
  const provider = getApiKeyProviderForMediaType(mediaType, boardGameProvider);
  const needsKeyBanner = !publicUserId && provider != null && me?.apiKeys && !me.apiKeys[provider];
  const readOnly = !!publicUserId;
  const [savingBoardGameProvider, setSavingBoardGameProvider] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [editingLogEpisodesCount, setEditingLogEpisodesCount] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date" | "grade">("date");
  const [showCustomEntry, setShowCustomEntry] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [incrementingId, setIncrementingId] = useState<string | null>(null);

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

  const fetchLogs = useCallback(() => {
    setError(null);
    setLoading(true);
    const params = new URLSearchParams({ mediaType, sort: sortBy });
    if (statusFilter) params.set("status", statusFilter);
    const path = publicUserId
      ? `/users/${publicUserId}/logs?${params.toString()}`
      : `/logs?${params.toString()}`;
    const fetcher = publicUserId
      ? () => apiFetchPublic<Log[]>(path)
      : () => apiFetchCached<Log[]>(path, { ttlMs: 2 * 60 * 1000 });
    fetcher()
      .then(setLogs)
      .catch((err) => {
        setLogs([]);
        setError(err instanceof Error ? err.message : t("mediaLogs.couldntLoadLogs"));
      })
      .finally(() => setLoading(false));
  }, [mediaType, statusFilter, sortBy, t, publicUserId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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
      toast.success(t("toast.logDeleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = (completion?: { image: string | null; title: string; grade: number | null; mediaType?: string; id?: string }) => {
    setEditingLog(null);
    fetchLogs();
    if (completion) showLogComplete(completion);
  };

  const handleIncrement = async (log: Log) => {
    const { field, value } = getProgress(log);
    const next = value + 1;
    setIncrementingId(log.id);
    try {
      const updated = await apiFetch<Log>(`/logs/${log.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: next }),
      });
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

  const handleBoardGameProviderChange = async (newProvider: BoardGameProvider) => {
    if (me?.boardGameProvider === newProvider) return;
    setSavingBoardGameProvider(true);
    try {
      await apiFetch("/settings/board-game-provider", {
        method: "PUT",
        body: JSON.stringify({ provider: newProvider }),
      });
      await refetchMe();
      invalidateApiCache("/search");
      toast.success(t("settings.boardGameProviderSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.failedToSave"));
    } finally {
      setSavingBoardGameProvider(false);
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
        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-4">
            <p className="font-medium text-[var(--color-lightest)]">
              {t("mediaLogs.couldntLoadLogs")}
            </p>
            <p className="text-sm text-[var(--color-light)]">{error}</p>
            <Button onClick={fetchLogs}>
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
      {!embedded && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center" aria-hidden>
          <img src="/logo.svg" alt="" className="h-40 w-auto opacity-20 sm:h-52 md:h-64" />
        </div>
      )}
      <div className="relative z-10 flex min-w-0 flex-col gap-6 overflow-hidden">
      {needsKeyBanner && !embedded && (
        <Link
          to="/settings?open=api-keys"
          className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-left no-underline transition-colors text-[var(--color-warning-text)] hover:border-[var(--color-warning-hover-border)] hover:bg-[var(--color-warning-hover-bg)]"
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
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 overflow-hidden">
        <h1 className="min-w-0 truncate text-2xl font-bold text-[var(--color-lightest)]">
          {label}
        </h1>
        {!readOnly && (
          <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center gap-3">
            {mediaType === "boardgames" && (
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={boardGameProvider}
                  onValueChange={(v) => v && handleBoardGameProviderChange(v as BoardGameProvider)}
                  disabled={savingBoardGameProvider}
                  className="inline-flex rounded-md border border-[var(--color-mid)]/30 p-0.5"
                  aria-label={t("settings.boardGameProviderLabel")}
                >
                  {BOARD_GAME_PROVIDERS.map((p) => (
                    <ToggleGroupItem
                      key={p}
                      value={p}
                      className="h-8 px-3 text-sm"
                      aria-label={p === "bgg" ? t("settings.boardGameProviderBgg") : t("settings.boardGameProviderLudopedia")}
                    >
                      {p === "bgg" ? t("settings.boardGameProviderBgg") : t("settings.boardGameProviderLudopedia")}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            )}
            <motion.div whileTap={tapScale} transition={tapTransition}>
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
            </motion.div>
          </div>
        )}
      </div>
      {!readOnly && showCustomEntry && (
        <CustomEntryForm
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
        <span className="shrink-0 text-sm text-[var(--color-light)]">{t("itemReviewForm.status")}:</span>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button
            type="button"
            variant={statusFilter === "" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("")}
          >
            {t("mediaLogs.filterAll")}
          </Button>
          {statusOptions.map((statusValue) => (
            <Button
              key={statusValue}
              type="button"
              variant={statusFilter === statusValue ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(statusValue)}
            >
              {t(`status.${STATUS_I18N_KEYS[statusValue] ?? statusValue}`)}
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
            {logs.map((log) => (
              <motion.div key={log.id} variants={staggerItem} className="min-h-0 sm:h-full">
                <motion.div whileTap={tapScale} transition={tapTransition} className="h-full">
                  <Card
                    className="relative flex flex-col min-h-0 overflow-hidden border-[var(--color-dark)] bg-[var(--color-dark)] sm:min-h-[8.5rem]"
                    style={cardShadow}
                  >
                    {!readOnly && deletingId === log.id && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0D1B2A]/70">
                        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-light)]" />
                      </div>
                    )}
                    {!readOnly && hasProgressButton && (
                      <div className="absolute top-2 right-2 z-[1]">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 hover:text-emerald-300 border border-emerald-500/40 transition-colors shrink-0"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleIncrement(log);
                          }}
                          disabled={incrementingId === log.id || deletingId === log.id}
                          aria-label={t("mediaLogs.addOne")}
                        >
                          {incrementingId === log.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Plus className="h-4 w-4" aria-hidden />
                          )}
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-3 p-3 flex-1 min-h-0 sm:gap-4 sm:p-4">
                      <ItemImage src={log.image} className="h-16 w-11 flex-shrink-0 rounded-lg sm:h-20 sm:w-14" />
                        <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                        <Link
                          to={`/item/${log.mediaType}/${log.externalId}`}
                          className="line-clamp-1 font-semibold text-[var(--color-lightest)] no-underline hover:underline text-sm sm:text-base"
                        >
                          {log.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                          {log.startedAt && log.completedAt && (
                            <span className="text-[10px] sm:text-xs text-[var(--color-light)]">
                              {t("dashboard.finishedIn", { duration: formatTimeToFinish(log.startedAt, log.completedAt) })}
                            </span>
                          )}
                          {log.grade != null ? (
                            <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                          ) : (
                            <span className="text-[var(--color-light)]">—</span>
                          )}
                        </div>
                        {hasProgressButton && (() => {
                          const p = getProgress(log);
                          return (
                            <div className="mt-1">
                              <span className="text-xs text-[var(--color-light)]">
                                {t(p.labelKey)}: {p.value}
                              </span>
                            </div>
                          );
                        })()}
                        {log.review && (
                          <p className="line-clamp-2 text-xs sm:text-sm text-[var(--color-light)] min-h-0">
                            {log.review}
                          </p>
                        )}
                      </div>
                    </div>
                    {!readOnly && (
                      <div className="flex border-t border-[var(--color-darkest)]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 hover:bg-[var(--color-mid)]/30"
                          onClick={() => setEditingLog(log)}
                          disabled={deletingId === log.id}
                        >
                          {t("common.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-red-400 hover:bg-red-500/20 hover:text-red-400"
                          onClick={() => handleDelete(log.id)}
                          disabled={deletingId === log.id}
                        >
                          {t("common.delete")}
                        </Button>
                      </div>
                    )}
                  </Card>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {!readOnly && editingLog && (
        <LogForm
          mode="edit"
          log={editingLog}
          episodesCount={editingLogEpisodesCount}
          onSaved={handleSaved}
          onCancel={() => setEditingLog(null)}
        />
      )}

      {!readOnly && !embedded && (
      <form
        onSubmit={handleCategorySearchSubmit}
        className="fixed bottom-20 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4 md:bottom-6 md:left-[calc(127.5px+50vw)]"
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
