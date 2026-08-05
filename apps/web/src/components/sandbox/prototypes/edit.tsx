import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS, MEDIA_META } from "../sandboxData";
import { Chip, Cover, Meter, StarsInput } from "./kit";

type Draft = { id: string; status: string; progress: number; rating: number };

export function EditInline() {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(
    Object.fromEntries(DEMO_ITEMS.slice(0, 4).map((it, i) => [it.id, { id: it.id, status: i % 2 ? "Watching" : "Backlog", progress: i * 30, rating: 3 }]))
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const commit = (d: Draft) => {
    setDrafts((m) => ({ ...m, [d.id]: d }));
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="relative flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex flex-col gap-2">
        {DEMO_ITEMS.slice(0, 4).map((it) => {
          const d = drafts[it.id];
          const isEditing = editing === it.id;
          return (
            <div key={it.id} className="overflow-hidden rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40">
              <div className="flex items-center gap-3 p-2">
                <Cover item={it} className="aspect-square w-10 rounded-md [&_span]:hidden" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-[var(--color-lightest)]">{it.title}</p>
                  <p className="text-[10px] text-[var(--color-light)]">{d.status} · {d.progress}%</p>
                  <Meter value={d.progress} className="mt-1" />
                </div>
                <button type="button" onClick={() => setEditing(isEditing ? null : it.id)} className="rounded-lg border border-[var(--color-mid)]/40 px-2 py-1 text-[10px] font-semibold text-[var(--color-light)]">
                  {isEditing ? "Cancel" : "Edit"}
                </button>
              </div>
              <AnimatePresence initial={false}>
                {isEditing && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={springSoft} className="overflow-hidden">
                    <div className="flex flex-col gap-2.5 border-t border-[var(--color-mid)]/20 p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {["Backlog", "Watching", "Completed"].map((s) => (
                          <Chip key={s} active={d.status === s} onClick={() => setDrafts((m) => ({ ...m, [it.id]: { ...m[it.id], status: s } }))}>{s}</Chip>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--color-light)]">{d.progress}%</span>
                        <input type="range" min={0} max={100} value={d.progress} onChange={(e) => setDrafts((m) => ({ ...m, [it.id]: { ...m[it.id], progress: Number(e.target.value) } }))} className="flex-1 accent-[var(--btn-gradient-start)]" />
                      </div>
                      <div className="flex items-center justify-between">
                        <StarsInput value={d.rating} onChange={(v) => setDrafts((m) => ({ ...m, [it.id]: { ...m[it.id], rating: v } }))} />
                        <button type="button" onClick={() => commit(d)} className="btn-gradient rounded-lg px-3 py-1.5 text-[11px] font-bold text-white">Save</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {saved && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={springSoft} className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300">
            <Check className="size-4" aria-hidden /> Saved
            <button type="button" className="ml-auto rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">Undo</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const STEPS = [
  { t: "Status", desc: "How did it go?" },
  { t: "Progress", desc: "Plays, hours or episodes." },
  { t: "Details", desc: "Scores, notes, extras." },
  { t: "Summary", desc: "Check before you save." },
];

export function EditWizard() {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("Completed");
  const [plays, setPlays] = useState(10);
  const [score, setScore] = useState(8.5);
  const [rating, setRating] = useState(4);
  const it = DEMO_ITEMS[4]; // board game

  return (
    <div className="flex min-h-[28rem] flex-col bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-2">
        <Cover item={it} className="aspect-square w-9 rounded-md [&_span]:hidden" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-[var(--color-lightest)]">{it.title}</p>
          <p className="text-[10px] text-[var(--color-light)]">{MEDIA_META[it.mediaType].label} · match log</p>
        </div>
        <span className="rounded-full bg-[var(--btn-gradient-start)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--btn-gradient-start)]">{step + 1}/4</span>
      </div>

      <div className="mt-3 flex gap-1">
        {STEPS.map((s, i) => (
          <span key={s.t} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-[var(--btn-gradient-start)]" : "bg-[var(--color-mid)]/30")} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springSoft} className="mt-4 flex flex-1 flex-col gap-3">
          <p className="text-sm font-black text-[var(--color-lightest)]">{STEPS[step].t}</p>
          <p className="text-[11px] text-[var(--color-light)]">{STEPS[step].desc}</p>

          {step === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {["Backlog", "In progress", "Completed", "Dropped"].map((s) => (
                <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s}</Chip>
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--color-light)]">Total plays</span>
                <span className="font-bold text-[var(--color-lightest)]">{plays}</span>
              </div>
              <input type="range" min={1} max={50} value={plays} onChange={(e) => setPlays(Number(e.target.value))} className="accent-[var(--btn-gradient-start)]" />
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-xl bg-[var(--color-darkest)]/50 p-3 text-[11px]">
                <span className="text-[var(--color-light)]">Score (weighted)</span>
                <span className="font-bold text-[var(--color-lightest)]">{score.toFixed(1)}</span>
              </div>
              <input type="range" min={0} max={10} step={0.5} value={score} onChange={(e) => setScore(Number(e.target.value))} className="accent-[var(--btn-gradient-start)]" />
            </div>
          )}
          {step === 3 && (
            <div className="flex flex-col gap-2 rounded-xl bg-[var(--color-darkest)]/50 p-3">
              <p className="text-xs font-bold text-[var(--color-lightest)]">{it.title}</p>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--color-light)]">
                <span>Status: <span className="font-semibold text-[var(--color-lightest)]">{status}</span></span>
                <span>Plays: <span className="font-semibold text-[var(--color-lightest)]">{plays}</span></span>
                <span>Score: <span className="font-semibold text-[var(--color-lightest)]">{score.toFixed(1)}</span></span>
                <span>Rating: <StarsInput value={rating} onChange={setRating} /></span>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 flex items-center gap-2">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="rounded-xl border border-[var(--color-mid)]/40 px-3 py-2.5 text-xs font-semibold text-[var(--color-light)]">
            <ChevronLeft className="inline size-4" aria-hidden /> Back
          </button>
        )}
        <button type="button" onClick={() => setStep((s) => Math.min(3, s + 1))} className="btn-gradient flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-bold text-white">
          {step === 3 ? <><Check className="size-4" aria-hidden /> Save match log</> : <>Next <ChevronRight className="size-4" aria-hidden /></>}
        </button>
      </div>
    </div>
  );
}