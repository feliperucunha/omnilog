import { Skeleton } from "@/components/ui/skeleton";
import { LOG_CARD_HEIGHT_EMBEDDED_COLLAPSED, LOG_LIST_CARD_GRID } from "@/lib/logCardLayout";

export function DashboardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      <section
        aria-hidden
        className="flex min-w-0 flex-col gap-4 overflow-hidden max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none md:rounded-xl md:border md:border-[var(--color-category-border)] md:bg-[var(--color-category-bg)] md:p-4 md:shadow-[var(--shadow-category)]"
      >
        <div className="hidden min-w-0 flex-col gap-3 md:flex">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <Skeleton className="h-5 w-14 rounded" />
              <Skeleton className="h-9 w-[11rem] rounded-md" />
              <Skeleton className="h-5 w-14 rounded ml-2 md:ml-4" />
              <Skeleton className="h-9 w-[11rem] rounded-md" />
            </div>
            <div className="relative min-w-0 w-full max-w-xs shrink-0">
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 max-w-[400px]">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-2 min-w-[120px] flex-1 rounded-full max-w-[200px]" />
              <Skeleton className="h-3 w-10 rounded" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="h-9 w-36 rounded-md" />
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 md:hidden">
          <div className="grid w-full grid-cols-2 gap-2">
            <Skeleton className="h-10 w-full rounded-md min-w-0" />
            <Skeleton className="h-10 w-full rounded-md min-w-0" />
            <Skeleton className="h-10 w-full rounded-md min-w-0 col-span-2" />
          </div>
          <div className="flex min-w-0 flex-nowrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <Skeleton className="h-1 min-w-[32px] flex-1 max-w-[90px] rounded-full" />
              <Skeleton className="h-3 w-8 rounded shrink-0" />
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
          <div className="relative min-w-0 w-full">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>

        <div className={LOG_LIST_CARD_GRID}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`flex flex-row overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)] ${LOG_CARD_HEIGHT_EMBEDDED_COLLAPSED}`}
            >
              <Skeleton className="h-full w-28 flex-shrink-0 rounded-l-lg sm:w-[6.4rem]" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:gap-1.5 sm:p-3">
                <Skeleton className="h-4 w-full max-w-[10rem] rounded" />
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-3 w-12 rounded" />
                <Skeleton className="h-3 w-14 rounded" />
              </div>
              <div className="flex w-12 flex-shrink-0 flex-col justify-center gap-2 border-l border-[var(--color-surface-border)] p-2 sm:gap-1.5 sm:p-1.5">
                <Skeleton className="h-9 w-9 rounded-full sm:h-8 sm:w-8" />
                <Skeleton className="h-9 w-9 rounded-full sm:h-8 sm:w-8" />
              </div>
            </div>
          ))}
        </div>
      </section>

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
