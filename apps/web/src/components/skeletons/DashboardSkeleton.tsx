import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      {/* Title + Share */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md sm:h-8 sm:w-24" />
      </div>

      {/* Category: Mobile = horizontal scroll pills, Desktop = toggle group in box */}
      <div className="flex min-w-0 justify-center overflow-hidden">
        <div className="flex md:hidden min-w-0 gap-2 py-2 -mx-4 px-4 overflow-x-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 flex-shrink-0 rounded-full" />
          ))}
        </div>
        <div className="hidden md:flex flex-wrap justify-center gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-1 w-full max-w-2xl md:w-fit">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-md" />
          ))}
        </div>
      </div>

      {/* Embedded MediaLogs: filter row + cards */}
      <section className="flex min-w-0 flex-col gap-4 overflow-hidden">
        {/* Mobile: 2 dropdowns in grid */}
        <div className="grid w-full grid-cols-2 gap-2 md:hidden">
          <Skeleton className="h-10 w-full rounded-md min-w-0" />
          <Skeleton className="h-10 w-full rounded-md min-w-0" />
        </div>
        {/* Desktop: label + buttons + label + buttons */}
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
              className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--color-dark)] bg-[var(--color-dark)] sm:min-h-[8.5rem]"
            >
              <div className="flex gap-3 p-3 flex-1 min-h-0 sm:gap-4 sm:p-4">
                <Skeleton className="h-16 w-11 shrink-0 rounded-lg sm:h-20 sm:w-14" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-full max-w-[10rem] rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-3 w-14 rounded" />
                </div>
              </div>
              <div className="flex border-t border-[var(--color-darkest)]">
                <Skeleton className="h-9 flex-1 rounded-none" />
                <Skeleton className="h-9 flex-1 rounded-none" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Two-column: Stats | Recent logs */}
      <div className="grid min-w-0 grid-cols-1 gap-8 overflow-hidden md:grid-cols-2">
        {/* Stats */}
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <Skeleton className="h-5 w-40 rounded" />
          {/* Mobile: single dropdown */}
          <div className="md:hidden w-full min-w-0">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          {/* Desktop: 3 buttons */}
          <div className="hidden md:flex flex-wrap gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          <div className="rounded-md border border-[var(--color-dark)] bg-[var(--color-dark)] p-4">
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-3 w-20 shrink-0 rounded" />
                  <Skeleton className="h-6 flex-1 min-w-0 rounded" />
                  <Skeleton className="h-3 w-12 shrink-0 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent logs */}
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <Skeleton className="h-5 w-28 rounded" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex min-w-0 gap-3 overflow-hidden rounded-md border border-[var(--color-dark)] bg-[var(--color-dark)] p-4"
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
