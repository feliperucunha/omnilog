import { useState, type ReactNode } from "react";
import { MonitorSmartphone, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

/** Deterministic pseudo-random for demo data (stable across renders). */
export function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

export function Sparkline({
  points,
  width = 96,
  height = 32,
  stroke = "var(--btn-gradient-start)",
  fill = true,
}: {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: boolean;
}) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((p, i) => [
    i * step,
    height - ((p - min) / range) * (height - 8) - 4,
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
      className="overflow-visible"
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

export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-mid)"
          strokeWidth={stroke}
          opacity={0.35}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--btn-gradient-start)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {children}
      </div>
    </div>
  );
}

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

export function MiniBars({
  values,
  height = 36,
  color = "var(--btn-gradient-start)",
}: {
  values: number[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(...values) || 1;
  return (
    <div className="flex h-full items-end gap-[3px]" style={{ height }} aria-hidden>
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

type Frame = "desktop" | "mobile";

export function ConceptShell({
  title,
  problem,
  solution,
  inspiredBy,
  children,
}: {
  title: string;
  problem: string;
  solution: string;
  inspiredBy: string[];
  children: ReactNode;
}) {
  const [frame, setFrame] = useState<Frame>("desktop");
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-4 shadow-[var(--shadow-md)] md:p-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[var(--btn-gradient-start)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--btn-gradient-start)]">
            Proposal
          </span>
          <h2 className="text-base font-semibold text-[var(--color-lightest)] md:text-lg">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {inspiredBy.map((src) => (
            <span
              key={src}
              className="rounded-full border border-[var(--color-mid)]/40 px-2 py-0.5 text-[10px] font-medium text-[var(--color-light)]"
            >
              Inspired by {src}
            </span>
          ))}
        </div>
        <p className="text-xs text-[var(--color-light)]">
          <span className="font-semibold text-[var(--color-lightest)]">Problem:</span> {problem}
        </p>
        <p className="text-xs text-[var(--color-light)]">
          <span className="font-semibold text-[var(--color-lightest)]">Solution:</span> {solution}
        </p>
      </header>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-mid)]/20 pt-3">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
          Live preview
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-mid)]/40 p-0.5">
          <FrameButton
            active={frame === "desktop"}
            onClick={() => setFrame("desktop")}
            label="Desktop"
            icon={<Monitor className="size-3.5" aria-hidden />}
          />
          <FrameButton
            active={frame === "mobile"}
            onClick={() => setFrame("mobile")}
            label="Mobile"
            icon={<MonitorSmartphone className="size-3.5" aria-hidden />}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/40">
        <div
          className={cn(
            "transition-all",
            frame === "mobile" &&
              "mx-auto my-4 max-w-[380px] rounded-[2.25rem] border-[6px] border-[var(--color-dark)] bg-[var(--color-dark)] shadow-[0_0_0_1px_var(--color-mid)]"
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

function FrameButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-[var(--color-light)] transition-colors",
        active && "bg-[var(--btn-gradient-start)]/20 text-[var(--color-lightest)]"
      )}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}
