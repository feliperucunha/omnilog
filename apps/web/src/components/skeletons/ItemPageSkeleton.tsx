import { Skeleton } from "@/components/ui/skeleton";

export function ItemPageSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start gap-6">
        <Skeleton className="h-64 w-44 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-14 rounded" />
          <Skeleton className="h-8 w-4/5 rounded-md" />
          <Skeleton className="h-4 w-1/2 rounded" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-9 w-12 rounded-md" />
            <Skeleton className="h-5 w-8 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
        </div>
      </div>
      <Skeleton className="h-28 rounded-md" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-24 rounded-md" />
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
