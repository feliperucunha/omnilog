import { useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { DEMO_ITEMS } from "../sandboxData";
import { Chip, Cover, SectionLabel } from "./kit";

const ACTIVITY = [
  { who: "Felipe", what: "logged", item: DEMO_ITEMS[0], meta: "★ 4", ago: "2h" },
  { who: "Felipe", what: "finished", item: DEMO_ITEMS[1], meta: "8 episodes", ago: "1d" },
  { who: "Felipe", what: "rated a review", item: DEMO_ITEMS[5], meta: "★ 5", ago: "3d" },
  { who: "Felipe", what: "started", item: DEMO_ITEMS[3], meta: "2h played", ago: "5d" },
];

export function ProfileFeed() {
  const [statsOpen, setStatsOpen] = useState(false);
  return (
    <div className="flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--btn-gradient-start)] text-lg font-black text-white">F</span>
        <div className="flex flex-col">
          <p className="text-sm font-bold text-[var(--color-lightest)]">Felipe <span className="font-normal text-[var(--color-light)]">· @felipe</span></p>
          <p className="text-[11px] text-[var(--color-light)]">214 logs · ★ 7.8 avg</p>
        </div>
        <button type="button" className="ml-auto rounded-lg border border-[var(--color-mid)]/40 px-2.5 py-1 text-[10px] font-semibold text-[var(--color-light)]">✎ Edit</button>
      </div>

      <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_10rem]">
        <section className="flex flex-col gap-1.5">
          <SectionLabel>Activity</SectionLabel>
          {ACTIVITY.map((a, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2 text-[11px]">
              <Cover item={a.item} className="aspect-square w-9 shrink-0 rounded-md [&_span]:hidden" />
              <p className="min-w-0 flex-1 text-[var(--color-lightest)]">
                <span className="font-semibold">{a.who}</span> <span className="text-[var(--color-light)]">{a.what}</span> <span className="font-semibold">{a.item.title}</span>
              </p>
              <span className="shrink-0 text-[10px] text-[var(--color-light)]">{a.meta}</span>
              <span className="shrink-0 text-[9px] text-[var(--color-light)]">{a.ago}</span>
            </div>
          ))}
        </section>

        <aside className="flex flex-col gap-2 sm:sticky sm:top-0">
          <button type="button" onClick={() => setStatsOpen(true)} className="rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3 text-left">
            <SectionLabel>Stats</SectionLabel>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-lightest)]">
              <span>214 logs</span><span>84h</span><span>7d streak</span>
            </div>
            <span className="mt-1 block text-[9px] text-[var(--btn-gradient-start)]">Open stats →</span>
          </button>
          <div className="rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3">
            <SectionLabel>Badges</SectionLabel>
            <div className="mt-1 flex gap-1 text-lg">{"🏅🔥📖".split("").map((b, i) => <span key={i}>{b}</span>)}</div>
          </div>
        </aside>
      </div>

      {statsOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Close stats sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setStatsOpen(false)}
            className="absolute inset-0 z-10 bg-black/50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springSoft}
            className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 rounded-t-2xl border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-4"
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-mid)]" />
            <p className="text-sm font-bold text-[var(--color-lightest)]">Stats</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Logs", "214"], ["Hours", "84h"], ["Streak", "7d"]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-[var(--color-darkest)]/50 p-2">
                  <p className="text-[9px] uppercase text-[var(--color-light)]">{k}</p>
                  <p className="text-base font-bold text-[var(--color-lightest)]">{v}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

const TABS = ["All", "Movies", "TV", "Games", "Books"];

export function ProfileGrid() {
  const [tab, setTab] = useState("All");
  const [statsOpen, setStatsOpen] = useState(false);
  const items = tab === "All" ? DEMO_ITEMS : DEMO_ITEMS.filter((it) => MEDIA_FILTER[it.mediaType] === tab);
  return (
    <div className="relative flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--btn-gradient-start)] text-base font-black text-white">F</span>
        <div className="flex flex-col">
          <p className="text-sm font-bold text-[var(--color-lightest)]">Felipe</p>
          <p className="text-[10px] text-[var(--color-light)]">@felipe · 214 logs</p>
        </div>
        <button type="button" onClick={() => setStatsOpen(true)} className="ml-auto rounded-lg border border-[var(--color-mid)]/40 px-2.5 py-1 text-[10px] font-semibold text-[var(--color-light)]">Stats</button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {items.map((it) => (
          <div key={it.id} className="group relative">
            <Cover item={it} />
            <Star className="absolute right-1 top-1 size-3 fill-amber-400 text-amber-400 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
          </div>
        ))}
      </div>

      {statsOpen && (
        <>
          <button type="button" aria-label="Close" onClick={() => setStatsOpen(false)} className="absolute inset-0 z-10 bg-black/50" />
          <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 rounded-t-2xl border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-4">
            <div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-mid)]" />
            <p className="text-sm font-bold text-[var(--color-lightest)]">Stats</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Logs", "214"], ["Hours", "84h"], ["Streak", "7d"]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-[var(--color-darkest)]/50 p-2">
                  <p className="text-[9px] uppercase text-[var(--color-light)]">{k}</p>
                  <p className="text-base font-bold text-[var(--color-lightest)]">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const MEDIA_FILTER: Record<string, string> = {
  movies: "Movies",
  tv: "TV",
  games: "Games",
  boardgames: "Games",
  books: "Books",
};