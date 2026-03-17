import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function TiersSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 pb-24 md:pb-20">
      <div className="text-center">
        <Skeleton className="mx-auto mt-2 h-4 w-64 rounded md:w-80" />
      </div>

      {/* Current plan card (when logged in) */}
      <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 shadow-[var(--shadow-md)]">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
        <Skeleton className="mt-2 h-4 w-40 rounded" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-40 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Free tier card */}
        <Card
          className="relative flex flex-col border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-card)]"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <Skeleton className="h-6 w-24 rounded" />
          <Skeleton className="mt-1 h-8 w-16 rounded" />
          <ul className="mt-4 flex flex-1 flex-col gap-2">
            {[1, 2].map((i) => (
              <li key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <Skeleton className="h-4 w-40 rounded" />
              </li>
            ))}
          </ul>
        </Card>

        {/* Pro tier card */}
        <Card
          className="relative flex flex-col border-[var(--color-mid)]/50 bg-[var(--color-dark)] p-6"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <Skeleton className="absolute right-4 top-[-0.5rem] h-5 w-14 rounded-full" />
          <Skeleton className="h-6 w-16 rounded" />
          <Skeleton className="mt-2 h-8 w-24 rounded" />
          <div className="mt-2 flex gap-1">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 flex-1 rounded-md" />
          </div>
          <ul className="mt-4 flex flex-1 flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <Skeleton className="h-4 w-36 rounded" />
              </li>
            ))}
          </ul>
          <Skeleton className="mt-4 h-10 w-full rounded-md" />
        </Card>
      </div>
    </div>
  );
}
