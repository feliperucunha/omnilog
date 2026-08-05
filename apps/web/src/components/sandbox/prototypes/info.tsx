import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, HelpCircle, Search as SearchIcon, ShieldCheck } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { Chip, SectionLabel } from "./kit";

const TABS = ["All", "Getting started", "Billing", "Account", "Data"];
const FAQS = [
  { q: "Why am I limited to 500 logs?", a: "Free accounts can log up to 500 items. Pro removes the limit.", t: "Billing" },
  { q: "How do I export my data?", a: "Open Settings → Data → Export and choose CSV or XLSX.", t: "Data" },
  { q: "What is the activity calendar?", a: "A per-day heatmap of all your logged activity.", t: "Getting started" },
  { q: "How do I add a board game match?", a: "Log a board game, then expand 'Match details' for players and scores.", t: "Getting started" },
];

export function InfoFaq() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const filtered = FAQS.filter((f) => (tab === "All" || f.t === tab) && f.q.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 py-2.5">
        <SearchIcon className="size-4 text-[var(--color-light)]" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions…" className="flex-1 bg-transparent text-sm text-[var(--color-lightest)] outline-none placeholder:text-[var(--color-light)]" />
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {TABS.map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}
      </div>
      <div className="flex flex-col gap-1.5">
        {filtered.map((f) => {
          const isOpen = open === f.q;
          return (
            <div key={f.q} className="overflow-hidden rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40">
              <button type="button" onClick={() => setOpen(isOpen ? null : f.q)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                <span className="flex-1 text-xs font-semibold text-[var(--color-lightest)]">{f.q}</span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={springSoft}><ChevronDown className="size-4 text-[var(--color-light)]" aria-hidden /></motion.span>
              </button>
              <AnimatePresence>{isOpen && <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden"><p className="border-t border-[var(--color-mid)]/10 px-3 py-2 text-[11px] text-[var(--color-light)]">{f.a}</p></motion.div>}</AnimatePresence>
            </div>
          );
        })}
      </div>
      <div className="mt-auto flex items-center justify-between rounded-xl bg-[var(--btn-gradient-start)]/10 px-3 py-2.5 text-[10px]">
        <span className="text-[var(--color-light)]">Still stuck?</span>
        <button type="button" className="font-semibold text-[var(--btn-gradient-start)]">Contact support →</button>
      </div>
    </div>
  );
}

export function InfoContext() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(0);
  const cards = [
    { t: "How do I log a board game match?", body: "Open the game → Match → Add. Set players, scores and winner.", "more": "Full guide" },
    { t: "What are backlogs?", body: "Items you marked as 'want to log' — keep them in your Backlog status.", "more": "Open full FAQ" },
    { t: "How do streaks work?", body: "A streak resets if you go 7 days without a log.", "more": "More" },
  ];
  const c = cards[topic];
  return (
    <div className="relative flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <SectionLabel>Market · listing detail</SectionLabel>
      <div className="flex-1 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3">
        <p className="text-xs font-bold text-[var(--color-lightest)]">Dune — listing page</p>
        <div className="mt-3 flex h-24 items-center justify-center rounded-lg bg-[var(--color-mid)]/20 text-[10px] text-[var(--color-light)]">Listing content…</div>
      </div>

      <button type="button" onClick={() => setOpen((v) => !v)} className="z-20 flex items-center gap-1 self-start rounded-full border border-[var(--color-mid)]/40 px-3 py-1.5 text-[10px] font-semibold text-[var(--color-light)]">
        <HelpCircle className="size-3.5" aria-hidden /> Help for this page
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={springSoft} className="relative z-30 flex flex-col gap-2 rounded-2xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-4 shadow-2xl">
            <p className="text-[11px] font-bold text-[var(--color-lightest)]">{c.t}</p>
            <p className="text-[11px] text-[var(--color-light)]">{c.body}</p>
            <div className="flex items-center justify-between">
              <span className="flex gap-1">
                {cards.map((_, i) => (
                  <button key={i} type="button" aria-label={`Tip ${i + 1}`} onClick={() => setTopic(i)} className={cn("h-1.5 w-4 rounded-full", i === topic ? "bg-[var(--btn-gradient-start)]" : "bg-[var(--color-mid)]/30")} />
                ))}
              </span>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-[var(--btn-gradient-start)] px-3 py-1 text-[10px] font-bold text-white">Open full FAQ</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function InfoTrust() {
  const items = [
    { t: "Your data & export", d: "Own everything. Export any time.", Icon: ShieldCheck },
    { t: "Privacy in plain terms", d: "What we store and why.", Icon: ShieldCheck },
    { t: "Terms & conditions", d: "The rules of the road.", Icon: ShieldCheck },
    { t: "Plans & billing", d: "Pricing, renewals and refunds.", Icon: ShieldCheck },
  ];
  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <p className="text-sm font-black text-[var(--color-lightest)]">Trust center</p>
      <p className="text-[11px] text-[var(--color-light)]">Everything about your data, privacy and account — no legalese.</p>
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <button key={it.t} type="button" className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400"><it.Icon className="size-4" aria-hidden /></span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[var(--color-lightest)]">{it.t}</span>
              <span className="text-[10px] text-[var(--color-light)]">{it.d}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-auto rounded-xl bg-[var(--color-darkest)]/50 p-3 text-[10px] text-[var(--color-light)]">
        <span className="font-semibold text-[var(--color-lightest)]">EU data rights:</span> you can view, export or delete everything — just ask.
      </div>
    </div>
  );
}