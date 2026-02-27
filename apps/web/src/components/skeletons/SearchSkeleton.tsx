import { Skeleton } from "@/components/ui/skeleton";

export function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Results grid: mobile = row cards (small poster left), desktop = column cards (poster top) */}
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-row sm:flex-col gap-3 sm:gap-0 overflow-hidden rounded-lg border border-[var(--color-dark)] bg-[var(--color-dark)] min-h-0"
          >
            <Skeleton
              className="w-20 h-28 flex-shrink-0 rounded-l-lg sm:w-full sm:h-auto sm:aspect-[2/3] sm:rounded-l-none sm:rounded-t-lg"
            />
            <div className="flex flex-1 min-w-0 flex-col justify-center gap-1 p-3 sm:justify-start sm:gap-1 sm:h-[5.5rem] sm:min-h-[5.5rem] sm:p-4 sm:pt-3">
              <Skeleton className="h-3 w-12 rounded sm:w-14" />
              <Skeleton className="h-4 w-full max-w-[10rem] rounded sm:max-w-none" />
              <Skeleton className="h-3.5 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
