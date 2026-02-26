import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, apiFetchCached } from "@/lib/api";
import { DashboardSkeleton } from "@/components/skeletons";
import { CustomEntryForm } from "@/components/CustomEntryForm";
import { ItemImage } from "@/components/ItemImage";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { MEDIA_TYPES, type Log, type MediaType } from "@logeverything/shared";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";

const paperShadow = { boxShadow: "var(--shadow-sm)" };

type StatsGroup = "category" | "month" | "year";
interface StatsEntry {
  period: string;
  hours: number;
}

export function Dashboard() {
  const { t } = useLocale();
  const { visibleTypes } = useVisibleMediaTypes();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsGroup, setStatsGroup] = useState<StatsGroup>("category");
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showCustomEntry, setShowCustomEntry] = useState(false);

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
    fetchStats(statsGroup);
  }, [statsGroup, fetchStats]);

  const fetchLogs = useCallback(() => {
    setError(null);
    setLoading(true);
    apiFetchCached<Log[]>("/logs", { ttlMs: 2 * 60 * 1000 })
      .then(setLogs)
      .catch((err) => {
        setLogs([]);
        setError(err instanceof Error ? err.message : t("dashboard.couldntLoadLogs"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const recent = logs.slice(0, 10);
  const displayedStats =
    statsGroup === "category"
      ? stats.filter((s) => visibleTypes.includes(s.period as MediaType))
      : stats;
  const maxHours = displayedStats.length > 0 ? Math.max(...displayedStats.map((s) => s.hours), 1) : 1;
  const byType = Object.fromEntries(
    MEDIA_TYPES.map((type) => [
      type,
      logs.filter((l) => l.mediaType === type).length,
    ])
  );

  if (loading && logs.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <DashboardSkeleton />
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
              {t("dashboard.couldntLoadLogs")}
            </p>
            <p className="text-sm text-[var(--color-light)]">{error}</p>
            <Button
              onClick={fetchLogs}
            >
              {t("common.tryAgain")}
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-[var(--color-lightest)]">
        {t("dashboard.title")}
      </h1>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase text-[var(--color-light)]">
          {t("dashboard.yourStats")}
        </p>
        <motion.div variants={staggerContainer} initial="initial" animate="animate">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {visibleTypes.map((type) => (
              <motion.div key={type} variants={staggerItem} className="h-full">
                <motion.div
                  whileTap={tapScale}
                  transition={tapTransition}
                  className="h-full"
                >
                  <Link
                    to={`/${type}`}
                    className="flex flex-col justify-center h-full min-h-[5rem] block rounded-md border border-[var(--color-dark)] bg-[var(--color-dark)] p-4 text-inherit no-underline shadow-[var(--shadow-card)] transition-opacity hover:opacity-90"
                  >
                    <p className="text-xl font-bold text-[var(--color-lightest)]">
                      {byType[type] ?? 0}
                    </p>
                    <p className="text-xs text-[var(--color-light)] truncate">
                      {t(`nav.${type}`)}
                    </p>
                  </Link>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase text-[var(--color-light)]">
          {t("dashboard.statsTitle")}
        </p>
        <div className="flex gap-2">
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
          <div className="h-48 animate-pulse rounded-md bg-[var(--color-dark)]" />
        ) : stats.length === 0 ? (
          <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6" style={paperShadow}>
            <p className="text-center text-sm text-[var(--color-light)]">
              {t("dashboard.noStatsYet")}
            </p>
          </Card>
        ) : (
          <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-4" style={paperShadow}>
            <div className="flex flex-col gap-2">
              {displayedStats.map(({ period, hours }) => (
                <div key={period} className="flex items-center gap-3">
                  <span
                    className={
                      statsGroup === "category"
                        ? "min-w-[5.5rem] max-w-[8rem] shrink-0 truncate text-xs text-[var(--color-light)]"
                        : "w-20 shrink-0 text-xs text-[var(--color-light)]"
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
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium uppercase text-[var(--color-light)]">
            {t("dashboard.recentLogs")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild >
              <Link to="/search">{t("dashboard.addLog")}</Link>
            </Button>
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
          </div>
        </div>
        {showCustomEntry && (
          <CustomEntryForm
            onSaved={(completion) => {
              setShowCustomEntry(false);
              if (completion) navigate("/log-complete", { state: completion });
            }}
            onCancel={() => setShowCustomEntry(false)}
          />
        )}
        {recent.length === 0 ? (
          <Card
            className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6"
            style={paperShadow}
          >
            <p className="text-center text-[var(--color-light)]">
              {t("dashboard.noLogsYet")}{" "}
              <Link
                to="/search"
                className="text-[var(--color-lightest)] underline hover:no-underline"
              >
                {t("dashboard.searchAndAddFirst")}
              </Link>
            </p>
          </Card>
        ) : (
          <motion.ul
            className="list-none p-0 m-0"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <div className="flex flex-col gap-2">
              {recent.map((log) => (
                <motion.li key={log.id} variants={staggerItem} className="list-none">
                  <motion.div whileTap={tapScale} transition={tapTransition}>
                    <Link
                      to={`/item/${log.mediaType}/${log.externalId}`}
                      className="flex gap-3 rounded-md border border-[var(--color-dark)] bg-[var(--color-dark)] p-4 text-inherit no-underline min-w-0"
                      style={paperShadow}
                    >
                      <ItemImage src={log.image} className="h-12 w-9 rounded" />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <p className="font-medium text-[var(--color-lightest)] truncate min-w-0">
                          {log.title}
                        </p>
                        <div className="flex items-center shrink-0 gap-2">
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
                      </div>
                    </Link>
                  </motion.div>
                </motion.li>
              ))}
            </div>
          </motion.ul>
        )}
      </div>
    </div>
  );
}
