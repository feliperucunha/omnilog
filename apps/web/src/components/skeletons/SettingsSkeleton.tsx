import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function SettingsSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-hidden">
      {/* General card */}
      <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
        <Skeleton className="h-5 w-24 rounded mb-1" />
        <Skeleton className="h-4 w-full max-w-md rounded mb-5" />
        <div className="divide-y divide-[var(--color-mid)]/20">
          <div className="flex flex-col gap-2 py-4 first:pt-0">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-4 w-full max-w-xs rounded" />
          </div>
          <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
          <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
          <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 last:pb-0">
            <div className="min-w-0">
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="mt-1 h-3 w-full max-w-sm rounded" />
            </div>
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
          </div>
        </div>
      </Card>

      {/* Public profile customization */}
      <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-52 rounded" />
          <Skeleton className="h-4 w-full max-w-md rounded" />
          <Skeleton className="h-4 w-full max-w-lg rounded" />
          <ul className="flex flex-col gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 rounded-md px-2 py-2">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Export logs */}
      <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-28 rounded" />
          <Skeleton className="h-4 w-full max-w-sm rounded" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </Card>

      {/* Board game provider */}
      <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-44 rounded" />
          <Skeleton className="h-4 w-full max-w-md rounded" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </Card>

      {/* API keys collapsible */}
      <div className="rounded-md border border-[var(--color-surface-border)] bg-[var(--color-dark)] shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 px-4 py-3 max-md:min-h-[44px]">
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <Skeleton className="h-5 w-24 rounded" />
        </div>
      </div>
    </div>
  );
}
