import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { MediaType, Log } from "@logeverything/shared";
import { LOG_STATUS_OPTIONS, STATUS_I18N_KEYS } from "@logeverything/shared";
import { apiFetch, apiFetchCached, invalidateLogsAndItemsCache } from "@/lib/api";
import { LogForm } from "@/components/LogForm";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { MediaLogsSkeleton } from "@/components/skeletons";
import { toast } from "sonner";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";

const cardShadow = { boxShadow: "var(--shadow-card)" };

interface MediaLogsProps {
  mediaType: MediaType;
}

export function MediaLogs({ mediaType }: MediaLogsProps) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date" | "grade">("date");

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
            <Button
              className="bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
              onClick={fetchLogs}
            >
              {t("common.tryAgain")}
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  const statusOptions = LOG_STATUS_OPTIONS[mediaType];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--color-lightest)]">
          {label}
        </h1>
        <motion.div whileTap={tapScale} transition={tapTransition}>
          <Button
            asChild
            className="bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
          >
            <Link to="/search" state={{ mediaType }}>
              {t("mediaLogs.addLog")}
            </Link>
          </Button>
        </motion.div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--color-light)]">{t("itemReviewForm.status")}:</span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={statusFilter === "" ? "default" : "outline"}
            size="sm"
            className={
              statusFilter === ""
                ? "bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
                : "border-[var(--color-mid)] bg-[var(--color-dark)] text-[var(--color-lightest)] hover:bg-[var(--color-dark)]"
            }
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
              className={
                statusFilter === statusValue
                  ? "bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
                  : "border-[var(--color-mid)] bg-[var(--color-dark)] text-[var(--color-lightest)] hover:bg-[var(--color-dark)]"
              }
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
            className={
              sortBy === "date"
                ? "bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
                : "border-[var(--color-mid)] bg-[var(--color-dark)] text-[var(--color-lightest)] hover:bg-[var(--color-dark)]"
            }
            onClick={() => setSortBy("date")}
          >
            {t("mediaLogs.sortByDate")}
          </Button>
          <Button
            type="button"
            variant={sortBy === "grade" ? "default" : "outline"}
            size="sm"
            className={
              sortBy === "grade"
                ? "bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
                : "border-[var(--color-mid)] bg-[var(--color-dark)] text-[var(--color-lightest)] hover:bg-[var(--color-dark)]"
            }
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {logs.map((log) => (
              <motion.div key={log.id} variants={staggerItem} className="h-full min-h-0">
                <motion.div whileTap={tapScale} transition={tapTransition} className="h-full">
                  <Card
                    className="relative flex flex-col h-full min-h-[8.5rem] overflow-hidden border-[var(--color-dark)] bg-[var(--color-dark)]"
                    style={cardShadow}
                  >
                    {deletingId === log.id && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0D1B2A]/70">
                        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-light)]" />
                      </div>
                    )}
                    <div className="flex gap-4 p-4 flex-1 min-h-0">
                      {log.image ? (
                        <img
                          src={log.image}
                          alt=""
                          className="h-20 w-14 flex-shrink-0 rounded-lg object-cover bg-[var(--color-darkest)]"
                        />
                      ) : (
                        <div
                          className="h-20 w-14 flex-shrink-0 rounded-lg bg-[var(--color-darkest)]"
                        />
                      )}
                        <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                        <Link
                          to={`/item/${log.mediaType}/${log.externalId}`}
                          className="line-clamp-1 font-semibold text-[var(--color-lightest)] no-underline hover:underline"
                        >
                          {log.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          {log.startedAt && log.completedAt && (
                            <span className="text-xs text-[var(--color-light)]">
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
                          <p className="line-clamp-2 text-sm text-[var(--color-light)] min-h-0">
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
    </div>
  );
}
