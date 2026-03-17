import { Skeleton } from "@/components/ui/skeleton";

export function PublicProfileSkeleton() {
  return (
    <>
      {/* Category strip at top, full-bleed (same as PublicProfile) */}
      <div className="shrink-0 border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)]">
        <div className="flex min-w-0 gap-6 pl-3 pr-3 py-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-16 shrink-0 rounded" />
          ))}
        </div>
      </div>

      {/* Padded content: profile header, badges, section with MediaLogs */}
      <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden px-4 md:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
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

        {/* Optional badges section */}
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

        {/* MediaLogs section: toolbar (filters + search, no bar/buttons) + cards */}
        <section
          aria-hidden
          className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]"
        >
          {/* Desktop: filters + search row */}
          <div className="hidden md:flex flex-col gap-3 min-w-0">
            <div className="flex justify-between items-center gap-4 flex-wrap">
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
          </div>
          {/* Mobile: filters grid + search */}
          <div className="flex min-w-0 flex-col gap-3 md:hidden">
            <div className="grid w-full grid-cols-2 gap-2">
              <Skeleton className="h-10 w-full rounded-md min-w-0" />
              <Skeleton className="h-10 w-full rounded-md min-w-0" />
              <Skeleton className="h-10 w-full rounded-md min-w-0 col-span-2" />
            </div>
            <div className="relative min-w-0 max-w-xs">
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex h-[193px] min-h-[193px] max-h-[193px] flex-row overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)]"
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
    </>
  );
}
