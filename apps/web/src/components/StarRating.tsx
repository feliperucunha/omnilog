import { useRef, useState } from "react";
import { Star, X } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

const STAR_COUNT = 5;

interface StarRatingProps {
  value: number | null;
  onChange?: (stars: number | null) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  "aria-required"?: boolean;
  allowClear?: boolean;
  showGradeText?: boolean;
  fullWidth?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-7 w-7",
  xl: "h-10 w-10",
} as const;

const starIndexWidth = (size: keyof typeof sizeClasses) =>
  size === "sm"
    ? 16
    : size === "md"
      ? 24
      : size === "lg"
        ? 28
        : 40;

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
  className,
  "aria-required": ariaRequired,
  allowClear: allowClearProp,
  showGradeText = false,
  fullWidth = false,
}: StarRatingProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const allowClear = allowClearProp !== undefined ? allowClearProp : !readOnly;

  const displayN = (() => {
    if (readOnly) return value ?? 0;
    return hoverValue ?? value ?? 0;
  })();
  const clampedN = Math.max(0, Math.min(STAR_COUNT, displayN));

  const formatStars = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  const valueFromPointer = (clientX: number, clientY: number): number => {
    const container = containerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return 0;

    const topEl = document.elementFromPoint(clientX, clientY);
    const btn = topEl?.closest?.("[data-star-btn]");
    if (btn instanceof HTMLElement && container.contains(btn)) {
      const idxAttr = btn.dataset.starIndex;
      const i = idxAttr != null ? Number.parseInt(idxAttr, 10) : NaN;
      if (Number.isFinite(i) && i >= 0 && i < STAR_COUNT) {
        const br = btn.getBoundingClientRect();
        const x = Math.max(0, Math.min(br.width, clientX - br.left));
        const frac = br.width > 0 ? x / br.width : 0;
        const segment = frac <= 0.5 ? 0.5 : 1;
        return Math.min(STAR_COUNT, i + segment);
      }
    }

    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const segments = STAR_COUNT * 2;
    const idx = Math.floor((x / rect.width) * segments);
    const clampedIdx = Math.max(0, Math.min(segments - 1, idx));
    return (clampedIdx + 1) * 0.5;
  };

  const setRating = (n: number | null) => {
    if (readOnly) return;
    onChange?.(n);
  };

  const maxStr = String(STAR_COUNT);
  const clearLabel = t("starRating.clear");
  const readonlyLabel =
    value == null
      ? t("starRating.ariaNoRating")
      : t("starRating.ariaReadonly", { n: formatStars(value), max: maxStr });

  return (
    <div
      className={cn(
        "inline-flex max-w-full min-w-0 flex-wrap items-center gap-px sm:gap-0.5",
        !readOnly && "select-none",
        className
      )}
    >
      <div
        ref={containerRef}
        role={readOnly ? "img" : "group"}
        aria-label={readOnly ? readonlyLabel : t("starRating.ariaGroup")}
        aria-required={readOnly ? undefined : ariaRequired}
        className={cn(
          "inline-flex min-w-0 max-w-full items-center gap-1",
          fullWidth && !readOnly && "w-full gap-0"
        )}
        onMouseLeave={
          readOnly
            ? undefined
            : () => {
                if (!draggingRef.current) setHoverValue(null);
              }
        }
        onMouseMove={
          readOnly
            ? undefined
            : (e) => {
                if (draggingRef.current) return;
                const next = valueFromPointer(e.clientX, e.clientY);
                setHoverValue(next);
              }
        }
        onPointerDown={
          readOnly
            ? undefined
            : (e) => {
                draggingRef.current = true;
                const next = valueFromPointer(e.clientX, e.clientY);
                setHoverValue(next);
                setRating(next);
                e.currentTarget.setPointerCapture(e.pointerId);
              }
        }
        onPointerMove={
          readOnly
            ? undefined
            : (e) => {
                if (!draggingRef.current) return;
                const next = valueFromPointer(e.clientX, e.clientY);
                setHoverValue(next);
                setRating(next);
              }
        }
        onPointerUp={
          readOnly
            ? undefined
            : (e) => {
                if (!draggingRef.current) return;
                draggingRef.current = false;
                const next = valueFromPointer(e.clientX, e.clientY);
                setHoverValue(null);
                setRating(next);
              }
        }
        onPointerCancel={
          readOnly
            ? undefined
            : () => {
                draggingRef.current = false;
                setHoverValue(null);
              }
        }
      >
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const n = i + 1;
          const fill = Math.max(0, Math.min(1, clampedN - i));
          const w = starIndexWidth(size);
          if (readOnly) {
            return (
              <div
                key={i}
                className="relative inline-flex shrink-0 overflow-hidden rounded-sm"
                style={{ width: fullWidth ? undefined : w }}
                aria-hidden
              >
                <Star
                  className={cn(
                    sizeClasses[size],
                    "fill-transparent text-white/35"
                  )}
                  strokeWidth={1.5}
                />
                {fill > 0 && (
                  <div className="absolute inset-0 flex min-w-0 overflow-hidden">
                    <span
                      className="h-full min-w-0 overflow-hidden"
                      style={{ width: `${fill * 100}%`, flexShrink: 0 }}
                    >
                      <Star
                        className={cn(
                          sizeClasses[size],
                          "fill-amber-400 text-amber-300"
                        )}
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
              data-star-btn
              data-star-index={i}
              className={cn(
                "relative min-w-0 rounded-md p-1 transition-transform hover:scale-[1.03]",
                fullWidth ? "flex-1" : "shrink-0",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-mid)]"
              )}
              onKeyDown={(e) => {
                if (e.key === "Home") {
                  e.preventDefault();
                  setRating(0.5);
                  return;
                }
                if (e.key === "End") {
                  e.preventDefault();
                  setRating(STAR_COUNT);
                  return;
                }
                if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const next = Math.min(STAR_COUNT, (value ?? 0) + 0.5);
                  setRating(next <= 0 ? 0.5 : next);
                  return;
                }
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const next = Math.max(0.5, (value ?? STAR_COUNT) - 0.5);
                  setRating(next);
                  return;
                }
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  setRating(n);
                  return;
                }
                if (e.key === "Escape") setHoverValue(null);
              }}
              tabIndex={0}
              aria-label={t("starRating.setN", { n: formatStars(n), max: maxStr })}
            >
              <span
                className="relative inline-flex min-w-0 overflow-hidden rounded-sm"
                style={{ width: fullWidth ? undefined : w }}
                aria-hidden
              >
                <Star
                  className={cn(
                    sizeClasses[size],
                    "fill-transparent text-white/35"
                  )}
                  strokeWidth={1.5}
                />
                {fill > 0 && (
                  <div className="absolute inset-0 flex min-w-0 overflow-hidden">
                    <span
                      className="h-full min-w-0 overflow-hidden"
                      style={{ width: `${fill * 100}%`, flexShrink: 0 }}
                    >
                      <Star
                        className={cn(
                          sizeClasses[size],
                          "fill-amber-400 text-amber-300"
                        )}
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
            size === "lg" && "text-sm font-medium",
            size === "xl" && "text-base font-medium"
          )}
        >
          {t("starRating.outOf", { n: formatStars(value), max: maxStr })}
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
