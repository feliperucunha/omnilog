import { Skeleton } from "@/components/ui/skeleton";

export function MediaLogsSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-6 overflow-hidden">
      {/* Header: title + Add custom entry + Export */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 overflow-hidden">
        <Skeleton className="h-8 w-36 rounded-md min-w-0 sm:h-9 sm:w-44" />
        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </div>

      {/* Mobile: 2 or 3 dropdowns in grid */}
      <div className="grid w-full grid-cols-2 gap-2 md:hidden">
        <Skeleton className="h-10 w-full rounded-md min-w-0" />
        <Skeleton className="h-10 w-full rounded-md min-w-0" />
      </div>
      {/* Desktop: status label + buttons + sort label + select */}
      <div className="hidden md:flex min-w-0 flex-wrap items-center gap-3">
        <Skeleton className="h-5 w-16 rounded" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="ml-4 h-5 w-14 rounded" />
        <Skeleton className="h-9 w-[11rem] rounded-md" />
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
    </div>
  );
}
