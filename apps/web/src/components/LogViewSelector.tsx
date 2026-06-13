import { useId } from "react";
import { Columns3, LayoutGrid, Rows3 } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import type { LogViewMode } from "@/lib/logViewPreference";
import { cn } from "@/lib/utils";

const MODES: { value: LogViewMode; Icon: typeof Rows3; labelKey: string }[] = [
  { value: "list", Icon: Rows3, labelKey: "mediaLogs.viewList" },
  { value: "compact", Icon: LayoutGrid, labelKey: "mediaLogs.viewCompact" },
  { value: "grid", Icon: Columns3, labelKey: "mediaLogs.viewGrid" },
];

export function LogViewSelector({
  value,
  onValueChange,
  className,
}: {
  value: LogViewMode;
  onValueChange: (next: LogViewMode) => void;
  className?: string;
}) {
  const { t } = useLocale();
  const uid = useId();
  const labelId = `${uid}-log-view`;

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className={cn("flex h-11 max-md:min-h-[44px] shrink-0 items-center", className)}
    >
      <span id={labelId} className="sr-only">
        {t("mediaLogs.viewLabel")}
      </span>
      <div className="relative flex h-full w-full items-stretch rounded-full border border-[var(--color-mid)]/25 bg-[var(--color-mid)]/12 p-1 shadow-inner">
        {MODES.map(({ value: mode, Icon, labelKey }) => {
          const selected = value === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t(labelKey)}
              title={t(labelKey)}
              onClick={() => onValueChange(mode)}
              className={cn(
                "relative z-10 flex h-full min-w-9 flex-1 items-center justify-center rounded-full px-2 transition-colors duration-200 sm:min-w-10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-darkest)]",
                selected
                  ? "bg-[var(--color-mid)] text-[var(--color-darkest)] shadow-sm"
                  : "text-[var(--color-light)] hover:bg-[var(--color-mid)]/15"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={selected ? 2.25 : 1.75} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
