import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DeltaChip,
  Sparkline,
  MomentumSkeleton,
  SparklineSkeleton,
  type MomentumData,
} from "./StatisticsMomentum";

/**
 * Small data-vis primitives shared across survey/stats widgets,
 * matching the UI-lab "momentum" aesthetic (compact cards, gradient tiles,
 * delta pills, sparklines, thin bars).
 */

/** Multipart segmented bars inside a donut. */
export function Donut({
  segments,
  size = 132,
  stroke = 18,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  stroke?: number;
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-mid)"
        strokeWidth={stroke}
        opacity={0.2}
      />
      {segments.map((s, i) => {
        const frac = s.value / total;
        const dash = c * frac;
        const offset = -acc * c;
        acc += frac;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
}

/** Slim vertical bars for a compact series (mini bar chart). */
export function MiniBars({
  values,
  height = 36,
  color = "var(--btn-gradient-start)",
  className,
}: {
  values: number[];
  height?: number;
  color?: string;
  className?: string;
}) {
  const max = Math.max(...values) || 1;
  return (
    <div className={cn("flex h-full items-end gap-[3px]", className)} style={{ height }} aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="min-w-0 flex-1 rounded-sm"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: color,
            opacity: 0.35 + 0.65 * (v / max),
          }}
        />
      ))}
    </div>
  );
}

/** Single stat "momentum" card: gradient icon tile + delta pill, value + sparkline. */
export function MomentumCard({
  icon: Icon,
  label,
  value,
  sub,
  momentum,
  momentumAria,
  momentumLoading,
  valueClassName,
  className,
}: {
  icon: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  momentum?: MomentumData;
  /** Localized accessibility label for the delta chip. */
  momentumAria?: (delta: number) => string;
  /** Show a skeleton in place of the delta/sparkline while momentum is still loading. */
  momentumLoading?: boolean;
  valueClassName?: string;
  className?: string;
}) {
  const showSpark = momentum?.series && momentum.series.length > 1;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">
          <Icon className="size-3.5" aria-hidden />
        </span>
        {momentum?.delta != null ? (
          <DeltaChip delta={momentum.delta} ariaLabel={momentumAria?.(momentum.delta)} />
        ) : momentumLoading ? (
          <MomentumSkeleton />
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
            {label}
          </p>
          <p
            className={cn(
              "text-lg font-bold leading-tight text-[var(--color-lightest)]",
              valueClassName
            )}
          >
            {value}
          </p>
          {sub ? <div className="mt-0.5 text-[10px] leading-snug text-[var(--color-light)]">{sub}</div> : null}
        </div>
        {showSpark ? (
          <Sparkline points={momentum!.series!} width={64} height={28} />
        ) : momentumLoading ? (
          <SparklineSkeleton width={64} height={28} />
        ) : null}
      </div>
    </div>
  );
}


/** Wrapper panel with a title + aggregate delta pill, matching the UI-lab style. */
export function MomentumPanel({
  title,
  delta,
  deltaAria,
  action,
  icon: Icon,
  className,
  children,
}: {
  title: ReactNode;
  delta?: number;
  deltaAria?: (delta: number) => string;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[var(--color-lightest)]">
          {Icon ? <Icon className="size-3.5 shrink-0 text-[var(--color-light)]" aria-hidden /> : null}
          <span className="truncate">{title}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {delta != null && <DeltaChip delta={delta} ariaLabel={deltaAria?.(delta)} />}
          {action ? (
            <span className="text-[9px] font-medium uppercase text-[var(--color-light)]">{action}</span>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Breakdown row: label · thin track bar · value, with optional delta pill (UI-lab style). */
export function MomentumBreakdownRow({
  label,
  value,
  delta,
  deltaAria,
  pct,
  color = "var(--btn-gradient-start)",
  onClick,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: number;
  deltaAria?: (delta: number) => string;
  pct: number;
  color?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="w-16 shrink-0 truncate text-[11px] font-medium text-[var(--color-lightest)]">
        {label}
      </span>
      <div className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-mid)]/25">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
      </div>
      <span className="w-12 shrink-0 text-right text-[11px] font-bold tabular-nums text-[var(--color-lightest)]">
        {value}
      </span>
      {delta != null && <DeltaChip delta={delta} ariaLabel={deltaAria?.(delta)} />}
    </>
  );
  if (!onClick) {
    return <div className="flex min-w-0 items-center gap-2.5">{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center gap-2.5 rounded-lg py-0.5 text-left transition-colors hover:bg-[var(--color-mid)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] max-md:min-h-[44px]"
    >
      {inner}
    </button>
  );
}