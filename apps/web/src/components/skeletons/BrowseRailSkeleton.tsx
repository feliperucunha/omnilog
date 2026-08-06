import { Skeleton } from "@/components/ui/skeleton";

/** Skeletons for one Netflix-style carousel rail: title line + horizontal row of poster cards. */
export function BrowseRailSkeleton({
  titleWidth = "w-40",
  cardCount = 6,
}: {
  titleWidth?: string;
  cardCount?: number;
}) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className={`h-4 ${titleWidth} rounded`} />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: cardCount }, (_, i) => (
          <div key={i} className="w-[9.5rem] shrink-0 sm:w-[8.8rem]">
            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-dark)]">
              <Skeleton className="aspect-[2/3] w-full rounded-none" />
              <div className="flex flex-col gap-1.5 p-2.5 sm:p-2">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-2.5 w-2/3 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A page of stacked browse rails for the empty search state. */
export function BrowseRailsSkeleton({
  railCount = 4,
  cardCount = 6,
}: {
  railCount?: number;
  cardCount?: number;
}) {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {Array.from({ length: railCount }, (_, i) => (
        <BrowseRailSkeleton key={i} cardCount={cardCount} />
      ))}
    </div>
  );
}
