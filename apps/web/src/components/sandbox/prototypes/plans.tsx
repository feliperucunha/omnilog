import { useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Meter } from "./kit";

type PlanId = "free" | "beta" | "pro";
const CURRENT: PlanId = "beta";

const FEATURES: { name: string; values: Record<PlanId, string> }[] = [
  { name: "Log count", values: { free: "500", beta: "∞", pro: "∞" } },
  { name: "Statistics", values: { free: "Basic", beta: "Full", pro: "Full+" } },
  { name: "Calendar", values: { free: "—", beta: "✓", pro: "✓" } },
  { name: "Year in review", values: { free: "—", beta: "—", pro: "✓" } },
  { name: "Export", values: { free: "—", beta: "CSV", pro: "CSV+XLS" } },
  { name: "Ad-free", values: { free: "—", beta: "✓", pro: "✓" } },
];

export function TiersCompare() {
  const plans: PlanId[] = ["free", "beta", "pro"];
  const [highlight, setHighlight] = useState<PlanId | null>(null);
  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="overflow-x-auto rounded-xl border border-[var(--color-mid)]/20">
        <table className="w-full min-w-[480px] text-left text-[11px]">
          <thead>
            <tr className="bg-[var(--color-darkest)]/50">
              <th className="sticky left-0 bg-[var(--color-darkest)]/60 px-3 py-2 text-[var(--color-light)]">Feature</th>
              {plans.map((p) => (
                <th key={p} onMouseEnter={() => setHighlight(p)} onMouseLeave={() => setHighlight(null)} className={cn("px-3 py-2 capitalize", CURRENT === p && "bg-[var(--btn-gradient-start)]/10", p === "pro" && "text-[var(--btn-gradient-start)]")}>
                  <div className="flex flex-col">
                    <span className="font-bold">{p}</span>
                    <span className="text-[9px] font-semibold text-[var(--btn-gradient-start)]">{p === "pro" ? "Best value" : ""}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.name} className={cn("border-t border-[var(--color-mid)]/10", highlight && "bg-[var(--btn-gradient-start)]/[0.04]")}>
                <td className="sticky left-0 bg-[var(--color-darkest)]/40 px-3 py-2 font-semibold text-[var(--color-lightest)]">{f.name}</td>
                {plans.map((p) => (
                  <td key={p} className={cn("px-3 py-2 text-[var(--color-light)]", CURRENT === p && "bg-[var(--btn-gradient-start)]/[0.04]")}>
                    {f.values[p] === "✓" ? <span className="text-emerald-400">✓</span> : f.values[p]}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="sticky left-0 bg-[var(--color-darkest)]/40 px-3 py-2" />
              {plans.map((p) => (
                <td key={p} className="px-3 py-3">
                  <button type="button" className={cn("w-full rounded-lg py-1.5 text-[10px] font-bold", p === "pro" ? "btn-gradient text-white" : "border border-[var(--color-mid)]/40 text-[var(--color-light)]")}>
                    {CURRENT === p ? "Current" : p === "pro" ? "Upgrade" : "Choose"}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TiersBenefit() {
  const benefits = [
    { title: "See your year in art", desc: "Heatmap, calendar and a shareable recap.", blur: "year recap" },
    { title: "Unlock deep statistics", desc: "Momentum cards, genres, streaks and donuts.", blur: "stats" },
    { title: "Go beyond 500 logs", desc: "Unlimited logging and exports in CSV + XLS.", blur: "logs" },
  ];
  return (
    <div className="flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {benefits.map((b) => (
          <div key={b.title} className="flex flex-col gap-2 rounded-2xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]"><Zap className="size-4" aria-hidden /></span>
            <p className="text-sm font-bold text-[var(--color-lightest)]">{b.title}</p>
            <p className="text-[10px] text-[var(--color-light)]">{b.desc}</p>
            <div className="relative mt-auto overflow-hidden rounded-xl bg-[var(--color-dark)] p-2">
              <div className="flex flex-col gap-1 opacity-100 blur-[5px] select-none">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-3 rounded bg-[var(--btn-gradient-start)]/40" style={{ width: `${90 - i * 14}%` }} />
                ))}
              </div>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[var(--color-light)]">Preview</span>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-gradient w-full rounded-xl py-3 text-sm font-bold text-white md:mx-auto md:max-w-xs">Unlock Pro — $9/mo</button>
    </div>
  );
}

export function TiersUsage() {
  return (
    <div className="flex min-h-[26rem] items-center justify-center bg-[var(--color-dark)] p-4">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--color-lightest)]">Your log usage</span>
          <span className="rounded-full bg-[var(--btn-gradient-start)]/15 px-2 py-0.5 font-bold text-[var(--btn-gradient-start)]">482 / 500</span>
        </div>
        <Meter value={96} className="h-2.5" />
        <p className="text-[11px] text-[var(--color-light)]">96% full — at your pace, you hit the limit in about <span className="font-semibold text-[var(--color-lightest)]">2 weeks</span>.</p>
        <button type="button" className="btn-gradient mt-2 w-full rounded-xl py-2.5 text-sm font-bold text-white">Remove the limit — Pro</button>
        <p className="text-center text-[9px] text-[var(--color-light)]">Unlimited logs, statistics & the year recap.</p>
      </div>
    </div>
  );
}