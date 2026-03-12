import { cn } from "@/lib/utils";

export interface StickyCategoryStripItem {
  value: string;
  label: string;
  /** Optional count shown after label, e.g. "(12)" */
  count?: number;
  disabled?: boolean;
}

interface StickyCategoryStripProps {
  items: StickyCategoryStripItem[];
  selectedValue: string;
  onSelect: (value: string) => void;
  /** Show count in label when item has count. Default true when any item has count. */
  showCount?: boolean;
  /** Only render the sticky strip on mobile (md:hidden). Desktop slot can be rendered by parent. */
  mobileOnly?: boolean;
  /** Sticky offset from top (e.g. "top-14" to sit below navbar). Omit for non-sticky or top-0. */
  stickyTop?: string;
  "aria-label"?: string;
  className?: string;
}

/**
 * Sticky, horizontally scrollable category strip for mobile (app-store style).
 * No pills or buttons – text tabs with underline for selected. Slides horizontally.
 */
export function StickyCategoryStrip({
  items,
  selectedValue,
  onSelect,
  showCount = items.some((i) => i.count != null),
  mobileOnly = true,
  stickyTop = "top-14",
  "aria-label": ariaLabel,
  className,
}: StickyCategoryStripProps) {
  const strip = (
    <div
      className={cn(
        "flex shrink-0 border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)]",
        stickyTop && `sticky z-20 ${stickyTop}`,
        mobileOnly && "md:hidden",
        className
      )}
    >
      {/* Scrollable row – edge-to-edge, no horizontal padding */}
      <div
        className="scrollbar-hide flex min-w-0 overflow-x-auto overflow-y-hidden scroll-smooth py-2.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [touch-action:pan-x]"
        role="tablist"
        aria-label={ariaLabel}
      >
        <div className="flex min-w-max gap-6 pl-3 pr-3">
          {items.map((item) => {
            const selected = selectedValue === item.value;
            const label = showCount && item.count != null ? `${item.label} (${item.count})` : item.label;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={item.disabled}
                onClick={() => !item.disabled && onSelect(item.value)}
                className={cn(
                  "flex shrink-0 flex-col items-center justify-center gap-1 border-b-2 pb-0.5 pt-0.5 text-sm transition-colors max-md:min-h-[44px]",
                  "border-transparent whitespace-nowrap",
                  item.disabled && "cursor-not-allowed opacity-50",
                  selected
                    ? "border-[var(--btn-gradient-end)] font-semibold text-[var(--color-lightest)] dark:border-[var(--btn-gradient-start)]"
                    : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return strip;
}
