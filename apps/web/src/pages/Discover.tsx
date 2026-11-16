import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MEDIA_TYPES, type Log, type MediaType, type SearchResult } from "@geeklogs/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { decodeLogForDisplay, decodeSearchResultForDisplay } from "@/lib/decodeDisplayFields";
import { itemDetailPath } from "@/lib/itemRoutes";
import { getStatusLabel } from "@/lib/statusLabel";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_LOGS = 10;
const PAGE_SIZE = 100;
const MAX_PAGES = 4;

const PLANNED: Record<MediaType, string> = {
  movies: "plan to watch",
  tv: "plan to watch",
  anime: "plan to watch",
  boardgames: "plan to play",
  games: "plan to play",
  books: "plan to read",
  manga: "plan to read",
  comics: "plan to read",
};

type PlannedItem = { id: string; externalId: string; title: string; status: string };
type BeyondItem = { id: string; title: string; note: string };
type CategorySnapshot = {
  mean: string;
  lines: string[];
  planned: PlannedItem[];
  beyond: BeyondItem[];
};
type DiscoverSnapshot = {
  refreshedAt: string;
  categories: Partial<Record<MediaType, CategorySnapshot>>;
};

function storageKey(userId: string) {
  return `geeklogs.discover.v1:${userId}`;
}

function readSnapshot(userId: string): DiscoverSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiscoverSnapshot;
    if (!parsed?.refreshedAt || !parsed.categories) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(userId: string, snapshot: DiscoverSnapshot) {
  localStorage.setItem(storageKey(userId), JSON.stringify(snapshot));
}

function isFresh(snapshot: DiscoverSnapshot | null): boolean {
  if (!snapshot) return false;
  const at = new Date(snapshot.refreshedAt).getTime();
  return Number.isFinite(at) && Date.now() - at < DAY_MS;
}

async function fetchCategoryLogs(mediaType: MediaType): Promise<Log[]> {
  const logs: Log[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      mediaType,
      sort: "dateDesc",
      limit: String(PAGE_SIZE),
    });
    if (cursor) params.set("cursor", cursor);
    const res = await apiFetch<{ data: Log[]; nextCursor: string | null }>(`/logs?${params.toString()}`);
    logs.push(...(res.data ?? []).map(decodeLogForDisplay));
    cursor = res.nextCursor;
    if (!cursor) break;
  }
  return logs;
}

export function Discover() {
  const { t, locale } = useLocale();
  const { token } = useAuth();
  const { me } = useMe();
  const { visibleTypes } = useVisibleMediaTypes();
  const { setPageTitle } = usePageTitle() ?? {};
  const userId = me?.user?.id ?? null;
  const categories = visibleTypes.length > 0 ? visibleTypes : [...MEDIA_TYPES];

  const [counts, setCounts] = useState<Partial<Record<MediaType, number>>>({});
  const [selected, setSelected] = useState<MediaType>(categories[0] ?? "movies");
  const [snapshot, setSnapshot] = useState<DiscoverSnapshot | null>(null);
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
    if (!userId) return;
    setSnapshot(readSnapshot(userId));
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!token || !userId || reading) return;
    setReading(true);
    try {
      const countRes = await apiFetch<{ data: Record<MediaType, number> }>("/logs/counts");
      const nextCounts = countRes.data ?? {};
      setCounts(nextCounts);
      const categoriesOut: DiscoverSnapshot["categories"] = {};
      const provider = me?.boardGameProvider ?? "bgg";
      for (const mediaType of categories) {
        if ((nextCounts[mediaType] ?? 0) < MIN_LOGS) continue;
        const logs = await fetchCategoryLogs(mediaType);
        const grades = logs.map((log) => log.grade).filter((grade): grade is number => grade != null);
        const mean =
          grades.length > 0
            ? (grades.reduce((sum, grade) => sum + grade, 0) / grades.length).toFixed(1)
            : "—";
        const genreCounts = new Map<string, number>();
        const statusCounts = new Map<string, number>();
        for (const log of logs) {
          for (const genre of log.genres ?? []) {
            genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
          }
          const status = log.status ?? "";
          if (status) statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
        }
        const topGenres = [...genreCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name);
        const lines = [
          t("discover.logsCount", { count: String(logs.length) }),
          ...[...statusCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([status, count]) =>
              t("discover.statusMix", {
                status: getStatusLabel(t, status, mediaType),
                count: String(count),
              })
            ),
        ];
        if (topGenres.length > 0) lines.push(t("discover.topGenres", { genres: topGenres.join(", ") }));
        const planned = logs
          .filter((log) => log.status === PLANNED[mediaType])
          .slice(0, 8)
          .map((log) => ({
            id: log.id,
            externalId: log.externalId,
            title: log.title,
            status: getStatusLabel(t, log.status ?? PLANNED[mediaType], mediaType),
          }));
        const params = new URLSearchParams({ type: mediaType, viewer: "auth" });
        if (mediaType === "boardgames") params.set("boardGameProvider", provider);
        const rec = await apiFetch<{ results?: SearchResult[] }>(`/search/recommendations?${params.toString()}`);
        const known = new Set(logs.map((log) => log.title.trim().toLowerCase()));
        const beyond = (rec.results ?? [])
          .map(decodeSearchResultForDisplay)
          .filter((item) => !known.has(item.title.trim().toLowerCase()))
          .slice(0, 8)
          .map((item) => ({
            id: item.id,
            title: item.title,
            note: item.subtitle || (item.genres ?? []).slice(0, 2).join(" · ") || item.year || "",
          }));
        categoriesOut[mediaType] = { mean, lines, planned, beyond };
      }
      const next: DiscoverSnapshot = { refreshedAt: new Date().toISOString(), categories: categoriesOut };
      writeSnapshot(userId, next);
      setSnapshot(next);
    } catch {
      toast.error(t("common.tryAgain"));
    } finally {
      setReading(false);
      setAttempted(true);
    }
  }, [categories, me?.boardGameProvider, reading, t, token, userId]);

  useEffect(() => {
    if (!token) return;
    void apiFetch<{ data: Record<MediaType, number> }>("/logs/counts")
      .then((res) => setCounts(res.data ?? {}))
      .catch(() => setCounts({}));
  }, [token]);

  useEffect(() => {
    if (!userId || reading || attempted) return;
    if (isFresh(snapshot) || isFresh(readSnapshot(userId))) return;
    void refresh();
  }, [attempted, reading, refresh, snapshot, userId]);

  const locked = isFresh(snapshot);
  const count = counts[selected] ?? 0;
  const ready = count >= MIN_LOGS;
  const saved = snapshot?.categories[selected];
  const when = snapshot
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
        .filter((type) => (counts[type] ?? 0) < MIN_LOGS)
        .map((type) => t(`nav.${type}`)),
    [categories, counts, t]
  );

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
          {reading ? t("discover.reading") : snapshot ? t("discover.saved", { when }) : t("discover.reading")}
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
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Card className="flex flex-col gap-2 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-light)]">
              {t("discover.yourTaste")} · {t(`nav.${selected}`)}
            </span>
            <p className="display-title text-3xl text-[var(--color-lightest)]">
              {t("discover.meanGrade", { grade: saved.mean })}
            </p>
            {saved.lines.map((line) => (
              <p key={line} className="text-[var(--color-lightest)]">
                {line}
              </p>
            ))}
          </Card>
          <div className="flex min-w-0 flex-col gap-4">
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-[var(--color-lightest)]">{t("discover.fromYourList")}</h2>
              {saved.planned.length === 0 ? (
                <p className="text-sm text-[var(--color-light)]">{t("discover.nothingPlanned")}</p>
              ) : (
                saved.planned.map((item) => (
                  <Link
                    key={item.id}
                    to={itemDetailPath(selected, item.externalId)}
                    className="rounded-[14px] border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-3 text-[var(--color-lightest)] no-underline"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <span className="shrink-0 rounded-full border border-[var(--color-surface-border)] px-2 py-0.5 text-[11px] text-[var(--color-light)]">
                        {t("discover.onYourList")}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-[var(--color-light)]">{item.status}</span>
                  </Link>
                ))
              )}
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-[var(--color-lightest)]">{t("discover.outsideList")}</h2>
              {saved.beyond.map((item) => (
                <Link
                  key={item.id}
                  to={itemDetailPath(selected, item.id)}
                  className="rounded-[14px] border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-3 text-[var(--color-lightest)] no-underline"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{item.title}</span>
                    <span className="shrink-0 rounded-full border border-[var(--color-surface-border)] px-2 py-0.5 text-[11px] text-[var(--color-light)]">
                      {t("discover.newToYou")}
                    </span>
                  </span>
                  {item.note ? <span className="mt-1 block text-sm text-[var(--color-light)]">{item.note}</span> : null}
                </Link>
              ))}
            </section>
          </div>
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
