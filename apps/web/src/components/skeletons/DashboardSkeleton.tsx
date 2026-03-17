import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      {/* Category section: same rounded-xl border box as Dashboard */}
      <section
        aria-hidden
        className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]"
      >
        {/* Desktop: toggle group only (mobile uses StickyCategoryStrip below navbar) */}
        <div className="flex min-w-0 w-full shrink-0 justify-center overflow-hidden">
          <div className="hidden md:inline-flex flex-wrap justify-center gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-2 w-fit">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-md md:px-3 md:py-2" />
            ))}
          </div>
        </div>

        {/* Embedded MediaLogs: mobile 2 dropdowns, desktop filter row, then cards */}
        <div className="grid w-full grid-cols-2 gap-2 md:hidden">
          <Skeleton className="h-10 w-full rounded-md min-w-0" />
          <Skeleton className="h-10 w-full rounded-md min-w-0" />
        </div>
        <div className="hidden md:flex min-w-0 flex-wrap items-center gap-3">
          <Skeleton className="h-5 w-14 rounded" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-md" />
            ))}
          </div>
          <Skeleton className="ml-4 h-5 w-14 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex min-h-[140px] flex-row overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)] sm:min-h-[160px]"
            >
              <Skeleton className="h-full w-28 flex-shrink-0 rounded-l-lg sm:w-32" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
                <Skeleton className="h-4 w-full max-w-[10rem] rounded" />
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-3 w-12 rounded" />
                <Skeleton className="h-3 w-14 rounded" />
              </div>
              <div className="flex w-12 flex-shrink-0 flex-col justify-center gap-2 border-l border-[var(--color-surface-border)] p-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-9 w-9 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Social section */}
      <section className="flex min-w-0 flex-col gap-4 overflow-hidden" aria-hidden>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="h-5 w-5 shrink-0 rounded" />
            <Skeleton className="h-6 w-24 rounded" />
          </div>
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-dark)]/50 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex min-w-0 gap-3 overflow-hidden rounded-md border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
            >
              <Skeleton className="h-12 w-9 shrink-0 rounded" />
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <Skeleton className="h-4 w-full max-w-[12rem] rounded" />
                <Skeleton className="h-3 w-12 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
