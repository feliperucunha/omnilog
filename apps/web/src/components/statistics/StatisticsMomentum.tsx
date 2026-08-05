import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Momentum data contract: an optional % change (delta vs the previous period)
 * and an optional short series of recent values used to draw a sparkline.
 * When absent, widgets render exactly as before.
 */
export interface MomentumData {
  /** Percent change vs the previous period (e.g. 12 = +12%, -3 = -3%). */
  delta?: number;
  /** Recent values (last N periods) for the sparkline. */
  series?: number[];
}

/** Rounds to at most one decimal and drops the trailing ".0". */
export function formatDeltaPercent(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Tiny up/down pill showing the % change vs the previous period. */
export function DeltaChip({
  delta,
  className,
  ariaLabel,
}: {
  delta: number;
  className?: string;
  /** Localized accessibility label (e.g. "12% vs previous period"). */
  ariaLabel?: string;
}) {
  const up = delta >= 0;
  const signed = `${up ? "+" : ""}${formatDeltaPercent(delta)}%`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
        className
      )}
      aria-label={ariaLabel ?? signed}
    >
      {up ? (
        <TrendingUp className="size-3" aria-hidden />
      ) : (
        <TrendingDown className="size-3" aria-hidden />
      )}
      {signed}
    </span>
  );
}

/** Lightweight SVG sparkline for a short series of values. */
export function Sparkline({
  points,
  width = 72,
  height = 24,
  stroke = "var(--btn-gradient-start)",
  fill = true,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: boolean;
  className?: string;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((p, i) => [
    i * step,
    height - ((p - min) / range) * (height - 6) - 3,
  ]);
  const path = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden
    >
      {fill && <path d={area} fill={stroke} opacity={0.12} />}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Computes the % change between the last two points of a series.
 * Returns undefined only when there aren't enough points to compare.
 * A zero previous value is treated as a large but bounded jump so the
 * chip still shows up when a metric went from "nothing" to "something".
 */
export function deltaFromSeries(series: number[]): number | undefined {
  if (series.length < 2) return undefined;
  const prev = series[series.length - 2];
  const curr = series[series.length - 1];
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return undefined;
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / prev) * 100);
}

/** Last N points of a series (for sparklines), excluding nothing. */
export function lastN(series: number[], n: number): number[] {
  return series.slice(-n);
}

/** Derives a value series from an entries array shaped like the stats bars. */
export function seriesFromStatsEntries(
  entries: Array<{ period: string; hours: number; count?: number }>
): number[] {
  return entries
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((e) => e.hours);
}

/** Builds MomentumData (delta + series) from a chronological stats entries array. */
export function momentumFromStatsEntries(
  entries: Array<{ period: string; hours: number; count?: number }>,
  maxPoints = 12
): MomentumData | undefined {
  const series = seriesFromStatsEntries(entries);
  const short = lastN(series, maxPoints);
  if (short.length < 2) return undefined;
  const delta = deltaFromSeries(short);
  return delta == null ? undefined : { delta, series: short };
}
