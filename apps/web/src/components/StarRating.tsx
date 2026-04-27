import { useState } from "react";
import { Star, X } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

const STAR_COUNT = 10;

/** 1–10 = filled stars, null = no selection (read-only: no rating). */
interface StarRatingProps {
  value: number | null;
  onChange?: (grade: number | null) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  "aria-required"?: boolean;
  /** When set, the clear control is not shown. */
  allowClear?: boolean;
  /** When true, shows `n/10` when a value is set. Default true. */
  showGradeText?: boolean;
}

const sizeClasses = {
  /** Compact for dense rows and small screens (10 stars). */
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

const starIndexWidth = (size: keyof typeof sizeClasses) =>
  size === "sm" ? 14 : size === "md" ? 20 : 24;

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
  className,
  "aria-required": ariaRequired,
  allowClear: allowClearProp,
  showGradeText = true,
}: StarRatingProps) {
  const { t } = useLocale();
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const allowClear = allowClearProp !== undefined ? allowClearProp : !readOnly;

  const displayN = (() => {
    if (readOnly) return value ?? 0;
    return hoverValue ?? value ?? 0;
  })();
  const clampedN = Math.max(0, Math.min(STAR_COUNT, displayN));

  const setRating = (n: number | null) => {
    if (readOnly) return;
    onChange?.(n);
  };

  const maxStr = String(STAR_COUNT);
  const clearLabel = t("starRating.clear");
  const readonlyLabel =
    value == null
      ? t("starRating.ariaNoRating")
      : t("starRating.ariaReadonly", { n: String(value), max: maxStr });

  return (
    <div
      className={cn(
        "inline-flex max-w-full min-w-0 flex-wrap items-center gap-px sm:gap-0.5",
        !readOnly && "select-none",
        className
      )}
    >
      <div
        role={readOnly ? "img" : "group"}
        aria-label={readOnly ? readonlyLabel : t("starRating.ariaGroup")}
        aria-required={readOnly ? undefined : ariaRequired}
        className="inline-flex min-w-0 max-w-full items-center gap-px sm:gap-0.5"
        onMouseLeave={readOnly ? undefined : () => setHoverValue(null)}
      >
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const n = i + 1;
          const filled = clampedN >= n;
          const w = starIndexWidth(size);
          if (readOnly) {
            return (
              <div
                key={i}
                className="relative inline-flex shrink-0"
                style={{ width: w }}
                aria-hidden
              >
                <Star
                  className={cn(
                    sizeClasses[size],
                    "fill-transparent",
                    "text-[var(--color-lightest)]"
                  )}
                  strokeWidth={1.5}
                />
                {filled && (
                  <div className="absolute inset-0 flex overflow-hidden">
                    <span className="h-full" style={{ width: w, flexShrink: 0 }}>
                      <Star
                        className={cn(sizeClasses[size], "text-amber-400 fill-amber-400")}
                        strokeWidth={1.5}
                      />
                    </span>
                  </div>
                )}
              </div>
            );
          }
          return (
            <button
              key={i}
              type="button"
              className={cn("relative -m-0.5 shrink-0 p-0.5", "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-mid)]")}
              onMouseEnter={() => setHoverValue(n)}
              onClick={() => setRating(n)}
              onKeyDown={(e) => {
                if (e.key === "Home") {
                  e.preventDefault();
                  setRating(1);
                  return;
                }
                if (e.key === "End") {
                  e.preventDefault();
                  setRating(STAR_COUNT);
                  return;
                }
                if (e.key === "Escape") setHoverValue(null);
              }}
              tabIndex={0}
              aria-label={t("starRating.setN", { n: String(n), max: maxStr })}
            >
              <span className="relative inline-flex" style={{ width: w }} aria-hidden>
                <Star
                  className={cn(
                    sizeClasses[size],
                    "fill-transparent",
                    "text-[var(--color-lightest)]"
                  )}
                  strokeWidth={1.5}
                />
                {filled && (
                  <div className="absolute inset-0 flex overflow-hidden">
                    <span className="h-full" style={{ width: w, flexShrink: 0 }}>
                      <Star
                        className={cn(sizeClasses[size], "text-amber-400 fill-amber-400")}
                        strokeWidth={1.5}
                      />
                    </span>
                  </div>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {showGradeText && value != null && value > 0 && (
        <span
          className={cn(
            "shrink-0 text-[var(--color-light)] tabular-nums",
            size === "sm" && "text-[11px] leading-tight",
            size === "md" && "text-sm",
            size === "lg" && "text-sm font-medium"
          )}
        >
          {t("starRating.outOf", { n: String(value), max: maxStr })}
        </span>
      )}
      {allowClear && !readOnly && value != null && onChange && (
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center gap-0.5 rounded p-0.5 text-xs text-[var(--color-mid)] hover:text-[var(--color-light)] focus-visible:outline focus-visible:ring-1 focus-visible:ring-[var(--color-mid)]"
          onClick={() => onChange(null)}
          aria-label={clearLabel}
          title={clearLabel}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </div>
  );
}
