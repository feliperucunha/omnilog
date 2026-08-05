import { useMemo } from "react";
import { Flame, Plus, TrendingUp } from "lucide-react";
import { ProgressRing, seededRand } from "./SandboxPrimitives";
import { DEMO_ITEMS, itemGradient, MEDIA_META } from "./sandboxData";

function MetricChip({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 px-3 py-2.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-[var(--color-lightest)]">{value}</span>
        {delta && (
          <span className="flex items-center gap-0.5 text-[11px] font-medium text-emerald-400">
            <TrendingUp className="size-3" aria-hidden />
            {delta}
          </span>
        )}
      </span>
    </div>
  );
}

export function ConceptHero() {
  const flashes = useMemo(() => {
    const r = seededRand(7);
    return DEMO_ITEMS.map((item) => ({ item, progress: Math.round(r() * 100) }));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Greeting row */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--color-light)]">Tuesday, August 5</p>
          <h3 className="truncate text-xl font-bold text-[var(--color-lightest)]">
            Good evening, Felipe
          </h3>
        </div>
        <button
          type="button"
          className="btn-gradient flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold max-md:w-full max-md:justify-center"
        >
          <Plus className="size-4" aria-hidden />
          Log something
        </button>
      </div>

      {/* Daily goal + chips */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-3">
          <ProgressRing value={40} size={64} stroke={7}>
            <span className="text-sm font-bold text-[var(--color-lightest)]">2/5</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-lightest)]">Daily goal</p>
            <p className="text-xs text-[var(--color-light)]">2 logs today, keep it up</p>
          </div>
        </div>
        <MetricChip label="This week" value="12 logs" delta="+3 vs last" />
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 px-3 py-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
            <Flame className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-[var(--color-lightest)]">
              7 day streak
            </p>
            <p className="text-[11px] text-[var(--color-light)]">Longest this year</p>
          </div>
        </div>
      </div>

      {/* Continue logging rail */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-lightest)]">Jump back in</p>
          <span className="text-xs font-semibold text-[var(--btn-gradient-start)]">See all</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {flashes.slice(0, 4).map(({ item, progress }) => {
            const Icon = MEDIA_META[item.mediaType].icon;
            return (
              <button
                key={item.id}
                type="button"
                className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 text-left"
              >
                <div
                  className="relative flex h-20 items-center justify-center"
                  style={{ background: itemGradient(item) }}
                >
                  <Icon className="size-8 text-white/90" aria-hidden />
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                    {MEDIA_META[item.mediaType].label}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5 p-2">
                  <span className="truncate text-xs font-semibold text-[var(--color-lightest)]">
                    {item.title}
                  </span>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-mid)]/30">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${progress}%`, background: "var(--btn-gradient-start)" }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
