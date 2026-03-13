import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const paperShadow = { boxShadow: "var(--shadow-sm)" };

export function StatisticsSkeleton() {
  return (
    <div className="relative flex min-w-0 flex-col gap-10 overflow-x-hidden">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-8 w-36 rounded-md sm:h-9 sm:w-40" />
        <Skeleton className="h-9 w-28 rounded-md shrink-0" />
      </div>

      <div className="flex flex-col gap-12">
      {/* First row: Calendar + By genre */}
      <div className="grid min-w-0 grid-cols-1 gap-6 overflow-hidden md:grid-cols-2 md:gap-8">
        <section className="min-w-0 w-full overflow-hidden rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)]">
          <div className="border-b border-[var(--color-mid)]/30 px-4 py-3 flex items-center justify-between">
            <Skeleton className="h-4 w-24 rounded" />
            <div className="flex gap-1">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-7 p-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-6 rounded mx-0.5" />
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square min-h-[3rem] rounded-sm m-0.5" />
            ))}
          </div>
        </section>
        <Card className="min-w-0 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4" style={paperShadow}>
          <Skeleton className="h-4 w-20 rounded mb-3" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-16 shrink-0 rounded" />
                <Skeleton className="h-6 flex-1 min-w-0 rounded" />
                <Skeleton className="h-3 w-8 shrink-0 rounded" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Second row: Time consumed + Recent logs */}
      <div className="grid min-w-0 grid-cols-1 gap-10 overflow-hidden md:grid-cols-2 md:gap-10">
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
          <Card className="min-w-0 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4" style={paperShadow}>
            <div className="flex flex-col gap-4">
              <div className="hidden md:flex flex-wrap gap-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-14 rounded-md" />
              </div>
              <div className="md:hidden w-full">
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-3 w-16 shrink-0 rounded" />
                    <Skeleton className="h-6 flex-1 min-w-0 rounded" />
                    <Skeleton className="h-3 w-12 shrink-0 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-4 w-28 rounded" />
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex min-w-0 gap-3 overflow-hidden rounded-md border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
              >
                <Skeleton className="h-12 w-9 shrink-0 rounded" />
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <Skeleton className="h-4 w-full max-w-[12rem] rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
