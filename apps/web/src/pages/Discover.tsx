import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DISCOVER_MIN_LOGS,
  DISCOVER_TASTE_REFRESH_MS,
  MEDIA_TYPES,
  type DiscoverTasteSnapshot,
  type MediaType,
} from "@geeklogs/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { itemDetailPath } from "@/lib/itemRoutes";
import { getStatusLabel } from "@/lib/statusLabel";
import { cn } from "@/lib/utils";

function isFresh(snapshot: DiscoverTasteSnapshot | null): boolean {
  if (!snapshot?.refreshedAt) return false;
  const at = Date.parse(snapshot.refreshedAt);
  return Number.isFinite(at) && Date.now() - at < DISCOVER_TASTE_REFRESH_MS;
}

const NEXT_TITLE_KEYS: Record<MediaType, string> = {
  movies: "discover.nextWatch",
  tv: "discover.nextWatch",
  anime: "discover.nextWatch",
  manga: "discover.nextRead",
  books: "discover.nextRead",
  comics: "discover.nextRead",
  games: "discover.nextPlay",
  boardgames: "discover.nextPlay",
};

export function Discover() {
  const { t, locale } = useLocale();
  const { token } = useAuth();
  const { visibleTypes } = useVisibleMediaTypes();
  const { setPageTitle } = usePageTitle() ?? {};
  const categories = visibleTypes.length > 0 ? visibleTypes : [...MEDIA_TYPES];

  const [counts, setCounts] = useState<Partial<Record<MediaType, number>>>({});
  const [selected, setSelected] = useState<MediaType>(categories[0] ?? "movies");
  const [snapshot, setSnapshot] = useState<DiscoverTasteSnapshot | null>(null);
  const [reading, setReading] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    setPageTitle?.(t("nav.discover"));
    return () => setPageTitle?.(null);
  }, [setPageTitle, t]);

  useEffect(() => {
    if (!categories.includes(selected)) setSelected(categories[0] ?? "movies");
  }, [categories, selected]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void apiFetch<DiscoverTasteSnapshot>("/discover/taste")
      .then((res) => {
        if (!cancelled) setSnapshot(res);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setAttempted(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void apiFetch<{ data: Record<MediaType, number> }>("/logs/counts")
      .then((res) => setCounts(res.data ?? {}))
      .catch(() => setCounts({}));
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token || reading) return;
    setReading(true);
    try {
      const countRes = await apiFetch<{ data: Record<MediaType, number> }>("/logs/counts");
      const nextCounts = countRes.data ?? {};
      setCounts(nextCounts);
      const next = await apiFetch<DiscoverTasteSnapshot>("/discover/taste", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, mediaTypes: categories }),
        timeout: 120_000,
        maxAttempts: 1,
      });
      setSnapshot(next);
    } catch (error) {
      toast.error(error instanceof ApiError && error.statusCode === 503 ? t("discover.aiUnavailable") : t("common.tryAgain"));
    } finally {
      setReading(false);
      setAttempted(true);
    }
  }, [categories, locale, reading, t, token]);

  useEffect(() => {
    if (!token || !attempted || reading || isFresh(snapshot)) return;
    if (!categories.some((type) => (counts[type] ?? 0) >= DISCOVER_MIN_LOGS)) return;
    void refresh();
  }, [attempted, categories, counts, reading, refresh, snapshot, token]);

  const locked = isFresh(snapshot);
  const count = counts[selected] ?? 0;
  const ready = count >= DISCOVER_MIN_LOGS;
  const saved = snapshot?.categories[selected];
  const when = snapshot?.refreshedAt
    ? new Date(snapshot.refreshedAt).toLocaleString(locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const shortNames = useMemo(
    () =>
      categories
        .filter((type) => (counts[type] ?? 0) < DISCOVER_MIN_LOGS)
        .map((type) => t(`nav.${type}`)),
    [categories, counts, t]
  );

  const nextItems = useMemo(() => {
    if (!saved) return [];
    return [
      ...saved.planned.map((item) => ({
        key: `planned-${item.id}`,
        externalId: item.externalId,
        title: item.title,
        note: getStatusLabel(t, item.status, selected),
        badge: t("discover.onYourList"),
        onList: true,
      })),
      ...saved.beyond.map((item) => ({
        key: `beyond-${item.id}`,
        externalId: item.id,
        title: item.title,
        note: item.note,
        badge: t("discover.newToYou"),
        onList: false,
      })),
    ];
  }, [saved, selected, t]);

  const maxChartCount = Math.max(1, ...(saved?.charts ?? []).map((chart) => chart.count));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[var(--color-light)]">{t("discover.lede")}</p>
        <Button type="button" disabled={locked || reading} onClick={() => void refresh()}>
          {reading ? t("discover.refreshing") : locked ? t("discover.availableTomorrow") : t("discover.refresh")}
        </Button>
      </div>
      <Card className="flex flex-col gap-2 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4">
        <p className="text-[var(--color-lightest)]">
          {reading ? t("discover.reading") : snapshot?.refreshedAt ? t("discover.saved", { when }) : t("discover.reading")}
        </p>
        <p className="text-sm text-[var(--color-light)]">
          {t("discover.note")}
          {shortNames.length > 0 ? ` ${shortNames.join(", ")}.` : ""}
        </p>
      </Card>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelected(type)}
            aria-pressed={type === selected}
            className={cn(
              "shrink-0 rounded-full border px-3 py-2 text-sm font-medium",
              type === selected
                ? "border-[var(--color-lightest)] bg-[var(--color-lightest)] text-[var(--color-darkest)]"
                : "border-[var(--color-surface-border)] bg-[var(--color-dark)] text-[var(--color-light)]"
            )}
          >
            {t(`nav.${type}`)} · {counts[type] ?? 0}
          </button>
        ))}
      </div>
      {ready && saved ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="flex min-w-0 flex-col gap-2 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-light)]">
              {t("discover.yourTaste")} · {t(`nav.${selected}`)}
            </span>
            {saved.lines.map((line) => (
              <p key={line} className="text-[var(--color-lightest)]">
                {line}
              </p>
            ))}
            <div className="mt-2 flex min-w-0 flex-col gap-3 border-t border-[var(--color-surface-border)] pt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-light)]">
                {t("discover.withinCategory", { category: t(`nav.${selected}`) })}
              </span>
              {saved.charts.length === 0 ? (
                <p className="text-sm text-[var(--color-light)]">{t("discover.noCharts")}</p>
              ) : (
                saved.charts.map((chart) => (
                  <div key={chart.label} className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-[var(--color-lightest)]">{chart.label}</span>
                      <span className="shrink-0 text-xs text-[var(--color-light)]">{chart.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-border)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-lightest)]"
                        style={{ width: `${(chart.count / maxChartCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
          <Card className="flex min-w-0 flex-col gap-3 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4">
            <h2 className="text-lg font-semibold text-[var(--color-lightest)]">{t(NEXT_TITLE_KEYS[selected])}</h2>
            {nextItems.length === 0 ? (
              <p className="text-sm text-[var(--color-light)]">{t("discover.emptyNext")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {nextItems.map((item) => (
                  <Link
                    key={item.key}
                    to={itemDetailPath(selected, item.externalId)}
                    className="rounded-[14px] border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-3 text-[var(--color-lightest)] no-underline"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[11px]",
                          item.onList
                            ? "border-[var(--color-lightest)] text-[var(--color-lightest)]"
                            : "border-[var(--color-surface-border)] text-[var(--color-light)]"
                        )}
                      >
                        {item.badge}
                      </span>
                    </span>
                    {item.note ? <span className="mt-1 block text-sm text-[var(--color-light)]">{item.note}</span> : null}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : ready && reading ? (
        <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4">
          <p className="text-[var(--color-lightest)]">{t("discover.reading")}</p>
        </Card>
      ) : (
        <Card className="flex flex-col items-start gap-3 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4">
          <h2 className="text-lg font-semibold text-[var(--color-lightest)]">
            {t("discover.needsMore", { category: t(`nav.${selected}`) })}
          </h2>
          <p className="text-[var(--color-light)]">
            {t("discover.needsMoreBody", { count: String(count) })}
          </p>
          <Button asChild>
            <Link to={`/dashboard?category=${selected}`}>{t("discover.addInLibrary")}</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
