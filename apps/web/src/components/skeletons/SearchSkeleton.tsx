import { Skeleton } from "@/components/ui/skeleton";
import { SEARCH_RESULT_CARD_GRID, SEARCH_RESULT_CARD_IMAGE } from "@/lib/logCardLayout";

export function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Results grid: mobile = row cards (poster left), desktop = column cards (poster top) - same as Search result cards */}
      <div className={SEARCH_RESULT_CARD_GRID}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-row sm:flex-col gap-3 sm:gap-0 overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)] min-h-0"
          >
            <Skeleton className={SEARCH_RESULT_CARD_IMAGE} />
            <div className="flex w-full flex-1 min-w-0 flex-col justify-center gap-1 p-3 sm:justify-start sm:gap-1 sm:min-h-[4.4rem] sm:p-2.5 sm:pt-2">
              <Skeleton className="h-3 w-12 rounded sm:w-14" />
              <Skeleton className="h-4 w-full max-w-[10rem] rounded sm:max-w-none" />
              <Skeleton className="h-3 w-14 rounded" />
              <Skeleton className="h-3.5 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
