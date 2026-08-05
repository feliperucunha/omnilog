import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Trophy,
  Layers,
  CircleCheck,
  Clock,
  Star,
  Dices,
  Gamepad2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Donut, MiniBars, Sparkline, seededRand } from "../SandboxPrimitives";
import { SectionLabel, MockTopNav } from "./kit";
import { MEDIA_META } from "../sandboxData";

type ModuleId = "hours" | "genres" | "streak" | "status" | "cal";

const DEFAULT_ORDER: ModuleId[] = ["hours", "genres", "streak", "status", "cal"];
const NAMES: Record<ModuleId, string> = {
  hours: "Hours",
  genres: "Top genres",
  streak: "Streak",
  status: "Library status",
  cal: "Activity",
};

const LIBRARY: ModuleId[] = ["hours", "genres", "streak", "status", "cal"];

function ModuleBody({ id }: { id: ModuleId }) {
  switch (id) {
    case "hours":
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-[var(--color-lightest)]">84h</span>
            <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-semibold text-emerald-400">▲ 12%</span>
          </div>
          <Sparkline points={[2, 3, 1, 5, 4, 6, 7]} width={150} height={36} />
        </div>
      );
    case "genres":
      return (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-[var(--color-light)]">Sci-Fi 38% · Drama 24%</p>
          <MiniBars values={[8, 5, 6, 4, 3]} height={44} color="var(--btn-gradient-end)" />
        </div>
      );
    case "streak":
      return (
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-orange-400">7</span>
          <span className="text-[10px] text-[var(--color-light)]">day streak · best 21</span>
        </div>
      );
    case "status":
      return (
        <div className="flex items-center gap-3">
          <Donut size={76} stroke={10} segments={[{ value: 55, color: "#7C3AED" }, { value: 25, color: "#0284C7" }, { value: 20, color: "#10B981" }]} />
          <div className="flex flex-col gap-0.5 text-[10px] text-[var(--color-light)]">
            <span>55% Movies</span>
            <span>25% TV</span>
            <span>20% Games</span>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export function StatsModules() {
  const [order, setOrder] = useState<ModuleId[]>(DEFAULT_ORDER);
  const [edit, setEdit] = useState(false);

  const move = (i: number, d: 1 | -1) => {
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };
  const remove = (i: number) => setOrder((o) => o.filter((_, k) => k !== i));
  const add = (id: ModuleId) => {
    if (order.includes(id)) return;
    setOrder((o) => [...o, id]);
  };
  const available = LIBRARY.filter((m) => !order.includes(m));

  return (
    <div className="flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--color-lightest)]">Statistics</p>
        <button
          type="button"
          onClick={() => setEdit((v) => !v)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[10px] font-semibold",
            edit ? "bg-[var(--btn-gradient-start)] text-white" : "border border-[var(--color-mid)]/40 text-[var(--color-light)]"
          )}
        >
          {edit ? "Done" : "Edit layout"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {order.map((id, i) => (
          <div key={id} className="relative flex flex-col gap-2 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3">
            <div className="flex items-center justify-between">
              <SectionLabel>{NAMES[id]}</SectionLabel>
              {edit && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} aria-label="Move up" className="rounded bg-[var(--color-mid)]/25 p-1"><ArrowUp className="size-3" aria-hidden /></button>
                  <button type="button" onClick={() => move(i, 1)} aria-label="Move down" className="rounded bg-[var(--color-mid)]/25 p-1"><ArrowDown className="size-3" aria-hidden /></button>
                  <button type="button" onClick={() => remove(i)} aria-label="Remove" className="rounded bg-red-500/20 p-1"><X className="size-3" aria-hidden /></button>
                </div>
              )}
            </div>
            <ModuleBody id={id} />
          </div>
        ))}
      </div>

      {edit && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-[var(--color-mid)]/40 p-3">
          <SectionLabel>Add a module</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {available.length === 0 ? (
              <span className="text-[10px] text-[var(--color-light)]">All modules are on the board.</span>
            ) : (
              available.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => add(id)}
                  className="flex items-center gap-1 rounded-full border border-[var(--color-mid)]/40 px-2.5 py-1 text-[10px] font-semibold text-[var(--color-light)] hover:bg-[var(--color-mid)]/20"
                >
                  <Plus className="size-3" aria-hidden />
                  {NAMES[id]}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center gap-2">
        <span className="rounded-full bg-[var(--color-mid)]/20 px-2 py-0.5 text-[9px] text-[var(--color-light)]">Layout saved to your account</span>
      </div>
    </div>
  );
}

type Period = "month" | "12mo" | "year";

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
      )}
    >
      {up ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

/** Momentum card: value + % delta vs previous period + sparkline. */
function MomentumCard({
  icon: Icon,
  label,
  value,
  delta,
  spark,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  delta: number;
  spark: number[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <Delta value={delta} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium text-[var(--color-light)]">{label}</p>
          <p className="text-lg font-bold leading-tight text-[var(--color-lightest)]">{value}</p>
        </div>
        <Sparkline points={spark} width={64} height={28} />
      </div>
    </div>
  );
}

/** Row where a single metric gets momentum treatment (bar + delta + spark). */
function MomentumBreakdownRow({
  label,
  value,
  delta,
  pct,
  color,
  spark,
}: {
  label: string;
  value: string;
  delta: number;
  pct: number;
  color: string;
  spark: number[];
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-16 shrink-0 truncate text-[11px] font-medium text-[var(--color-lightest)]">{label}</span>
      <div className="flex h-10 min-w-0 flex-1 flex-col items-center gap-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-mid)]/25">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, pct)}%`, background: color }}
          />
        </div>
        <Sparkline points={spark} width={100} height={20} stroke={color} fill={false} />
      </div>
      <div className="flex w-16 shrink-0 flex-col items-end">
        <span className="text-[11px] font-bold tabular-nums text-[var(--color-lightest)]">{value}</span>
        <Delta value={delta} />
      </div>
    </div>
  );
}

/** Wrapper card with a momentum title (name + aggregate delta + range pill). */
function MomentumPanel({
  title,
  delta,
  action,
  children,
}: {
  title: string;
  delta?: number;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-lightest)]">{title}</p>
        <div className="flex items-center gap-1.5">
          {delta != null && <Delta value={delta} />}
          {action && <span className="text-[9px] font-medium uppercase text-[var(--color-light)]">{action}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function StatsMomentum() {
  const [period, setPeriod] = useState<Period>("12mo");

  const data = useMemo(() => {
    const mk = (seed: number, base: number) => {
      const rr = seededRand(seed);
      return Array.from({ length: 12 }, (_, i) => base + Math.round(rr() * base * 0.6) + i);
    };
    return {
      hours: mk(1, 6),
      logs: mk(2, 17),
      completed: mk(3, 11),
      rated: mk(4, 8),
      pages: mk(5, 400),
      wins: mk(6, 2),
      episodes: mk(7, 9),
    };
  }, []);

  const deltas = useMemo(() => {
    const pct = (arr: number[]) => Math.round(((arr[arr.length - 1] - arr[arr.length - 2]) / (arr[arr.length - 2] || 1)) * 100);
    return {
      hours: pct(data.hours),
      logs: pct(data.logs),
      completed: pct(data.completed),
      rated: pct(data.rated),
      pages: pct(data.pages),
      wins: pct(data.wins),
      episodes: pct(data.episodes),
    };
  }, [data]);

  const category = useMemo(() => {
    const r = seededRand(21);
    const byCat = Object.entries(MEDIA_META).map(([key, meta]) => {
      const spark = Array.from({ length: 6 }, () => Math.round(r() * 5 + 1));
      const prev = Math.round(r() * 12 + 3);
      const cur = Math.round(r() * 12 + 3);
      return { key, meta, spark, delta: Math.round(((cur - prev) / prev) * 100), cur };
    });
    const max = Math.max(...byCat.map((b) => b.cur)) || 1;
    return byCat.map((b) => ({ ...b, pct: (b.cur / max) * 100 }));
  }, []);

  const statusDonut = useMemo(() => {
    const r = seededRand(99);
    const colors: [string, string][] = [
      ["Completed", "var(--btn-gradient-start)"],
      ["In progress", "#F59E0B"],
      ["Planned", "#3B82F6"],
      ["Dropped", "#EF4444"],
    ];
    return colors.map(([label, color]) => ({
      label,
      color,
      value: Math.round(r() * 30 + 4),
      delta: Math.round(r() * 18 - 8),
    }));
  }, []);

  const platforms = useMemo(() => {
    const r = seededRand(44);
    const names = ["Steam", "PC", "Nintendo Switch", "PlayStation 5", "Xbox"];
    return names.map((name) => ({
      name,
      plays: Math.round(r() * 30 + 4),
      delta: Math.round(r() * 30 - 12),
      color: `hsl(${210 + Math.round(r() * 120)}, 60%, 55%)`,
    }));
  }, []);

  const matches = useMemo(() => {
    const r = seededRand(66);
    return Array.from({ length: 4 }).map((_, i) => ({
      title: ["Wingspan", "Catan", "Dixit", "Azul"][i],
      plays: Math.round(r() * 8 + 2),
      wins: Math.round(r() * 4),
      delta: Math.round(r() * 40 - 18),
    }));
  }, []);

  const weightBins = useMemo(() => {
    const r = seededRand(81);
    return [1, 2, 3, 4, 5].map((w) => ({
      w,
      count: Math.round(r() * 10 + 1),
      delta: Math.round(r() * 36 - 14),
    }));
  }, []);

  const spending = useMemo(() => {
    const r = seededRand(120);
    return Object.entries(MEDIA_META).map(([key, meta]) => ({
      key,
      meta,
      net: Math.round(r() * 200 - 40),
      delta: Math.round(r() * 40 - 18),
    }));
  }, []);

  const periods: { id: Period; label: string }[] = [
    { id: "month", label: "Month" },
    { id: "12mo", label: "12 mo" },
    { id: "year", label: "Year" },
  ];

  const maxPlay = Math.max(...platforms.map((p) => p.plays)) || 1;
  const maxWeight = Math.max(...weightBins.map((w) => w.count)) || 1;

  return (
    <div className="flex h-[42rem] flex-col bg-[var(--color-dark)]">
      <MockTopNav title="Statistics" right={<Wallet className="size-4 text-[var(--color-light)]" aria-hidden />} />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        <div className="flex items-center gap-1.5">
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={cn(
                "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors",
                period === p.id
                  ? "bg-[var(--btn-gradient-start)] text-white"
                  : "border border-[var(--color-mid)]/30 text-[var(--color-light)]"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MomentumCard icon={Clock} label="Hours logged" value="84h" delta={deltas.hours} spark={data.hours} />
          <MomentumCard icon={Layers} label="Total logs" value="214" delta={deltas.logs} spark={data.logs} />
          <MomentumCard icon={CircleCheck} label="Completed" value="128" delta={deltas.completed} spark={data.completed} />
          <MomentumCard icon={Star} label="Rated" value="96" delta={deltas.rated} spark={data.rated} />
          <MomentumCard icon={BookOpen} label="Pages read" value="4,820" delta={deltas.pages} spark={data.pages} />
          <MomentumCard icon={Trophy} label="Games won" value="23" delta={deltas.wins} spark={data.wins} />
        </div>

        <MomentumPanel title="Time by category" delta={deltas.hours} action="12 mo">
          <div className="flex flex-col gap-2">
            {category.map((c) => (
              <MomentumBreakdownRow
                key={c.key}
                label={c.meta.label}
                value={`${c.cur}h`}
                delta={c.delta}
                pct={c.pct}
                color={`linear-gradient(90deg, ${c.meta.from}, ${c.meta.to})`}
                spark={c.spark}
              />
            ))}
          </div>
        </MomentumPanel>

        <MomentumPanel title="Library status">
          <div className="flex items-center gap-4">
            <Donut
              size={104}
              stroke={14}
              segments={statusDonut.map((s) => ({ value: s.value, color: s.color }))}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {statusDonut.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-light)]">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                    {s.label}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold tabular-nums text-[var(--color-lightest)]">
                      {s.value}%
                    </span>
                    <Delta value={s.delta} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </MomentumPanel>

        <div className="grid grid-cols-2 gap-2">
          <MomentumPanel title="Pages" delta={deltas.pages} action="over time">
            <div className="flex h-14 items-end gap-1">
              <MiniBars values={data.pages} color="var(--btn-gradient-start)" />
            </div>
          </MomentumPanel>
          <MomentumPanel title="Episodes" delta={deltas.episodes} action="over time">
            <div className="flex h-14 items-end gap-1">
              <MiniBars values={data.episodes} color="var(--btn-gradient-end)" />
            </div>
          </MomentumPanel>
        </div>

        <MomentumPanel title="Most played platforms" delta={platforms.reduce((a, p) => a + p.delta, 0) / platforms.length}>
          <div className="flex flex-col gap-2">
            {platforms.map((p) => (
              <div key={p.name} className="flex items-center gap-2.5">
                <Gamepad2 className="size-3.5 shrink-0 text-[var(--color-light)]" aria-hidden />
                <span className="w-24 shrink-0 truncate text-[11px] font-medium text-[var(--color-lightest)]">
                  {p.name}
                </span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-mid)]/25">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(p.plays / maxPlay) * 100}%`, background: p.color }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-[var(--color-light)]">
                  {p.plays}
                </span>
                <Delta value={p.delta} />
              </div>
            ))}
          </div>
        </MomentumPanel>

        <MomentumPanel title="Matches played" action="recent">
          <div className="flex flex-col gap-2">
            {matches.map((m) => (
              <div key={m.title} className="flex items-center gap-2.5">
                <Dices className="size-3.5 shrink-0 text-[var(--color-light)]" aria-hidden />
                <span className="w-20 shrink-0 truncate text-[11px] font-medium text-[var(--color-lightest)]">
                  {m.title}
                </span>
                <span className="flex-1 text-[11px] text-[var(--color-light)]">
                  {m.plays} plays · {m.wins} win{m.wins === 1 ? "" : "s"}
                </span>
                <Delta value={m.delta} />
              </div>
            ))}
          </div>
        </MomentumPanel>

        <MomentumPanel title="By weight" action="board games">
          <div className="flex items-end gap-2">
            {weightBins.map((w) => (
              <div key={w.w} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <Delta value={w.delta} />
                <div
                  className="w-full rounded-t-md bg-[var(--btn-gradient-start)]"
                  style={{ height: `${Math.max(6, (w.count / maxWeight) * 56)}px` }}
                />
                <span className="text-[10px] tabular-nums text-[var(--color-light)]">{w.w}/5</span>
              </div>
            ))}
          </div>
        </MomentumPanel>

        <MomentumPanel title="Spending by category" action="net">
          <div className="flex flex-col gap-2">
            {spending.map((s) => (
              <div key={s.key} className="flex items-center gap-2.5">
                <s.meta.icon className="size-3.5 shrink-0 text-[var(--color-light)]" aria-hidden />
                <span className="w-20 shrink-0 truncate text-[11px] font-medium text-[var(--color-lightest)]">
                  {s.meta.label}
                </span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-mid)]/25">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (Math.abs(s.net) / 240) * 100)}%`,
                      background: s.net >= 0 ? "#10B981" : "#EF4444",
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "w-12 shrink-0 text-right text-[11px] font-semibold tabular-nums",
                    s.net >= 0 ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {s.net >= 0 ? "+" : ""}${s.net}
                </span>
                <Delta value={s.delta} />
              </div>
            ))}
          </div>
        </MomentumPanel>

        <p className="pb-1 text-center text-[9px] text-[var(--color-light)]">
          Momentum = change vs the previous period
        </p>
      </div>
    </div>
  );
}