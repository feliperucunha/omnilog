import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function ItemPageSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-6 overflow-x-hidden lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,22rem)] lg:items-start lg:gap-8">
      <header className="relative min-h-[15.5rem] overflow-hidden rounded-2xl lg:col-span-full lg:grid lg:min-h-0 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <Skeleton className="absolute inset-0 rounded-2xl lg:static lg:aspect-[2/3] lg:h-auto lg:rounded-none" />
        <div className="relative z-10 flex min-h-[15.5rem] flex-col justify-between p-3.5 lg:min-h-0 lg:justify-center lg:p-6">
          <Skeleton className="h-9 w-24 rounded-[10px]" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-8 w-4/5 max-w-md rounded-md" />
            <Skeleton className="h-4 w-40 rounded" />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-1.5 lg:hidden">
        <Skeleton className="h-11 rounded-full" />
        <Skeleton className="h-11 rounded-full" />
        <Skeleton className="h-11 rounded-full" />
      </div>

      <Card className="min-w-0 border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-4 shadow-none sm:p-6">
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="mt-4 h-10 w-full rounded-md" />
        <Skeleton className="mt-3 h-24 w-full rounded-md" />
      </Card>

      <Card className="min-w-0 border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-5 shadow-none">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="mt-3 h-4 w-full rounded" />
        <Skeleton className="mt-2 h-4 w-4/5 rounded" />
        <Skeleton className="mt-4 h-16 w-full rounded" />
      </Card>
    </div>
  );
}
