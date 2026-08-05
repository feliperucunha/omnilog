import { useMemo } from "react";
import { Flame } from "lucide-react";
import { seededRand } from "./SandboxPrimitives";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function levelFor(v: number, max: number) {
  if (v <= 0) return 0;
  const ratio = v / max;
  if (ratio > 0.7) return 4;
  if (ratio > 0.4) return 3;
  if (ratio > 0.15) return 2;
  return 1;
}

const LEVEL_COLOR: Record<number, string> = {
  0: "bg-[var(--color-mid)]/20",
  1: "bg-emerald-600/35",
  2: "bg-emerald-500/55",
  3: "bg-emerald-500/80",
  4: "bg-emerald-400",
};

export function ConceptHeatmap() {
  const grid = useMemo(() => {
    const r = seededRand(2026);
    const weeks: { values: number[]; monthIndex: number }[] = [];
    let dayIndex = 0;
    // 53 weeks so the year fills edge-to-edge (like GitHub/Trakt)
    for (let w = 0; w < 53; w++) {
      const values: number[] = [];
      for (let d = 0; d < 7; d++) {
        const activity = r();
        // Weekend bias — people log more on weekends
        const weekendBoost = d === 0 || d === 6 ? 1.6 : 1;
        const v = activity > 0.62 ? Math.round((activity - 0.62) * 6 * weekendBoost) : 0;
        values.push(v);
        dayIndex++;
      }
      const monthIndex = Math.min(11, Math.floor(dayIndex / 30.4));
      weeks.push({ values, monthIndex });
    }
    return { weeks, max: 5 };
  }, []);

  const streakPills = useMemo(() => {
    const r = seededRand(9);
    return Array.from({ length: 7 }, () => r() > 0.28);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Streak callout (Trakt-style) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-500/10 to-rose-500/5 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/25 text-orange-400">
            <Flame className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold text-[var(--color-lightest)]">7 day streak</p>
            <p className="text-xs text-[var(--color-light)]">Log something today to keep it alive</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {streakPills.map((active, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  "h-8 w-full rounded-lg border",
                  active
                    ? "border-orange-500/50 bg-orange-500/25"
                    : "border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/40 opacity-50"
                )}
              />
              <span className="text-[9px] font-medium uppercase text-[var(--color-light)]">
                {["M", "T", "W", "T", "F", "S", "S"][i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-lightest)]">Activity — 2026</p>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--color-light)]">
            Less
            {[0, 1, 2, 3, 4].map((lvl) => (
              <span key={lvl} className={cn("h-2.5 w-2.5 rounded-[3px]", LEVEL_COLOR[lvl])} />
            ))}
            More
          </div>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-[3px]">
            {grid.weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.values.map((v, di) => (
                  <span
                    key={di}
                    title={`${v} log${v === 1 ? "" : "s"} — week ${wi + 1}`}
                    className={cn(
                      "h-[11px] w-[11px] rounded-[3px] transition-transform hover:scale-125",
                      LEVEL_COLOR[levelFor(v, grid.max)]
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-between text-[10px] font-medium text-[var(--color-light)]">
          {MONTHS.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
