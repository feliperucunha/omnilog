import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const R = 10;
const CIRC = 2 * Math.PI * R;

type PullToRefreshIndicatorProps = {
  /** Raw downward finger delta in px while pulling. */
  pullRawDy: number;
  /** Release at or past this delta triggers refresh (for ring fill). */
  thresholdPx: number;
  isRefreshing: boolean;
  className?: string;
};

/**
 * Native pull-to-refresh affordance: ring fills while pulling, spinner while refresh runs.
 */
export function PullToRefreshIndicator({
  pullRawDy,
  thresholdPx,
  isRefreshing,
  className,
}: PullToRefreshIndicatorProps) {
  const show = pullRawDy > 4 || isRefreshing;
  if (!show) return null;

  const progress = isRefreshing ? 1 : Math.min(1, pullRawDy / thresholdPx);
  const strokeOffset = CIRC * (1 - progress);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-[30] flex justify-center",
        className
      )}
      style={{
        paddingTop: `max(0.25rem, ${Math.min(pullRawDy * 0.28, 40)}px)`,
      }}
      aria-hidden
    >
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-mid)]/35",
          "bg-[var(--color-dark)]/95 shadow-lg backdrop-blur-md"
        )}
      >
        {isRefreshing ? (
          <Loader2 className="h-[1.15rem] w-[1.15rem] animate-spin text-[var(--color-lightest)]" strokeWidth={2.5} />
        ) : (
          <svg width="26" height="26" viewBox="0 0 26 26" className="text-[var(--color-lightest)]" aria-hidden>
            <circle
              cx="13"
              cy="13"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={strokeOffset}
              transform="rotate(-90 13 13)"
              className="duration-75"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
