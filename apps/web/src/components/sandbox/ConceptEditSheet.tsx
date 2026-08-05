import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, Undo2, Star } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";

const STATUSES = ["Watching", "Completed", "Dropped", "Planned"] as const;

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          aria-label={`${s} stars`}
          onClick={() => onChange(s)}
          className="p-0.5"
        >
          <Star
            className={cn("size-6", s <= value ? "fill-amber-400 text-amber-400" : "text-[var(--color-light)]")}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

export function ConceptEditSheet() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("Watching");
  const [progress, setProgress] = useState(34);
  const [stars, setStars] = useState(4);
  const [saved, setSaved] = useState(false);

  const isProgressBased = status === "Watching" || status === "Completed";

  return (
    <div className="relative flex min-h-[28rem] flex-col overflow-hidden bg-[var(--color-dark)]">
      {/* Fake item list behind */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-3">
          <div className="h-14 w-10 shrink-0 rounded-md bg-[var(--color-mid)]/40" />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-2/3 rounded bg-[var(--color-mid)]/50" />
            <div className="mt-2 h-2.5 w-1/3 rounded bg-[var(--color-mid)]/30" />
          </div>
          <span className="rounded-full bg-[var(--btn-gradient-start)]/15 px-2 py-1 text-[10px] font-semibold text-[var(--btn-gradient-start)]">
            Editing
          </span>
        </div>
      </div>

      {/* Sheet editor */}
      <motion.div
        layout
        className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-4 rounded-t-3xl border-t border-[var(--color-mid)]/30 bg-[var(--color-darkest)] p-4"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-mid)]" />
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[var(--color-lightest)]">Edit — Severance</p>
          <button
            type="button"
            aria-label="Close"
            className="rounded-md p-1 text-[var(--color-light)]"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
        </div>

        {/* Status segmented */}
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--color-dark)]/60 p-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-lg px-1 py-1.5 text-[10px] font-semibold text-[var(--color-light)] transition-colors",
                status === s && "bg-[var(--btn-gradient-start)]/25 text-[var(--color-lightest)]"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Progress slider */}
        {isProgressBased && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
                Progress
              </span>
              <span className="text-xs font-bold text-[var(--color-lightest)]">{progress}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-[var(--btn-gradient-start)]"
              aria-label="Progress"
            />
          </div>
        )}

        {/* Rating */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
            Rating
          </span>
          <Stars value={stars} onChange={setStars} />
        </div>

        {/* Save with undo */}
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.button
              key="undo"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={springSoft}
              type="button"
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-mid)]/40 bg-[var(--color-dark)] text-xs font-semibold text-[var(--color-lightest)]"
              onClick={() => setSaved(false)}
            >
              <Undo2 className="size-4" aria-hidden />
              Saved — Undo
            </motion.button>
          ) : (
            <motion.button
              key="save"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={springSoft}
              type="button"
              className="btn-gradient flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
              onClick={() => setSaved(true)}
            >
              <Check className="size-4" aria-hidden />
              Save changes
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
