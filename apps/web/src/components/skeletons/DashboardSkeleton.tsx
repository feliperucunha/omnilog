import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      {/* Title */}
      <Skeleton className="h-8 w-32 rounded-md" />

      {/* Category toggle */}
      <div className="flex justify-center">
        <div className="flex w-full max-w-2xl flex-wrap justify-center gap-2 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-2 md:w-fit md:gap-1 md:p-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-20 rounded-md md:h-8 md:w-16" />
          ))}
        </div>
      </div>

      {/* Embedded MediaLogs section: filter row + grid of cards */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-5 w-16 rounded" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-md" />
            ))}
          </div>
          <Skeleton className="ml-2 h-5 w-14 rounded md:ml-4" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-lg border border-[var(--color-dark)] bg-[var(--color-dark)] p-3 sm:gap-4 sm:p-4"
            >
              <Skeleton className="h-16 w-11 shrink-0 rounded-lg sm:h-20 sm:w-14" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-full max-w-[10rem] rounded" />
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="mt-1 h-3 w-14 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats section */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-28 rounded" />
        <div className="flex gap-2">
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

      {/* Recent logs section */}
      <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
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
              <Skeleton className="h-5 w-5 shrink-0 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
