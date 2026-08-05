import { useState } from "react";
import { Bell, MapPin, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS, MEDIA_META, itemGradient } from "../sandboxData";
import { Chip } from "./kit";

const LISTINGS = DEMO_ITEMS.map((it, i) => ({
  id: it.id,
  item: it,
  price: [89, 120, 65, 240, 45, 130, 55, 320][i],
  city: ["São Paulo", "Rio", "Curitiba", "BH", "POA", "Recife", "SP", "Campinas"][i],
  ago: ["3d", "1w", "2h", "5d", "2w", "1d", "4d", "6h"][i],
  cond: ["Near new", "Like new", "Good", "Fair", "Like new", "Good", "Near new", "New"][i],
}));

export function MarketCards() {
  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LISTINGS.map((l) => (
          <div key={l.id} className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40">
            <div className="relative aspect-square overflow-hidden" style={{ background: itemGradient(l.item) }}>
              <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-70">{["🎬","📺","🎮","🎲","📚","🎬","🎮","🎲"][l.id.charCodeAt(1) % 8]}</div>
              <span className="absolute left-1.5 top-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold text-white">{l.cond}</span>
            </div>
            <div className="flex flex-col gap-0.5 p-2">
              <p className="truncate text-[11px] font-bold text-[var(--color-lightest)]">{l.item.title}</p>
              <p className="text-sm font-black text-[var(--btn-gradient-start)]">R$ {l.price}</p>
              <p className="flex items-center gap-1 text-[9px] text-[var(--color-light)]"><MapPin className="size-3" aria-hidden /> {l.city} · {l.ago}</p>
              <button type="button" className="mt-1 hidden items-center justify-center gap-1 rounded-lg border border-[var(--color-mid)]/40 py-1 text-[10px] font-semibold text-[var(--color-lightest)] group-hover:flex">
                <MessageCircle className="size-3" aria-hidden /> Chat
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketRows() {
  const [tab, setTab] = useState("Active");
  const tabs = ["Active", "Sold", "Saved"];
  const shown = tab === "Sold" ? LISTINGS.slice(3, 5) : LISTINGS.slice(0, 5);
  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--color-lightest)]">Marketplace</p>
        <span className="rounded-full bg-[var(--color-mid)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-light)]">{tab === "Active" ? "6 active · 2 saved" : "3 sold"}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {tabs.map((t) => (
          <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {shown.map((l) => (
          <div key={l.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl" style={{ background: itemGradient(l.item) }}>{["🎬","📺","🎮","🎲","📚"][l.item.mediaType === "movies" ? 0 : l.item.mediaType === "tv" ? 1 : l.item.mediaType === "games" ? 2 : l.item.mediaType === "boardgames" ? 3 : 4]}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">{l.item.title} · {MEDIA_META[l.item.mediaType].label}</p>
              <p className="flex items-center gap-1 text-[10px] text-[var(--color-light)]"><span className="font-bold text-[var(--btn-gradient-start)]">R$ {l.price}</span> · {l.city} · {l.ago}</p>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", tab === "Sold" ? "bg-emerald-500/15 text-emerald-400" : tab === "Saved" ? "bg-amber-500/15 text-amber-400" : "bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]")}>
              {tab === "Sold" ? "SOLD" : tab === "Saved" ? "SAVED" : "ACTIVE"}
            </span>
            <MessageCircle className="size-4 text-[var(--color-light)]" aria-hidden />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketMap() {
  const [view, setView] = useState<"list" | "map">("map");
  return (
    <div className="relative flex min-h-[26rem] flex-col bg-[var(--color-dark)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--color-lightest)]">Near you</p>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-mid)]/40 p-0.5">
          {(["list", "map"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize", view === v ? "bg-[var(--btn-gradient-start)]/20 text-white" : "text-[var(--color-light)]")}>{v}</button>
          ))}
        </div>
      </div>

      {view === "map" ? (
        <div className="relative mt-3 flex-1 overflow-hidden rounded-2xl border border-[var(--color-mid)]/20">
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 20% 30%, #1c1c28, #0b0b12 70%)" }} />
          {[
            { x: "18%", y: "30%", n: "🎬 R$ 89" },
            { x: "60%", y: "22%", n: "📚 R$ 45" },
            { x: "40%", y: "62%", n: "🎮 R$ 240" },
            { x: "78%", y: "55%", n: "🎲 R$ 65" },
          ].map((p, i) => (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: p.x, top: p.y }}>
              <div className="flex items-center gap-1 rounded-full bg-[var(--color-darkest)] px-2 py-1 text-[9px] font-semibold text-[var(--color-lightest)] shadow-lg">{p.n}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {LISTINGS.slice(0, 4).map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-lg" style={{ background: itemGradient(l.item) }}>🎬</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">{l.item.title}</p>
                <p className="text-[10px] text-[var(--color-light)]"><span className="font-bold text-[var(--btn-gradient-start)]">R$ {l.price}</span> · {l.city}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2.5">
        <div className="flex items-center gap-2 text-[11px]">
          <Bell className="size-4 text-[var(--btn-gradient-start)]" aria-hidden />
          <span className="font-semibold text-[var(--color-lightest)]">Saved search: “dune”</span>
        </div>
        <span className="text-[9px] text-[var(--color-light)]">3 new this week</span>
      </div>
    </div>
  );
}