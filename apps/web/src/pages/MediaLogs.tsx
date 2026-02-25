import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { MediaType, Log } from "@logeverything/shared";
import { LOG_STATUS_OPTIONS, STATUS_I18N_KEYS } from "@logeverything/shared";
import { apiFetch, apiFetchCached, invalidateLogsAndItemsCache } from "@/lib/api";
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
import { useMe } from "@/contexts/MeContext";
import { getApiKeyProviderForMediaType } from "@/lib/apiKeyForMediaType";
import { API_KEY_META } from "@/lib/apiKeyMeta";

const cardShadow = { boxShadow: "var(--shadow-card)" };

interface MediaLogsProps {
  mediaType: MediaType;
}

export function MediaLogs({ mediaType }: MediaLogsProps) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { me } = useMe();
  const provider = getApiKeyProviderForMediaType(mediaType);
  const needsKeyBanner = provider != null && me?.apiKeys && !me.apiKeys[provider];
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date" | "grade">("date");
  const [showCustomEntry, setShowCustomEntry] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  const fetchLogs = useCallback(() => {
    setError(null);
    setLoading(true);
    const params = new URLSearchParams({ mediaType, sort: sortBy });
    if (statusFilter) params.set("status", statusFilter);
    apiFetchCached<Log[]>(`/logs?${params.toString()}`, { ttlMs: 2 * 60 * 1000 })
      .then(setLogs)
      .catch((err) => {
        setLogs([]);
        setError(err instanceof Error ? err.message : t("mediaLogs.couldntLoadLogs"));
      })
      .finally(() => setLoading(false));
  }, [mediaType, statusFilter, sortBy, t]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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
    if (completion) navigate("/log-complete", { state: completion });
  };

  const label = t(`nav.${mediaType}`);

  const handleCategorySearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = categorySearchQuery.trim();
    navigate("/search", { state: { mediaType, query: q || undefined } });
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
    <div className="relative min-h-full pb-24 md:pb-20">
      <div className="flex flex-col gap-6">
      {needsKeyBanner && (
        <Link
          to="/settings?open=api-keys"
          className="flex items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-left text-amber-200 no-underline transition-colors hover:bg-amber-500/20 hover:border-amber-500/70"
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" aria-hidden />
          <p className="text-sm font-medium text-amber-100">
            {t("apiKeyBanner.categoryMessage", {
              category: label,
              provider: API_KEY_META[provider!].name,
            })}
          </p>
          <span className="ml-auto text-xs font-medium text-amber-300">
            {t("apiKeyBanner.addKeyInSettings")} →
          </span>
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--color-lightest)]">
          {label}
        </h1>
        <div className="flex flex-wrap gap-2">
          <motion.div whileTap={tapScale} transition={tapTransition}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCustomEntry(true)}
            >
              {t("customEntry.addCustomEntry")}
            </Button>
          </motion.div>
        </div>
      </div>
      {showCustomEntry && (
        <CustomEntryForm
          mediaType={mediaType}
          onSaved={(completion) => {
            setShowCustomEntry(false);
            if (completion) handleSaved(completion);
          }}
          onCancel={() => setShowCustomEntry(false)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--color-light)]">{t("itemReviewForm.status")}:</span>
        <div className="flex flex-wrap gap-2">
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
        <span className="text-sm text-[var(--color-light)] ml-2 md:ml-4">{t("mediaLogs.sortLabel")}</span>
        <div className="flex flex-wrap gap-2">
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

      {logs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-sm)]">
            <p className="text-center text-[var(--color-light)]">
              {t("mediaLogs.noLogsFor", { label: label.toLowerCase() })}
            </p>
            <Link
              to="/search"
              state={{ mediaType }}
              className="mt-4 inline-block text-[var(--color-lightest)] underline hover:no-underline"
            >
              {t("mediaLogs.searchAndAddOne")}
            </Link>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate">
          <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {logs.map((log) => (
              <motion.div key={log.id} variants={staggerItem} className="min-h-0 sm:h-full">
                <motion.div whileTap={tapScale} transition={tapTransition} className="h-full">
                  <Card
                    className="relative flex flex-col min-h-0 overflow-hidden border-[var(--color-dark)] bg-[var(--color-dark)] sm:min-h-[8.5rem]"
                    style={cardShadow}
                  >
                    {deletingId === log.id && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0D1B2A]/70">
                        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-light)]" />
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
                        {log.review && (
                          <p className="line-clamp-2 text-xs sm:text-sm text-[var(--color-light)] min-h-0">
                            {log.review}
                          </p>
                        )}
                      </div>
                    </div>
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
                  </Card>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {editingLog && (
        <LogForm
          mode="edit"
          log={editingLog}
          onSaved={handleSaved}
          onCancel={() => setEditingLog(null)}
        />
      )}

      <form
        onSubmit={handleCategorySearchSubmit}
        className="fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4 md:left-[calc(127.5px+50vw)]"
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
      </div>
    </div>
  );
}
