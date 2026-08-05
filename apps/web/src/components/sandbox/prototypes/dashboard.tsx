import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, BarChart3, Calendar, Flame, Search, Star } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS, MEDIA_META } from "../sandboxData";
import { Chip, Cover, MockTopNav, SectionLabel, StatTile } from "./kit";

const STATS = [
  { label: "Total logs", value: "214" },
  { label: "Hours", value: "84h" },
  { label: "Streak", value: "7d" },
  { label: "This week", value: "12" },
  { label: "Avg ★", value: "7.8" },
];

const CATS = ["All", "Movies", "TV", "Games", "Books", "Board games"];

export function DashboardHub() {
  const [cat, setCat] = useState("All");
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="relative flex min-h-[26rem] flex-col gap-3 overflow-hidden bg-[var(--color-dark)] p-4">
      <MockTopNav right={<span className="text-xs font-semibold text-[var(--color-lightest)]">Felipe</span>} />

      {/* Level / milestone strip (real platform feature) */}
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)] text-[11px] font-black text-white">
          L7
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-[var(--color-lightest)]">Mile-High Logger</span>
            <span className="text-[var(--color-light)]">Movies · 12/25</span>
          </div>
          <div className="grid grid-cols-12 gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="h-1 rounded-full bg-[var(--btn-gradient-start)]" />
            ))}
          </div>
          <p className="text-[9px] text-[var(--color-light)]">Next: “Bookshelver” — read 10 books</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STATS.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {CATS.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {DEMO_ITEMS.map((it) => (
          <div
            key={it.id}
            className="group rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2"
          >
            <Cover item={it} className="mb-2" />
            <p className="truncate text-[11px] font-semibold text-[var(--color-lightest)]">{it.title}</p>
            <p className="text-[10px] text-[var(--color-light)]">
              {MEDIA_META[it.mediaType].label} · {it.logs} logs
            </p>
            <div className="mt-1.5 hidden items-center gap-1 group-hover:flex">
              <Chip active>+ Log</Chip>
              <Chip>Edit</Chip>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 right-4 z-10">
        <AnimatePresence>
          {addOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={springSoft}
              className="mb-2 flex flex-col gap-1 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)] p-2 text-[11px] font-semibold text-[var(--color-lightest)] shadow-xl"
            >
              <span className="rounded-md px-3 py-1.5 hover:bg-[var(--color-mid)]/20">Quick add movie</span>
              <span className="rounded-md px-3 py-1.5 hover:bg-[var(--color-mid)]/20">Quick add TV</span>
              <span className="rounded-md px-3 py-1.5 hover:bg-[var(--color-mid)]/20">Quick add book</span>
              <span className="rounded-md px-3 py-1.5 hover:bg-[var(--color-mid)]/20">Import board game collection</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          aria-label="Quick add"
          className="btn-gradient flex h-12 w-12 items-center justify-center rounded-2xl shadow-[0_10px_28px_rgba(0,0,0,0.5)]"
          onClick={() => setAddOpen((v) => !v)}
        >
          <Plus className="size-5 text-white" aria-hidden />
        </button>
      </div>
    </div>
  );
}

const LOGS = [
  { day: "Today", time: "12h 04m", rows: [
    { item: DEMO_ITEMS[0], meta: "Movie · ★ 4 · +1 log" },
    { item: DEMO_ITEMS[5], meta: "Book · ★ 3 · 40%" },
    { item: DEMO_ITEMS[1], meta: "TV · 2×4" },
  ]},
  { day: "Yesterday", time: "3h 12m", rows: [
    { item: DEMO_ITEMS[1], meta: "TV · 2×3" },
    { item: DEMO_ITEMS[3], meta: "Game · 1h 30m" },
  ]},
  { day: "Monday", time: "2h 40m", rows: [
    { item: DEMO_ITEMS[2], meta: "TV · 3×2" },
  ]},
];

export function DashboardLogbook() {
  const [view, setView] = useState<"timeline" | "month">("timeline");
  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <MockTopNav />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[var(--color-lightest)]">October</p>
          <p className="text-[10px] text-[var(--color-light)]">6 logs · 12h this month</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-mid)]/40 p-0.5">
          {(["timeline", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-semibold",
                view === v ? "bg-[var(--btn-gradient-start)]/20 text-white" : "text-[var(--color-light)]"
              )}
            >
              {v === "timeline" ? "Timeline" : "Month"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div
            key={i}
            className={cn(
              "flex h-8 items-center justify-center rounded-lg text-[10px] font-bold",
              i < 4 ? "bg-[var(--btn-gradient-start)]/20 text-white" : "bg-[var(--color-mid)]/15 text-[var(--color-light)]"
            )}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto">
        {LOGS.map((group) => (
          <div key={group.day} className="flex flex-col gap-1.5">
            <SectionLabel className="flex items-center justify-between">
              {group.day}
              <span className="font-medium normal-case">{group.time}</span>
            </SectionLabel>
            {group.rows.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2"
              >
                <Cover item={r.item} className="aspect-square w-9 rounded-md [&_span]:hidden" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">{r.item.title}</p>
                  <p className="text-[10px] text-[var(--color-light)]">{r.meta}</p>
                </div>
                <Star className="size-3 text-amber-400" aria-hidden />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-[var(--color-mid)]/20 pt-3">
        {[Flame, BarChart3, Calendar, Search].map((Icon, i) => (
          <Icon key={i} className={cn("size-4", i === 0 ? "text-orange-400" : "text-[var(--color-light)]")} aria-hidden />
        ))}
      </div>
    </div>
  );
}