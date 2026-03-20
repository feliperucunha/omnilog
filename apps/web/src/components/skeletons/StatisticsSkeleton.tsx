import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const paperShadow = { boxShadow: "var(--shadow-sm)" };

/** Four overview cards (Statistics summary row). */
export function StatisticsSummarySkeleton() {
  return (
    <section
      aria-hidden
      className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Card
          key={i}
          className="flex min-h-[5.5rem] min-w-0 flex-col justify-center border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
          style={paperShadow}
        >
          <div className="flex items-start gap-2">
            <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-2.5 w-24 rounded" />
              <Skeleton className="h-7 w-16 max-w-full rounded" />
            </div>
          </div>
        </Card>
      ))}
    </section>
  );
}

/** Bar rows matching genre / status / category / hours charts (fixed height to avoid layout shift). */
export function StatisticsBarsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="flex min-h-[12.5rem] min-w-0 flex-col justify-center gap-2 overflow-hidden"
      aria-hidden
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-3 w-14 shrink-0 rounded sm:w-20" />
          <Skeleton className="h-6 min-w-0 flex-1 rounded bg-[var(--color-darkest)]" />
          <Skeleton className="h-3 w-10 shrink-0 rounded sm:w-12" />
        </div>
      ))}
    </div>
  );
}

/** Stacked “by category over time” blocks (period label + nested rows). */
export function StatisticsCategoryOverTimeSkeleton() {
  return (
    <div className="flex min-h-[12.5rem] min-w-0 flex-col gap-4 overflow-hidden" aria-hidden>
      {Array.from({ length: 3 }).map((_, block) => (
        <div key={block} className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-3 w-20 rounded" />
          {Array.from({ length: 3 }).map((_, row) => (
            <div key={row} className="flex min-w-0 items-center gap-3 pl-0">
              <Skeleton className="h-3 w-20 max-w-[7rem] shrink-0 rounded" />
              <Skeleton className="h-5 min-w-0 flex-1 rounded bg-[var(--color-darkest)]" />
              <Skeleton className="h-3 w-8 shrink-0 rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatisticsRecentLogsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex min-w-0 flex-row overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)] shadow-[var(--shadow-card)]"
        >
          <Skeleton className="h-28 w-20 shrink-0 rounded-l-lg" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3">
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="h-4 w-full max-w-[14rem] rounded" />
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-full max-w-[11rem] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatisticsSkeleton() {
  return (
    <div className="relative flex min-w-0 flex-col gap-10 overflow-x-hidden">
      {/* First row: Calendar + By genre / status / category card */}
      <div className="grid min-w-0 grid-cols-1 gap-6 overflow-hidden md:grid-cols-2 md:gap-8">
        <section className="min-w-0 w-full overflow-hidden rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)]">
          <div className="border-b border-[var(--color-mid)]/30 px-4 py-3 flex items-center justify-between">
            <Skeleton className="h-4 w-24 rounded" />
            <div className="flex gap-1">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-7 p-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-6 rounded mx-0.5" />
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square min-h-[3rem] rounded-sm m-0.5" />
            ))}
          </div>
        </section>
        <Card className="min-w-0 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4" style={paperShadow}>
          <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-full max-w-[220px] rounded-md" />
            <div className="ml-1 flex gap-1">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-16 shrink-0 rounded" />
                <Skeleton className="h-6 flex-1 min-w-0 rounded" />
                <Skeleton className="h-3 w-8 shrink-0 rounded" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Second row: Time consumed (Stats) + Recent logs */}
      <div className="grid min-w-0 grid-cols-1 gap-10 overflow-hidden md:grid-cols-2 md:gap-10">
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg py-2 max-md:min-h-[44px] max-md:py-3 text-left"
            aria-disabled
          >
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </button>
          <Card className="min-w-0 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4" style={paperShadow}>
            <div className="flex flex-col gap-4">
              <div className="hidden md:flex flex-wrap gap-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-14 rounded-md" />
              </div>
              <div className="md:hidden w-full">
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-3 w-16 shrink-0 rounded" />
                    <Skeleton className="h-6 flex-1 min-w-0 rounded" />
                    <Skeleton className="h-3 w-12 shrink-0 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-4 w-28 rounded" />
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex min-w-0 gap-3 overflow-hidden rounded-md border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
              >
                <Skeleton className="h-12 w-9 shrink-0 rounded" />
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <Skeleton className="h-4 w-full max-w-[12rem] rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
