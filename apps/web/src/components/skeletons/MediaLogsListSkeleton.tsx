import { Skeleton } from "@/components/ui/skeleton";
import { LOG_CARD_HEIGHT_EMBEDDED_COLLAPSED, LOG_LIST_CARD_GRID } from "@/lib/logCardLayout";

export function MediaLogsListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={LOG_LIST_CARD_GRID} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`flex flex-row overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)] ${LOG_CARD_HEIGHT_EMBEDDED_COLLAPSED}`}
        >
          <Skeleton className="h-full w-28 flex-shrink-0 rounded-l-lg sm:w-[6.4rem]" />
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
