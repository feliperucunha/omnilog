import { Skeleton } from "@/components/ui/skeleton";
import type { LogViewMode } from "@/lib/logViewPreference";
import {
  LOG_CARD_HEIGHT_EMBEDDED_COLLAPSED,
  LOG_CARD_HEIGHT_EMBEDDED_GRID_COLLAPSED,
  LOG_LIST_CARD_GRID,
  LOG_LIST_CARD_GRID_DENSE,
  LOG_LIST_CARD_GRID_MULTI,
} from "@/lib/logCardLayout";

export function MediaLogsListSkeleton({
  count = 6,
  view = "list",
}: {
  count?: number;
  view?: LogViewMode;
}) {
  if (view === "compact") {
    return (
      <div className={LOG_LIST_CARD_GRID_DENSE} aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)]"
          >
            <Skeleton className="aspect-[2/3] w-full rounded-none" />
            <div className="flex flex-col gap-1.5 p-2">
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-2.5 w-3/4 rounded" />
              <Skeleton className="h-2.5 w-1/2 rounded" />
            </div>
            <div className="flex justify-end gap-1 border-t border-[var(--color-surface-border)] p-1.5">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const gridClass = view === "grid" ? LOG_LIST_CARD_GRID_MULTI : LOG_LIST_CARD_GRID;
  const cardHeight =
    view === "grid" ? LOG_CARD_HEIGHT_EMBEDDED_GRID_COLLAPSED : LOG_CARD_HEIGHT_EMBEDDED_COLLAPSED;
  const imageWidth = view === "grid" ? "w-[4.75rem] sm:w-[5.25rem] md:w-10" : "w-28 sm:w-[6.4rem]";

  return (
    <div className={gridClass} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`flex flex-row overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)] ${cardHeight}`}
        >
          <Skeleton className={`h-full ${imageWidth} flex-shrink-0 rounded-l-lg`} />
          <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:gap-1.5 sm:p-3">
            <Skeleton className="h-4 w-full max-w-[10rem] rounded" />
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
          </div>
          <div className="flex w-12 flex-shrink-0 flex-col justify-center gap-2 border-l border-[var(--color-surface-border)] p-2 sm:gap-1.5 sm:p-1.5">
            <Skeleton className="h-9 w-9 rounded-full sm:h-8 sm:w-8" />
            <Skeleton className="h-9 w-9 rounded-full sm:h-8 sm:w-8" />
          </div>
        </div>
      ))}
    </div>
  );
}
