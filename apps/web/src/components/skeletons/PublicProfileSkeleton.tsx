import { Skeleton } from "@/components/ui/skeleton";

export function PublicProfileSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      {/* Header: title + optional badges + buttons */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-8 w-48 rounded-md sm:h-9 sm:w-56" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Optional badges section placeholder */}
      <section
        aria-hidden
        className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]"
      >
        <Skeleton className="h-6 w-40 rounded" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </section>

      {/* Category + MediaLogs section */}
      <section
        aria-hidden
        className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]"
      >
        <div className="flex min-w-0 w-full shrink-0 justify-center overflow-hidden">
          <div className="scrollbar-hide flex md:hidden min-w-0 gap-2 py-1 overflow-x-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 flex-shrink-0 rounded-full" />
            ))}
          </div>
          <div className="hidden md:inline-flex flex-wrap justify-center gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-2 w-fit">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-16 rounded-md" />
            ))}
          </div>
        </div>

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
    </div>
  );
}
