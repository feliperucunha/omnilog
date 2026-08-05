import { useState } from "react";
import { Check, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS } from "../sandboxData";
import { Cover, SectionLabel, StarsInput } from "./kit";

export function ReviewTemplate() {
  const [rating, setRating] = useState(0);
  const [verdict, setVerdict] = useState("");
  const [highlight, setHighlight] = useState("");
  const [audience, setAudience] = useState("");
  const it = DEMO_ITEMS[0];
  return (
    <div className="flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-3">
        <Cover item={it} className="aspect-square w-10 rounded-md [&_span]:hidden" />
        <div className="flex flex-col">
          <p className="text-xs font-bold text-[var(--color-lightest)]">Quick review · {it.title}</p>
          <StarsInput value={rating} onChange={setRating} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {[
          { label: "Verdict", value: verdict, set: setVerdict, ph: "Was it worth your time?" },
          { label: "Highlight", value: highlight, set: setHighlight, ph: "One moment that stuck with you…" },
          { label: "Who it's for", value: audience, set: setAudience, ph: "Fans of…" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <SectionLabel>{f.label}</SectionLabel>
            <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} className="rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 px-3 py-2.5 text-xs text-[var(--color-lightest)] outline-none placeholder:text-[var(--color-light)]" />
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2">
        <button type="button" className="rounded-lg border border-[var(--color-mid)]/40 px-3 py-2 text-[11px] font-semibold text-[var(--color-light)]">Write more</button>
        <button type="button" className="btn-gradient flex-1 rounded-xl py-2.5 text-sm font-bold text-white">Publish review</button>
      </div>
    </div>
  );
}

export function ReviewDrafts() {
  const [view, setView] = useState<"drafts" | "backlog">("drafts");
  const [done, setDone] = useState<string[]>([]);
  const drafts = [
    { item: DEMO_ITEMS[1], pct: 80, note: "Writing the ending" },
    { item: DEMO_ITEMS[0], pct: 25, note: "Stars only" },
    { item: DEMO_ITEMS[2], pct: 55, note: "Outline done" },
  ];
  const backlog = DEMO_ITEMS.slice(3, 7).filter((it) => !done.includes(it.id));
  return (
    <div className="flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-1 rounded-lg border border-[var(--color-mid)]/30 p-0.5">
        {(["drafts", "backlog"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={cn("flex-1 rounded-md py-1.5 text-[10px] font-semibold capitalize", view === v ? "bg-[var(--btn-gradient-start)]/20 text-white" : "text-[var(--color-light)]")}>
            {v} {v === "drafts" ? `(3)` : `(${backlog.length})`}
          </button>
        ))}
      </div>

      {view === "drafts" && (
        <div className="flex flex-col gap-2">
          {drafts.map((d) => (
            <div key={d.item.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2">
              <Cover item={d.item} className="aspect-square w-9 rounded-md [&_span]:hidden" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-[var(--color-lightest)]">{d.item.title}</p>
                <p className="text-[10px] text-[var(--color-light)]">{d.note}</p>
                <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-[var(--color-mid)]/30"><div className="h-full rounded-full bg-[var(--btn-gradient-start)]" style={{ width: `${d.pct}%` }} /></div>
              </div>
              <span className="text-[10px] font-bold text-[var(--btn-gradient-start)]">{d.pct}%</span>
            </div>
          ))}
        </div>
      )}

      {view === "backlog" && (
        <div className="flex flex-col gap-2">
          {backlog.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-[var(--color-light)]">All caught up! 🎉</p>
          ) : (
            backlog.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2">
                <Cover item={it} className="aspect-square w-9 rounded-md [&_span]:hidden" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-[var(--color-lightest)]">{it.title}</p>
                  <p className="text-[9px] text-[var(--color-light)]">Finished, no review yet</p>
                </div>
                <button type="button" onClick={() => setDone((d) => [...d, it.id])} className="rounded-lg px-2 py-1 text-[10px] font-semibold border border-[var(--color-mid)]/40 text-[var(--color-light)]">Rate +</button>
              </div>
            ))
          )}
        </div>
      )}

      {done.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300">
          <Check className="size-4" aria-hidden />
          <span className="flex items-center gap-1"><Save className="size-3" aria-hidden /> {done.length} review{done.length > 1 ? "s" : ""} saved to your feed</span></div>
      )}
    </div>
  );
}