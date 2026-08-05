import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X, Flame } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";

const MEDIA_ACTIONS = [
  { label: "Movie", icon: "🎬", color: "#7C3AED" },
  { label: "TV Show", icon: "📺", color: "#0284C7" },
  { label: "Game", icon: "🎮", color: "#F59E0B" },
  { label: "Board game", icon: "🎲", color: "#10B981" },
  { label: "Book", icon: "📚", color: "#8B5CF6" },
];

export function ConceptQuickAdd() {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="relative flex min-h-[26rem] flex-col overflow-hidden bg-[var(--color-dark)] p-4">
      {/* Fake app content */}
      <div className="flex flex-col gap-3">
        <div className="h-4 w-1/2 rounded bg-[var(--color-mid)]/40" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-[var(--color-mid)]/20" />
          ))}
        </div>
      </div>

      {/* Week pill strip (always-on, Trakt style) */}
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 px-3 py-2">
          <Flame className="size-4 shrink-0 text-orange-400" aria-hidden />
          <span className="text-xs font-semibold text-[var(--color-lightest)]">4 day streak</span>
          <button
            type="button"
            className="ml-auto text-[11px] font-semibold text-[var(--btn-gradient-start)]"
            onClick={() => setSheetOpen(true)}
          >
            Details
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {[true, true, true, true, false, false, false].map((active, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-9 w-full items-center justify-center rounded-lg text-[10px] font-bold",
                  active
                    ? "bg-orange-500/25 text-orange-300"
                    : "bg-[var(--color-mid)]/15 text-[var(--color-light)]"
                )}
              >
                {["M", "T", "W", "T", "F", "S", "S"][i]}
              </span>
              {active && <span className="h-1 w-1 rounded-full bg-orange-400" />}
            </div>
          ))}
        </div>
      </div>

      {/* Quick add FAB */}
      <div className="absolute bottom-24 right-4">
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="actions"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={springSoft}
              className="mb-3 flex flex-col items-end gap-2"
            >
              {MEDIA_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className="flex items-center gap-2 rounded-full bg-[var(--color-darkest)] py-2 pl-2 pr-3 text-xs font-semibold text-[var(--color-lightest)] shadow-lg ring-1 ring-[var(--color-mid)]/40"
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                    style={{ background: `${a.color}33` }}
                  >
                    {a.icon}
                  </span>
                  {a.label}
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <button
          type="button"
          aria-label={open ? "Close quick add" : "Quick add"}
          className="btn-gradient flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
          onClick={() => setOpen((v) => !v)}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={open ? "x" : "plus"}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={springSoft}
            >
              {open ? <X className="size-6" aria-hidden /> : <Plus className="size-6" aria-hidden />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      {/* Bottom sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-black/50"
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={springSoft}
              className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-2xl border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-4"
            >
              <div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-mid)]" />
              <p className="text-sm font-bold text-[var(--color-lightest)]">This week</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[var(--color-darkest)]/50 p-3">
                  <p className="text-[10px] uppercase text-[var(--color-light)]">Logs</p>
                  <p className="text-lg font-bold text-[var(--color-lightest)]">12</p>
                </div>
                <div className="rounded-lg bg-[var(--color-darkest)]/50 p-3">
                  <p className="text-[10px] uppercase text-[var(--color-light)]">Hours</p>
                  <p className="text-lg font-bold text-[var(--color-lightest)]">6h 40m</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
