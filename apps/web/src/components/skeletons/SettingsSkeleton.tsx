import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function SettingsSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-8 overflow-hidden">
      <Skeleton className="h-9 w-32 rounded-md" />

      <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-4 w-full max-w-md rounded" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </Card>

      <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-4 w-full max-w-sm rounded" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-16 rounded-md" />
            ))}
          </div>
        </div>
      </Card>

      <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-28 rounded" />
          <Skeleton className="h-4 w-full max-w-xs rounded" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </Card>

      <Card className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-44 rounded" />
          <Skeleton className="h-4 w-full max-w-md rounded" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </Card>

      <div className="rounded-md border border-[var(--color-dark)] bg-[var(--color-dark)] shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 px-4 py-3">
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <Skeleton className="h-5 w-24 rounded" />
        </div>
      </div>
    </div>
  );
}
