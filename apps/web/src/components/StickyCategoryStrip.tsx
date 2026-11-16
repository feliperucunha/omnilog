import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface StickyCategoryStripItem {
  value: string;
  label: string;
  /** Optional count shown after label, e.g. "(12)" */
  count?: number;
  disabled?: boolean;
  /** e.g. native tooltip when disabled */
  title?: string;
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
  /** When true, omit outer border and background (e.g. when wrapped in a sticky container that has them). */
  bare?: boolean;
  "aria-label"?: string;
  className?: string;
}

const SCROLL_PAD_PX = 16;

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
  stickyTop = "top-0",
  bare = false,
  "aria-label": ariaLabel,
  className,
}: StickyCategoryStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const itemsKey = items.map((i) => `${i.value}:${i.count ?? ""}`).join("|");

  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = selectedRef.current;
    if (!scroller || !el) return;
    const left = el.offsetLeft - SCROLL_PAD_PX;
    const right = el.offsetLeft + el.offsetWidth + SCROLL_PAD_PX;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    if (left < viewLeft) {
      scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    } else if (right > viewRight) {
      scroller.scrollTo({ left: Math.max(0, right - scroller.clientWidth), behavior: "smooth" });
    }
  }, [selectedValue, itemsKey]);

  const strip = (
    <div
      className={cn(
        "flex min-w-0 w-full shrink-0",
        !bare && "pb-2",
        stickyTop && `sticky z-20 h-fit w-full self-start ${stickyTop}`,
        mobileOnly && "md:hidden",
        className
      )}
    >
      <div
        ref={scrollerRef}
        className="scrollbar-hide flex min-w-0 gap-1.5 overflow-x-auto overflow-y-hidden scroll-smooth py-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [touch-action:pan-x]"
        role="tablist"
        aria-label={ariaLabel}
      >
        {items.map((item) => {
          const selected = selectedValue === item.value;
          return (
            <button
              key={item.value}
              ref={selected ? selectedRef : undefined}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-pressed={selected}
              disabled={item.disabled}
              title={item.title}
              onClick={() => !item.disabled && onSelect(item.value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-2 text-[13px] font-medium whitespace-nowrap max-md:min-h-9",
                item.disabled && "cursor-not-allowed opacity-50",
                selected
                  ? "border-[var(--color-lightest)] bg-[var(--color-lightest)] text-[var(--color-darkest)]"
                  : "border-[var(--color-surface-border)] bg-[var(--color-dark)] text-[var(--color-light)] hover:text-[var(--color-lightest)]"
              )}
            >
              {item.label}
              {showCount && item.count != null ? (
                <span className="tabular-nums"> · {item.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  return strip;
}
