import { Skeleton } from "@/components/ui/skeleton";

export function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-28 rounded-md" />
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col h-full min-h-0">
            <Skeleton
              className="rounded-md flex-shrink-0"
              style={{ aspectRatio: "2/3" }}
            />
            <div className="flex flex-col gap-2 flex-shrink-0 h-[5.5rem] min-h-[5.5rem] pt-3">
              <Skeleton className="h-3 w-[80%] rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-3.5 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
