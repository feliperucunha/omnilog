import { useState } from "react";
import { Check, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS, MEDIA_META } from "../sandboxData";
import { Cover, SectionLabel, Stars } from "./kit";
import { ProgressRing } from "../SandboxPrimitives";

const ITEM = DEMO_ITEMS[0];
const META = MEDIA_META[ITEM.mediaType];

export function ItemHero() {
  const meta = MEDIA_META[ITEM.mediaType];
  return (
    <div className="flex min-h-[30rem] flex-col bg-[var(--color-dark)]">
      <div
        className="relative flex flex-col justify-end overflow-hidden px-4 pb-4 pt-10 sm:flex-row sm:items-end sm:gap-5"
        style={{ background: `linear-gradient(160deg, ${meta.from} 0%, #0b0b12 70%)` }}
      >
        <div className="flex gap-4 sm:items-end">
          <Cover item={ITEM} className="aspect-[2/3] w-28 shrink-0 rounded-xl sm:w-36 [&_span]:hidden shadow-xl" />
          <div className="flex max-w-sm flex-col gap-1.5">
            <span className="w-fit rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white">MOVIE · 2024</span>
            <h3 className="text-xl font-black leading-tight text-white">{ITEM.title}</h3>
            <div className="flex items-center gap-2">
              <Stars value={4} />
              <span className="text-xs text-white/80">7.8/10</span>
            </div>
            <div className="mt-1 flex gap-1.5">
              <button type="button" className="btn-gradient rounded-lg px-3 py-2 text-[11px] font-bold text-white">+ Log</button>
              <button type="button" className="rounded-lg border border-white/30 px-3 py-2 text-[11px] font-bold text-white">Review</button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 sm:ml-auto">
          <ProgressRing value={45} size={56} stroke={6}>
            <span className="text-[11px] font-bold text-white">45%</span>
          </ProgressRing>
          <div className="flex flex-col gap-0.5 text-[10px] text-white/80">
            <span className="font-semibold text-white">In progress</span>
            <span>Logged 3 times</span>
            <span>Last: Aug 3</span>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-3 p-4 sm:grid-cols-2">
        <SectionLabel>Facts</SectionLabel>
        <SectionLabel>Reviews</SectionLabel>
        <div className="flex flex-col gap-1 text-[11px] text-[var(--color-lightest)]">
          {[["Genre", "Sci-Fi"], ["Runtime", "2h 46m"], ["Cast", "Timothée C."], ["Logged", "3 times"]].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-[var(--color-mid)]/10 py-1">
              <span className="text-[var(--color-light)]">{k}</span>
              <span className="font-semibold sm:text-right">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-[var(--color-darkest)]/50 p-2 text-[10px] text-[var(--color-light)]">"A monumental adaptation." — reviewer</div>
          <div className="rounded-xl bg-[var(--color-darkest)]/50 p-2 text-[10px] text-[var(--color-light)]">"Loved the score." — reviewer</div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-[var(--color-mid)]/20 p-3 sm:hidden">
        <button type="button" className="btn-gradient flex-1 rounded-xl py-3 text-sm font-bold text-white">Update progress</button>
      </div>
    </div>
  );
}

export function ItemSplit() {
  const [mobileView, setMobileView] = useState<"about" | "mine">("about");
  return (
    <div className="flex min-h-[28rem] flex-col bg-[var(--color-dark)] p-4">
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:flex-1">
        <section className={cn("flex flex-col gap-2", mobileView !== "about" && "hidden sm:flex")}>
          <SectionLabel>About the media</SectionLabel>
          <Cover item={ITEM} className="w-20 [&_span]:hidden" />
          <div className="flex flex-col gap-1 text-[11px]">
            <p className="font-semibold text-[var(--color-lightest)]">{ITEM.title}</p>
            <p className="text-[var(--color-light)]">{META.label} · 2024 · sci-fi, drama</p>
            <p className="text-[var(--color-light)]">Directed by Denis Villeneuve. A mythic retelling of Frank Herbert's novel.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Sci-Fi", "Epic", "Book"].map((t) => (
              <span key={t} className="rounded-full bg-[var(--color-mid)]/20 px-2 py-0.5 text-[9px] text-[var(--color-lightest)]">{t}</span>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <div className="flex overflow-hidden rounded-lg border border-[var(--color-mid)]/30 sm:hidden">
            {(["about", "mine"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMobileView(v)}
                className={cn("flex-1 py-1.5 text-[10px] font-semibold", mobileView === v ? "bg-[var(--btn-gradient-start)]/20 text-white" : "text-[var(--color-light)]")}
              >
                {v === "about" ? "About" : "Your activity"}
              </button>
            ))}
          </div>
          <div className={cn("flex-col gap-2 sm:flex", mobileView === "mine" && "flex")}>
            <SectionLabel className="mt-1 sm:mt-0">Your log</SectionLabel>
            <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3 text-[11px]">
              <div className="flex items-center justify-between"><span className="text-[var(--color-light)]">Status</span><span className="font-semibold text-[var(--color-lightest)]">Watching</span></div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-light)]">Progress</span><span className="font-semibold text-[var(--color-lightest)]">45% · rewatched 2×</span></div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-light)]">First log</span><span className="font-semibold text-[var(--color-lightest)]">Aug 3</span></div>
              <div className="flex items-center justify-between"><span className="text-[var(--color-light)]">Rating</span><Stars value={4} /></div>
            </div>
            <SectionLabel>Friends / community</SectionLabel>
            <div className="flex items-center gap-2 text-[11px] text-[var(--color-light)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-mid)]/30 text-[9px] font-bold text-[var(--color-lightest)]">M</span>
              <span>2 friends logged this this month</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const EPISODES = [
  { n: "S2E1", t: "Severance", done: true },
  { n: "S2E2", t: "Severance", done: true },
  { n: "S2E3", t: "Severance", done: false },
  { n: "S2E4", t: "Severance", done: false },
];

/** Episodic progress logger — mirrors the app's real '+1 episode/chapter' increments. */
export function ItemProgress() {
  const [done, setDone] = useState<number[]>([0, 1]);
  const toggle = (i: number) => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <Cover item={DEMO_ITEMS[1]} className="aspect-video w-full !rounded-xl [&_span]:hidden md:max-w-xs" />
      <div className="flex flex-col gap-2 rounded-xl bg-[var(--color-darkest)]/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-light)]">Next episode</p>
          <p className="text-sm font-bold text-[var(--color-lightest)]">S2E5 · Ravaged</p>
          <p className="text-[10px] text-[var(--color-light)]">Ep 4 of 9 · this season</p>
        </div>
        <button type="button" className="btn-gradient flex items-center gap-1 rounded-lg px-3 py-2.5 text-xs font-bold text-white sm:shrink-0">
          <Play className="size-3" aria-hidden /> Log episode
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[var(--color-mid)]/20 p-3">
        <span className="text-xs font-semibold text-[var(--color-lightest)]">This season</span>
        <span className="flex items-center gap-2 text-[10px] text-[var(--color-light)]">
          {done.length} / {EPISODES.length}
          <span className="flex gap-1">
            {EPISODES.map((_, i) => (
              <span key={i} className={cn("h-2 w-2 rounded-full", i < done.length ? "bg-[var(--btn-gradient-start)]" : "bg-[var(--color-mid)]/30")} />
            ))}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {EPISODES.map((e, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={cn(
              "flex min-h-[44px] items-center gap-3 rounded-xl border p-2 text-left",
              done.includes(i) ? "border-[var(--color-mid)]/10 bg-[var(--color-darkest)]/60" : "border-[var(--color-mid)]/30"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                done.includes(i) ? "bg-emerald-500/25 text-emerald-300" : "bg-[var(--color-mid)]/30 text-[var(--color-lightest)]"
              )}
            >
              {done.includes(i) ? <Check className="size-3.5" aria-hidden /> : e.n.slice(-1)}
            </span>
            <span className="text-xs font-semibold text-[var(--color-lightest)]">{e.n} · {e.t}</span>
            <span className="ml-auto text-[10px] text-[var(--color-light)]">{done.includes(i) ? "Logged" : "Not yet"}</span>
          </button>
        ))}
        <button
          type="button"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--color-mid)]/30 text-[11px] font-bold text-[var(--btn-gradient-start)]"
        >
          Add a recent log (rewatch / backfill date)
        </button>
      </div>
    </div>
  );
}