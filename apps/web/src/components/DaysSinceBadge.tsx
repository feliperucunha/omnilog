import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

function daysSince(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - d.getTime()) / 86_400_000);
}

export function formatDaysSinceLabel(days: number, t: (key: string, params?: Record<string, string>) => string): string {
  if (days <= 0) return t("mediaLogs.daysAgoToday");
  if (days === 1) return t("mediaLogs.daysAgoDay");
  return t("mediaLogs.daysAgo", { count: String(days) });
}

export function DaysSinceBadge({
  updatedAt,
  className,
}: {
  updatedAt: string;
  className?: string;
}) {
  const { t } = useLocale();
  const days = daysSince(updatedAt);
  if (days == null) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-mid)]/20 px-1.5 py-px text-[8px] font-medium text-[var(--color-lightest)] whitespace-nowrap sm:text-[9px]",
        className
      )}
      title={new Date(updatedAt).toLocaleDateString()}
    >
      {formatDaysSinceLabel(days, t)}
    </span>
  );
}
