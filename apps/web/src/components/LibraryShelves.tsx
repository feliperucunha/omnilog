import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IN_PROGRESS_STATUSES, type Log, type MediaType } from "@geeklogs/shared";
import { apiFetch } from "@/lib/api";
import { itemDetailPath } from "@/lib/itemRoutes";
import { getStatusLabel } from "@/lib/statusLabel";
import { ItemImage } from "@/components/ItemImage";
import { useLocale } from "@/contexts/LocaleContext";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

const IN_PROGRESS = new Set<string>(IN_PROGRESS_STATUSES);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function LibraryShelves({
  types,
  onOpenCategory,
}: {
  types: MediaType[];
  onOpenCategory: (type: MediaType) => void;
}) {
  const { t } = useLocale();
  const [byType, setByType] = useState<Partial<Record<MediaType, Log[]>>>({});
  const [loading, setLoading] = useState(true);
  const typeKey = types.join(",");

  useEffect(() => {
    let cancelled = false;
    const requested = typeKey.length > 0 ? (typeKey.split(",") as MediaType[]) : [];
    setLoading(true);
    void (async () => {
      const pairs = await Promise.all(
        requested.map(async (mediaType) => {
          try {
            const res = await apiFetch<{ data: Log[] }>(
              `/logs?mediaType=${encodeURIComponent(mediaType)}&sort=dateDesc&limit=12`
            );
            return [mediaType, res.data ?? []] as const;
          } catch {
            return [mediaType, [] as Log[]] as const;
          }
        })
      );
      if (cancelled) return;
      setByType(Object.fromEntries(pairs) as Partial<Record<MediaType, Log[]>>);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [typeKey]);

  const allLogs = useMemo(() => types.flatMap((type) => byType[type] ?? []), [types, byType]);
  const continueLogs = allLogs.filter((log) => log.status != null && IN_PROGRESS.has(log.status)).slice(0, 8);
  const weekCount = allLogs.filter((log) => Date.now() - new Date(log.updatedAt).getTime() < WEEK_MS).length;

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]" aria-busy={loading}>
      <div className="flex min-w-0 flex-col gap-6">
        {loading ? (
          <>
            <p className="sr-only">{t("common.loading")}</p>
            <section className="min-w-0">
              <h2 className="mb-2 text-sm font-semibold text-[var(--color-lightest)]">{t("dashboard.continue")}</h2>
              <div className="flex gap-3 overflow-hidden pb-1">
                {Array.from({ length: 2 }, (_, index) => (
                  <div
                    key={index}
                    className="h-[116px] w-[min(88%,320px)] shrink-0 animate-pulse rounded-[14px] bg-[var(--color-mid)]/30 sm:w-80"
                  />
                ))}
              </div>
            </section>
            {types.map((type) => (
              <section key={type} className="min-w-0">
                <h2 className="mb-2 text-sm font-semibold text-[var(--color-lightest)]">{t(`nav.${type}`)}</h2>
                <ShelfSkeleton />
              </section>
            ))}
          </>
        ) : (
          <>
            {continueLogs.length > 0 && (
              <section className="min-w-0">
                <h2 className="mb-2 text-sm font-semibold text-[var(--color-lightest)]">{t("dashboard.continue")}</h2>
                <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {continueLogs.map((log) => (
                    <ContinueCard key={log.id} log={log} />
                  ))}
                </div>
              </section>
            )}
            {types.map((type) => {
              const logs = byType[type] ?? [];
              if (logs.length === 0) return null;
              return (
                <section key={type} className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-[var(--color-lightest)]">{t(`nav.${type}`)}</h2>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onOpenCategory(type)}>
                      {t("dashboard.allLogs")}
                    </Button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                    {logs.map((log) => (
                      <ShelfCover key={log.id} log={log} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
      <aside className="hidden min-w-0 lg:block">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[var(--color-lightest)]">{t("dashboard.thisWeek")}</h2>
          {loading ? (
            <div className="mt-3 h-10 w-16 animate-pulse rounded bg-[var(--color-mid)]/35" />
          ) : (
            <p className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[var(--color-lightest)]">{weekCount}</p>
          )}
          <p className="mt-1 text-sm text-[var(--color-light)]">{t("dashboard.thisWeekHint")}</p>
          <Link to="/statistics" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}>
            {t("dashboard.openActivity")}
          </Link>
        </Card>
      </aside>
    </div>
  );
}

function ShelfSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden pb-1">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="w-[132px] shrink-0">
          <div className="aspect-[2/3] w-full animate-pulse rounded-[10px] bg-[var(--color-mid)]/35" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-[var(--color-mid)]/35" />
          <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-[var(--color-mid)]/25" />
        </div>
      ))}
    </div>
  );
}

function ContinueCard({ log }: { log: Log }) {
  const { t } = useLocale();
  const status = getStatusLabel(t, log.status, log.mediaType);
  return (
    <Link
      to={itemDetailPath(log.mediaType, log.externalId)}
      className="flex w-[min(88%,320px)] shrink-0 gap-3 rounded-[14px] border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-2.5 sm:w-80"
    >
      <ItemImage
        src={log.image}
        alt=""
        mediaType={log.mediaType}
        boardGameSource={log.boardGameSource}
        className="h-24 w-16 shrink-0 overflow-hidden rounded-[10px] bg-[var(--color-mid)]/30"
      />
      <span className="min-w-0">
        <span className="line-clamp-2 text-sm font-semibold text-[var(--color-lightest)]">{log.title}</span>
        {status ? <span className="mt-1 block text-xs text-[var(--color-light)]">{status}</span> : null}
      </span>
    </Link>
  );
}

function ShelfCover({ log }: { log: Log }) {
  const { t } = useLocale();
  const status = getStatusLabel(t, log.status, log.mediaType);
  return (
    <Link to={itemDetailPath(log.mediaType, log.externalId)} className="w-[132px] shrink-0">
      <ItemImage
        src={log.image}
        alt=""
        mediaType={log.mediaType}
        boardGameSource={log.boardGameSource}
        className="aspect-[2/3] w-full overflow-hidden rounded-[10px] bg-[var(--color-mid)]/30"
      />
      <div className="mt-1 line-clamp-2 text-sm text-[var(--color-lightest)]">{log.title}</div>
      {status ? <div className="mt-0.5 line-clamp-1 text-xs text-[var(--color-light)]">{status}</div> : null}
    </Link>
  );
}
