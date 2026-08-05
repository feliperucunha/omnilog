import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Upload } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS } from "../sandboxData";
import { Cover, SectionLabel } from "./kit";

export function OnboardRamp() {
  const [step, setStep] = useState(0);
  const steps = [
    { t: "What do you love?", body: <div className="flex flex-wrap gap-2">{[["Movies","🎬"],["TV","📺"],["Books","📚"],["Games","🎮"],["Board games","🎲"]].map(([c, e]) => <span key={c} className="rounded-2xl border border-[var(--color-mid)]/40 bg-[var(--color-darkest)]/60 px-4 py-3 text-xs text-[var(--color-lightest)]">{e} {c}</span>)}</div> },
    { t: "Pick a look", body: <div className="flex flex-col gap-2">{[["Dark", "◐"], ["Light", "◑"], ["System", "◒"]].map(([c, e]) => <span key={c} className="flex items-center justify-between rounded-xl border border-[var(--color-mid)]/40 bg-[var(--color-darkest)]/60 px-4 py-3 text-xs text-[var(--color-lightest)]"><span>{e} {c}</span><span className="text-[var(--btn-gradient-start)]">✓</span></span>)}</div> },
    { t: "Log your first item", body: <div className="flex flex-col gap-2"><p className="text-[10px] text-[var(--color-light)]">Search “dune”…</p><button type="button" className="flex items-center gap-2 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 p-2 text-left"><Cover item={DEMO_ITEMS[0]} className="aspect-square w-9 rounded-md [&_span]:hidden" /><span className="text-xs text-[var(--color-lightest)]">Dune: Part Two</span><span className="ml-auto rounded-lg bg-[var(--btn-gradient-start)] px-2 py-1 text-[10px] font-bold text-white">+ Log</span></button></div> },
  ];
  return (
    <div className="flex min-h-[26rem] flex-col bg-[var(--color-dark)] p-5">
      <div className="flex gap-1">
        {steps.map((s, i) => <span key={s.t} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-[var(--btn-gradient-start)]" : "bg-[var(--color-mid)]/30")} />)}
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-[var(--btn-gradient-start)]">Step {step + 1} of {steps.length} · always skippable</p>
      <p className="mt-1 text-xl font-black text-[var(--color-lightest)]">{steps[step].t}</p>
      <div className="mt-4 flex-1">{steps[step].body}</div>
      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={() => setStep((s) => Math.min(2, s + 1))} className="btn-gradient flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-bold text-white">{step === 2 ? "Start logging" : "Continue"}<ChevronRight className="inline size-4" aria-hidden /></button>
      </div>
      <button type="button" className="mt-2 self-center text-[10px] text-[var(--color-light)]">Skip for now</button>
    </div>
  );
}

export function OnboardSpotlight() {
  const [step, setStep] = useState(0);
  const spots = [
    { title: "Search from anywhere", body: "Press / or tap here to jump to any item.", x: "12%", y: "18%" },
    { title: "Add a log in one tap", body: "This + opens a quick-add sheet.", x: "80%", y: "64%" },
    { title: "Your stats live here", body: "Streaks, hours and your year in review.", x: "60%", y: "20%" },
  ];
  const s = spots[step];
  return (
    <div className="relative flex min-h-[28rem] flex-col bg-[var(--color-dark)] p-4">
      <div className="flex items-center justify-between">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--btn-gradient-start)] text-[11px] font-bold text-white">◈</span>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-mid)]/30 px-3 py-1.5 text-[11px] text-[var(--color-light)]">Search…</div>
      </div>
      <div className="mt-4 grid flex-1 grid-cols-3 gap-2">
        {DEMO_ITEMS.slice(0, 6).map((it) => <Cover key={it.id} item={it} />)}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2">
        <span className="btn-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white">+</span>
        <span className="text-[10px] text-[var(--color-light)]">Quick add</span>
      </div>

      {step < 3 && (
        <>
          <motion.div key={step} className="absolute z-30" style={{ left: s.x, top: s.y }}>
            <div className={cn("h-20 w-20 rounded-2xl border-2 border-[var(--btn-gradient-start)]", step === 0 && "h-8 w-24 rounded-lg")} />
          </motion.div>
          <div className="absolute inset-0 z-10 bg-black/60" />
          <motion.div key={`c${step}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={springSoft} className="absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-2 rounded-t-2xl bg-[var(--color-dark)] p-4">
            <p className="text-sm font-bold text-[var(--color-lightest)]">{s.title}</p>
            <p className="text-[11px] text-[var(--color-light)]">{s.body}</p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--color-light)]">{step + 1} / 3</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(3)} className="rounded-lg px-3 py-1.5 text-[10px] font-semibold text-[var(--color-light)]">Skip tour</button>
                <button type="button" onClick={() => setStep((s) => s + 1)} className="btn-gradient rounded-lg px-4 py-1.5 text-[11px] font-bold text-white">Got it</button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

export function OnboardTaste() {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <SectionLabel>Import or pick</SectionLabel>
      <button type="button" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-mid)]/40 py-3 text-xs font-semibold text-[var(--color-lightest)]"><Upload className="size-4" aria-hidden /> Import CSV / board game collection</button>
      <p className="text-[10px] text-[var(--color-light)]">or pick 5 favorites to seed your home</p>
      <div className="grid grid-cols-4 gap-2">
        {DEMO_ITEMS.map((it) => (
          <button key={it.id} type="button" onClick={() => toggle(it.id)} className="relative">
            <Cover item={it} />
            <span className={cn("absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold", picked.includes(it.id) ? "bg-[var(--btn-gradient-start)] text-white" : "bg-black/50 text-white")}>
              {picked.includes(it.id) ? <Check className="size-3" aria-hidden /> : ""}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-auto">
        <button type="button" className={cn("w-full rounded-xl py-3 text-sm font-bold", picked.length >= 3 ? "btn-gradient text-white" : "border border-[var(--color-mid)]/40 text-[var(--color-light)]")}>
          {picked.length >= 3 ? "Seed my library" : `Pick ${Math.max(0, 3 - picked.length)} more`}
        </button>
        <button type="button" className="mt-2 w-full text-center text-[10px] text-[var(--color-light)]">Skip — start empty</button>
      </div>
    </div>
  );
}