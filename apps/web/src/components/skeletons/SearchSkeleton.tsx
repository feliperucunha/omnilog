import { Skeleton } from "@/components/ui/skeleton";
import type { LogViewMode } from "@/lib/logViewPreference";
import {
  SEARCH_RESULT_CARD_GRID,
  SEARCH_RESULT_CARD_GRID_COMPACT,
  SEARCH_RESULT_CARD_GRID_MULTI,
  SEARCH_RESULT_CARD_IMAGE,
  SEARCH_RESULT_CARD_IMAGE_COMPACT,
  SEARCH_RESULT_CARD_IMAGE_GRID,
} from "@/lib/logCardLayout";

export function SearchSkeleton({ view = "list" }: { view?: LogViewMode }) {
  const gridClass =
    view === "compact"
      ? SEARCH_RESULT_CARD_GRID_COMPACT
      : view === "grid"
        ? SEARCH_RESULT_CARD_GRID_MULTI
        : SEARCH_RESULT_CARD_GRID;

  if (view === "compact") {
    return (
      <div className="flex flex-col gap-4 min-w-0">
        <div className={gridClass}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)]"
            >
              <Skeleton className={SEARCH_RESULT_CARD_IMAGE_COMPACT} />
              <div className="flex flex-col gap-1.5 p-2">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-2.5 w-3/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const imageClass = view === "grid" ? SEARCH_RESULT_CARD_IMAGE_GRID : SEARCH_RESULT_CARD_IMAGE;
  const cardLayout = view === "grid" ? "flex-row" : "flex-row sm:flex-col";

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className={gridClass}>
        {Array.from({ length: view === "grid" ? 10 : 8 }).map((_, i) => (
          <div
            key={i}
            className={`flex ${cardLayout} gap-3 sm:gap-0 overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)] min-h-0`}
          >
            <Skeleton className={imageClass} />
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
