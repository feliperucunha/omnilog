import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

export function segmentChipClass(pressed: boolean) {
  return cn(
    "shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-medium",
    pressed
      ? "border-[var(--color-lightest)] bg-[var(--color-lightest)] text-[var(--color-darkest)]"
      : "border-[var(--color-surface-border)] bg-[var(--color-dark)] text-[var(--color-light)]"
  );
}

/** List / Grid chips, the same control the dashboard uses for log cards. */
export function CardViewChips({
  value,
  onChange,
}: {
  value: "list" | "grid";
  onChange: (next: "list" | "grid") => void;
}) {
  const { t } = useLocale();
  return (
    <div className="flex shrink-0 gap-1.5" role="radiogroup" aria-label={t("mediaLogs.viewLabel")}>
      {(["list", "grid"] as const).map((mode) => {
        const selected = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(mode)}
            className={segmentChipClass(selected)}
          >
            {t(mode === "list" ? "mediaLogs.viewList" : "mediaLogs.viewGrid")}
          </button>
        );
      })}
    </div>
  );
}
