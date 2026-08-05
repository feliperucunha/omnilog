import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Search as SearchIcon, Check } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS } from "../sandboxData";
import { Cover, SectionLabel, Stars } from "./kit";

export function LandingTour() {
  const [shot, setShot] = useState(0);
  const shots = [
    { label: "Logs", h: "Your whole collection, logged", desc: "Movies, shows, games, books, board games.", icon: "📚" },
    { label: "Progress", h: "Episode-by-episode tracking", desc: "Log +1 episode or chapter in one tap.", icon: "⏭️" },
    { label: "Stats", h: "Momentum you can see", desc: "Streaks, genres, hours and your year in review.", icon: "📊" },
  ];
  const cur = shots[shot];
  return (
    <div className="flex min-h-[30rem] flex-col gap-4 bg-[var(--color-dark)] p-5">
      <div className="mx-auto max-w-sm text-center">
        <h3 className="text-xl font-black text-[var(--color-lightest)]">Log everything you love</h3>
        <p className="mt-1 text-[11px] text-[var(--color-light)]">One place for movies, shows, games, books and board games.</p>
        <div className="mt-3 flex justify-center gap-2">
          <button type="button" className="btn-gradient rounded-lg px-3 py-2 text-xs font-bold text-white">Try free</button>
          <button type="button" className="rounded-lg border border-[var(--color-mid)]/40 px-3 py-2 text-xs font-semibold text-[var(--color-light)]">See it live</button>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--color-mid)]/30">
        <div className="flex items-center gap-2 border-b border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/60 px-3 py-2">
          {shots.map((s, i) => (
            <button key={s.label} type="button" onClick={() => setShot(i)} className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", i === shot ? "bg-[var(--btn-gradient-start)]/20 text-white" : "text-[var(--color-light)]")}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex aspect-[16/9] items-center justify-center" style={{ background: "linear-gradient(140deg, #1c1c28, #0b0b12)" }}>
          <div className={cn("px-10 text-6xl", shot === 0 && "animate-pulse")}>{cur.icon}</div>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-3">
          <button type="button" onClick={() => setShot((s) => Math.max(0, s - 1))} aria-label="Prev" className="rounded-full bg-black/50 p-2 text-white"><ArrowLeft className="size-4" aria-hidden /></button>
          <button type="button" onClick={() => setShot((s) => Math.min(2, s + 1))} aria-label="Next" className="rounded-full bg-black/50 p-2 text-white"><ArrowRight className="size-4" aria-hidden /></button>
        </div>
      </div>

      <div className="mx-auto max-w-sm text-center">
        <p className="text-sm font-bold text-[var(--color-lightest)]">{cur.h}</p>
        <p className="text-[11px] text-[var(--color-light)]">{cur.desc}</p>
      </div>
    </div>
  );
}

export function LandingDemo() {
  const [q, setQ] = useState("");
  const [logged, setLogged] = useState<string[]>([]);
  const results = DEMO_ITEMS.filter((it) => it.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex min-h-[30rem] flex-col items-center gap-3 bg-[var(--color-dark)] p-5">
      <SectionLabel>Try it right here — no account needed</SectionLabel>
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]">
        <div className="flex items-center gap-2 border-b border-[var(--color-mid)]/20 px-3 py-2">
          <SearchIcon className="size-4 text-[var(--color-light)]" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 'dune'…" className="flex-1 bg-transparent text-xs text-[var(--color-lightest)] outline-none placeholder:text-[var(--color-light)]" />
        </div>
        <div className="flex flex-col gap-1 p-2">
          {results.slice(0, 4).map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-lg bg-[var(--color-darkest)]/50 p-2">
              <Cover item={it} className="aspect-square w-9 rounded-md [&_span]:hidden" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-[var(--color-lightest)]">{it.title}</p>
                <Stars value={3} />
              </div>
              <button type="button" onClick={() => setLogged((l) => (l.includes(it.id) ? l : [...l, it.id]))} className={cn("rounded-lg px-2.5 py-1 text-[10px] font-bold", logged.includes(it.id) ? "bg-emerald-500/20 text-emerald-300" : "btn-gradient text-white")}>
                {logged.includes(it.id) ? <span className="flex items-center gap-1"><Check className="size-3" aria-hidden /> Logged</span> : "+ Log"}
              </button>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-[var(--color-light)]">{logged.length ? `Nice — you logged ${logged.length} item${logged.length > 1 ? "s" : ""}!` : "Sample data, no signup. Tap + Log."}</p>
      <button type="button" className="btn-gradient rounded-xl px-5 py-2 text-sm font-bold text-white">Create free account</button>
    </div>
  );
}

const BEATS = [
  { n: "01", title: "You consume a lot.", desc: "Movies, shows, games, books — it piles up and disappears.", pc: "🎧" },
  { n: "02", title: "Log it all in seconds.", desc: "Tap +, find, done. Your history is safe.", pc: "➕" },
  { n: "03", title: "Progress that feels good.", desc: "Streaks, hours and a year in review.", pc: "📈" },
  { n: "04", title: "Join the community.", desc: "Share, follow, and trade with others.", pc: "🤝" },
];

export function LandingStory() {
  const [beat, setBeat] = useState(0);
  return (
    <div className="relative flex min-h-[30rem] flex-col bg-[var(--color-dark)] p-5">
      <div className="flex flex-1 flex-col justify-center gap-3 sm:flex-row sm:items-center sm:gap-8">
        <AnimatePresence mode="wait">
          <motion.div key={beat} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={springSoft} className="flex max-w-xs flex-col gap-2">
            <span className="text-4xl">{BEATS[beat].pc}</span>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--btn-gradient-start)]">Beat {BEATS[beat].n}</p>
            <h3 className="text-xl font-black text-[var(--color-lightest)]">{BEATS[beat].title}</h3>
            <p className="text-[11px] text-[var(--color-light)]">{BEATS[beat].desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        {BEATS.map((b, i) => (
          <button key={b.n} type="button" aria-label={`Beat ${i + 1}`} onClick={() => setBeat(i)} className={cn("h-1.5 rounded-full transition-all", i === beat ? "w-6 bg-[var(--btn-gradient-start)]" : "w-1.5 bg-[var(--color-mid)]")} />
        ))}
      </div>
      {beat === 3 && (
        <button type="button" className="btn-gradient mx-auto mt-4 rounded-xl px-5 py-2 text-sm font-bold text-white">Start free</button>
      )}
    </div>
  );
}