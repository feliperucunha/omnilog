import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const paperShadow = { boxShadow: "var(--shadow-sm)" };

export function ItemPageSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden">
      {/* Hero header: same min-height and rounded-xl as ItemPageContent */}
      <header className="relative min-h-[min(38vh,280px)] w-full overflow-hidden rounded-xl sm:min-h-[min(42vh,360px)]">
        <Skeleton className="absolute inset-0 rounded-xl" />
        {/* Back button area */}
        <div className="absolute left-0 top-0 z-10 p-2 sm:p-3">
          <Skeleton className="h-9 w-24 rounded-full md:min-w-[44px]" />
        </div>
        {/* Title and meta at bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-1.5 p-4 pb-6 sm:p-6 sm:pb-8">
          <Skeleton className="h-3.5 w-14 rounded" />
          <Skeleton className="h-7 w-4/5 rounded-md sm:h-8 max-w-md" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
      </header>

      {/* Details card */}
      <Card
        className="min-w-0 border-[var(--color-surface-border)] bg-[var(--color-dark)] p-5 sm:p-6 flex flex-col gap-5 overflow-hidden"
        style={paperShadow}
      >
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-4 w-full max-w-2xl rounded" />
        <Skeleton className="h-4 w-full max-w-xl rounded" />
        <Skeleton className="h-20 w-full rounded" />
      </Card>

      {/* Review form / login card area */}
      <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4" style={paperShadow}>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-20 rounded-md" />
        </div>
      </Card>

      {/* Reviews section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-9 w-[10rem] rounded-md" />
        </div>
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <Card
              key={i}
              className="overflow-hidden border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-0"
              style={paperShadow}
            >
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-5 w-28 rounded" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full max-w-md rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
