import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS, MEDIA_META } from "../sandboxData";
import { Chip, Cover, MockDock, MockTopNav, SectionLabel } from "./kit";

const TYPES = ["Movie", "TV Show", "Game", "Board game", "Book"];

export function QuickAddNav() {
  const [sheet, setSheet] = useState(false);
  const [type, setType] = useState("Movie");
  return (
    <div className="relative flex min-h-[28rem] flex-col bg-[var(--color-dark)] p-4">
      <MockTopNav right={<button type="button" aria-label="Add" onClick={() => setSheet(true)} className="btn-gradient flex h-7 w-7 items-center justify-center rounded-lg text-white"><Plus className="size-4" aria-hidden /></button>} />

      <div className="flex flex-1 flex-col gap-2 rounded-2xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3">
        <p className="text-[11px] font-bold text-[var(--color-lightest)]">What you're logging</p>
        {DEMO_ITEMS.slice(0, 3).map((it) => (
          <div key={it.id} className="flex items-center gap-2 text-[10px] text-[var(--color-light)]">
            <Cover item={it} className="aspect-square w-7 rounded-md [&_span]:hidden" />
            <span>{it.title}</span>
            <span className="ml-auto">{MEDIA_META[it.mediaType].label}</span>
          </div>
        ))}
      </div>

      <MockDock onAdd={() => setSheet(true)} />

      <AnimatePresence>
        {sheet && (
          <>
            <motion.button type="button" aria-label="Close" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 bg-black/50" onClick={() => setSheet(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={springSoft} className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-4">
              <div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-mid)]" />
              <p className="mb-2 text-sm font-bold text-[var(--color-lightest)]">Quick add</p>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map((t) => (
                  <Chip key={t} active={type === t} onClick={() => setType(t)}>{t}</Chip>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-3 text-[10px] text-[var(--color-light)]">
                The scoped {type.toLowerCase()} form opens here next.
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function QuickAddContext() {
  const [logged, setLogged] = useState<string[]>([]);
  const toggle = (id: string) => setLogged((l) => (l.includes(id) ? l : [...l, id]));
  return (
    <div className="flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <MockTopNav />

      <SectionLabel>Search results</SectionLabel>
      <div className="flex flex-col gap-1.5">
        {DEMO_ITEMS.slice(0, 3).map((it) => (
          <div key={it.id} className="flex items-center gap-2.5 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2">
            <Cover item={it} className="aspect-square w-9 rounded-md [&_span]:hidden" />
            <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--color-lightest)]">{it.title}</p>
            <button type="button" onClick={() => toggle(it.id)} className={cn("rounded-lg px-2.5 py-1 text-[10px] font-bold", logged.includes(it.id) ? "bg-emerald-500/20 text-emerald-300" : "btn-gradient text-white")}>
              {logged.includes(it.id) ? "✓" : "+ Log"}
            </button>
          </div>
        ))}
      </div>

      <SectionLabel>Empty state</SectionLabel>
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--color-mid)]/40 p-4 text-center">
        <span className="text-2xl">🗂️</span>
        <p className="text-xs text-[var(--color-light)]">No {`'Books'`} yet. Start yours.</p>
        <button type="button" className="btn-gradient w-full max-w-[12rem] rounded-xl py-2 text-xs font-bold text-white">+ Log your first book</button>
      </div>
    </div>
  );
}