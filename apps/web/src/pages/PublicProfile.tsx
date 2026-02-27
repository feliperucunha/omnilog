import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetchPublic } from "@/lib/api";
import { DashboardSkeleton } from "@/components/skeletons";
import { ItemImage } from "@/components/ItemImage";
import { staggerContainer, staggerItem, tapScale, tapTransition } from "@/lib/animations";
import { useLocale } from "@/contexts/LocaleContext";
import { MEDIA_TYPES, type Log, type MediaType, toMediaType } from "@logeverything/shared";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select } from "@/components/ui/select";
import { MediaLogs } from "@/pages/MediaLogs";

const RESERVED_PATHS = new Set([
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "onboarding",
  "search",
  "about",
  "tiers",
  "settings",
  "item",
  "movies",
  "tv",
  "boardgames",
  "games",
  "books",
  "anime",
  "manga",
  "comics",
  "api",
]);

type StatsGroup = "category" | "month" | "year";
interface StatsEntry {
  period: string;
  hours: number;
}

interface PublicProfileResponse {
  id: string;
  username: string | null;
  visibleMediaTypes: string[];
  logCount: number;
}

const paperShadow = { boxShadow: "var(--shadow-sm)" };

export function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { t } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsGroup, setStatsGroup] = useState<StatsGroup>("category");
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const visibleTypes = profile?.visibleMediaTypes ?? [];
  const defaultCategory: MediaType = visibleTypes.length > 0 ? toMediaType(visibleTypes[0]) : "movies";
  const [selectedCategory, setSelectedCategory] = useState<MediaType>(() => {
    if (categoryParam && MEDIA_TYPES.includes(categoryParam as MediaType)) return toMediaType(categoryParam);
    return defaultCategory;
  });

  useEffect(() => {
    if (!userId || RESERVED_PATHS.has(userId)) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetchPublic<PublicProfileResponse>(`/users/${userId}`),
      apiFetchPublic<Log[]>(`/users/${userId}/logs`),
    ])
      .then(([p, allLogs]) => {
        setProfile(p);
        setLogs(allLogs);
        if (p.visibleMediaTypes.length > 0) {
          setSelectedCategory(toMediaType(p.visibleMediaTypes[0]));
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load profile");
        setProfile(null);
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (categoryParam && MEDIA_TYPES.includes(categoryParam as MediaType)) setSelectedCategory(toMediaType(categoryParam));
    else if (!categoryParam && visibleTypes.length > 0) setSelectedCategory(toMediaType(visibleTypes[0]));
  }, [categoryParam, visibleTypes]);

  const setCategory = useCallback(
    (type: MediaType) => {
      setSelectedCategory(type);
      setSearchParams({ category: type }, { replace: true });
    },
    [setSearchParams]
  );

  const fetchStats = useCallback(
    async (group: StatsGroup) => {
      if (!userId) return;
      setStatsLoading(true);
      try {
        const res = await apiFetchPublic<{ data: StatsEntry[] }>(`/users/${userId}/logs/stats?group=${group}`);
        setStats(res.data ?? []);
      } catch {
        setStats([]);
      } finally {
        setStatsLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (userId) fetchStats(statsGroup);
  }, [statsGroup, fetchStats, userId]);

  const recent = logs.slice(0, 10);
  const displayedStats =
    statsGroup === "category"
      ? stats.filter((s) => visibleTypes.includes(s.period as MediaType))
      : stats;
  const maxHours = displayedStats.length > 0 ? Math.max(...displayedStats.map((s) => s.hours), 1) : 1;
  const byType = Object.fromEntries(
    MEDIA_TYPES.map((type) => [type, logs.filter((l) => l.mediaType === type).length])
  );

  if (!userId || RESERVED_PATHS.has(userId)) {
    return <Navigate to="/" replace />;
  }

  if (loading && !profile) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        <DashboardSkeleton />
      </motion.div>
    );
  }

  if (error && !profile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
          <p className="font-medium text-[var(--color-lightest)]">{error}</p>
          <Link to="/" className="mt-4 inline-block text-sm text-[var(--color-light)] underline hover:no-underline">
            {t("nav.dashboard")}
          </Link>
        </Card>
      </motion.div>
    );
  }

  const title = profile?.username
    ? t("publicProfile.titleWithName", { name: profile.username })
    : t("publicProfile.title");

  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--color-lightest)]">{title}</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/">{t("publicProfile.backToApp")}</Link>
        </Button>
      </div>

      {visibleTypes.length > 0 && (
        <div className="flex min-w-0 justify-center overflow-hidden">
          <ToggleGroup
            type="single"
            value={selectedCategory}
            onValueChange={(v) => v && setCategory(v as MediaType)}
            className="inline-flex flex-wrap justify-center gap-2 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-2 w-full max-w-2xl md:w-fit md:gap-1 md:p-1"
            aria-label={t("dashboard.category")}
          >
            {visibleTypes.map((type) => (
              <ToggleGroupItem
                key={type}
                value={type}
                className="rounded-md px-4 py-3 text-sm data-[state=on]:bg-[var(--color-mid)]/50 md:px-3 md:py-2"
                aria-label={`${t(`nav.${type}`)} (${byType[type] ?? 0})`}
              >
                {t(`nav.${type}`)} ({byType[type] ?? 0})
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {visibleTypes.length > 0 && (
        <section aria-label={t(`nav.${selectedCategory}`)} className="min-w-0 overflow-hidden">
          <MediaLogs mediaType={selectedCategory} embedded publicUserId={userId} />
        </section>
      )}

      <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
        <p className="text-sm font-medium uppercase text-[var(--color-light)]">{t("dashboard.statsTitle")}</p>
        <Card className="min-w-0 border-[var(--color-dark)] bg-[var(--color-dark)] p-4" style={paperShadow}>
          <div className="flex min-w-0 flex-col gap-4 overflow-hidden">
            {/* Mobile: dropdown for time consumed filter */}
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
            {/* Desktop: button group */}
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
      </div>

      <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
        <p className="text-sm font-medium uppercase text-[var(--color-light)]">{t("dashboard.recentLogs")}</p>
        {recent.length === 0 ? (
          <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6" style={paperShadow}>
            <p className="text-center text-[var(--color-light)]">{t("dashboard.noLogsYet")}</p>
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
                        <p className="min-w-0 truncate font-medium text-[var(--color-lightest)]">{log.title}</p>
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
      </div>
    </div>
  );
}
