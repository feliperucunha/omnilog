import { Skeleton } from "@/components/ui/skeleton";

export function MediaLogsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-md">
            <div className="border-b border-[var(--color-darkest)]" />
            <div className="flex gap-4 p-4">
              <Skeleton className="h-20 w-14 rounded-md" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3.5 w-10 rounded" />
                <Skeleton className="h-3.5 w-full rounded" />
              </div>
            </div>
            <div className="flex">
              <Skeleton className="h-9 flex-1 rounded-none" />
              <Skeleton className="h-9 flex-1 rounded-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
