import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

export function BookPagesBadge({
  pagesCount,
  className,
}: {
  pagesCount: number | null | undefined;
  className?: string;
}) {
  const { t } = useLocale();
  if (typeof pagesCount !== "number" || pagesCount <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-mid)]/20 px-2 py-0.5 text-[10px] font-medium text-[var(--color-lightest)] whitespace-nowrap",
        className
      )}
    >
      {t("mediaLogs.bookPagesBadge", { count: String(pagesCount) })}
    </span>
  );
}
