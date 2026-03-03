import { Skeleton } from "@/components/ui/skeleton";

export function PublicProfileSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-8 w-48 rounded-md sm:h-9 sm:w-56" />
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      <section className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]">
        <div className="flex min-w-0 justify-center overflow-hidden">
          <div className="flex md:hidden min-w-0 gap-2 py-2 -mx-4 px-4 overflow-x-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 flex-shrink-0 rounded-full" />
            ))}
          </div>
          <div className="hidden md:flex flex-wrap justify-center gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-1 w-full max-w-2xl md:w-fit">
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
    </div>
  );
}
