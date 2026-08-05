import { useMemo } from "react";
import { TrendingUp, TrendingDown, Timer, ListChecks, Trophy, CalendarCheck } from "lucide-react";
import { Donut, Sparkline, seededRand } from "./SandboxPrimitives";
import { MEDIA_META } from "./sandboxData";
import { cn } from "@/lib/utils";

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  spark,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
  delta: number;
  spark: number[];
}) {
  const up = delta >= 0;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-3">
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">
          <Icon className="size-4" aria-hidden />
        </span>
        <span
          className={cn(
            "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          )}
        >
          {up ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
          {up ? "+" : ""}
          {delta}%
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[var(--color-light)]">{label}</p>
          <p className="text-xl font-bold text-[var(--color-lightest)]">{value}</p>
        </div>
        <Sparkline points={spark} width={80} height={34} />
      </div>
    </div>
  );
}

export function ConceptStats() {
  const series = useMemo(() => {
    const mk = (seed: number, base: number) => {
      const r = seededRand(seed);
      return Array.from({ length: 12 }, (_, i) => base + Math.round(r() * base * 0.5) + i * 1.2);
    };
    return {
      hours: mk(1, 6),
      logs: mk(2, 18),
      days: mk(3, 12),
      avg: mk(4, 7),
    };
  }, []);

  const categoryBreakdown = useMemo(() => {
    const r = seededRand(12);
    return Object.values(MEDIA_META).map((meta) => ({
      meta,
      value: Math.round(r() * 40 + 6),
    }));
  }, []);

  const statusDonut = useMemo(() => {
    const r = seededRand(99);
    const colors: [string, string][] = [
      ["Completed", "var(--btn-gradient-start)"],
      ["In progress", "#F59E0B"],
      ["Planned", "#3B82F6"],
      ["Dropped", "#EF4444"],
    ];
    return colors.map(([label, color]) => ({ label, color, value: Math.round(r() * 30 + 4) }));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Quick stat cards with trend */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Timer} label="Hours consumed" value="84h" delta={12} spark={series.hours} />
        <StatCard icon={ListChecks} label="Logs" value="214" delta={8} spark={series.logs} />
        <StatCard icon={CalendarCheck} label="Active days" value="56" delta={-3} spark={series.days} />
        <StatCard icon={Trophy} label="Avg rating" value="7.8" delta={2} spark={series.avg} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Hours by category — stacked bars with trend */}
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--color-lightest)]">Time by category</p>
            <span className="text-[10px] font-medium uppercase text-[var(--color-light)]">12 mo</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {categoryBreakdown.map((c) => {
              const max = Math.max(...categoryBreakdown.map((x) => x.value)) || 1;
              return (
                <div key={c.meta.label} className="flex items-center gap-2.5">
                  <c.meta.icon className="size-4 shrink-0 text-[var(--color-light)]" aria-hidden />
                  <span className="w-20 shrink-0 truncate text-xs font-medium text-[var(--color-lightest)]">
                    {c.meta.label}
                  </span>
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-mid)]/25">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c.value / max) * 100}%`,
                        background: `linear-gradient(90deg, ${c.meta.from}, ${c.meta.to})`,
                      }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[var(--color-light)]">
                    {c.value}h
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status donut + legend */}
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-4">
          <p className="text-sm font-semibold text-[var(--color-lightest)]">Library status</p>
          <div className="flex items-center gap-4">
            <Donut segments={statusDonut} size={120} stroke={16} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {statusDonut.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-[var(--color-light)]">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: s.color }}
                      aria-hidden
                    />
                    {s.label}
                  </span>
                  <span className="font-semibold text-[var(--color-lightest)]">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}