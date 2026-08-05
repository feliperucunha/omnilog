import { useState } from "react";
import { Bell, Eye, MessageCircle, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS, itemGradient } from "../sandboxData";
import { Chip, Cover, SectionLabel } from "./kit";

const LISTING = { item: DEMO_ITEMS[0], price: 89, city: "São Paulo", cond: "Near new", ago: "3d" };

export function ListingGallery() {
  const [photo, setPhoto] = useState(0);
  return (
    <div className="flex min-h-[28rem] flex-col bg-[var(--color-dark)] p-4">
      <div className="flex gap-2 overflow-hidden rounded-2xl" style={{ background: itemGradient(LISTING.item) }}>
        {[0, 1, 2].map((i) => (
          <button key={i} type="button" onClick={() => setPhoto(i)} className={cn("flex h-44 flex-1 items-center justify-center text-4xl transition-opacity sm:h-56", photo !== i && "opacity-40")}>
            {["🎬", "📦", "🏷️"][i]}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-3 pt-3 sm:grid-cols-[1fr_14rem]">
        <div className="flex flex-col gap-1">
          <p className="text-base font-black text-[var(--color-lightest)]">{LISTING.item.title}</p>
          <p className="text-lg font-black text-[var(--btn-gradient-start)]">R$ {LISTING.price}</p>
          <p className="text-[11px] text-[var(--color-light)]">{LISTING.cond} · {LISTING.city} · {LISTING.ago}</p>
          <SectionLabel className="mt-3">Description</SectionLabel>
          <p className="text-[11px] leading-relaxed text-[var(--color-light)]">UHD Blu-ray, watched once. Box and inserts included. Ships fast.</p>
        </div>

        <aside className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-[var(--color-darkest)]/50 p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-mid)]/30 text-xs font-bold text-[var(--color-lightest)]">M</span>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-[var(--color-lightest)]">@maria</span>
              <span className="flex items-center gap-1 text-[9px] text-[var(--color-light)]"><Star className="size-3 fill-amber-400 text-amber-400" aria-hidden /> 4.8 · responds in 1h</span>
            </div>
          </div>
          <button type="button" className="btn-gradient flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white"><MessageCircle className="size-4" aria-hidden /> Chat with seller</button>
          <button type="button" className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-mid)]/40 py-2.5 text-xs font-semibold text-[var(--color-lightest)]"><Bell className="size-4" aria-hidden /> Save</button>
        </aside>
      </div>
    </div>
  );
}

export function ListingSeller() {
  const [follow, setFollow] = useState(false);
  return (
    <div className="flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--btn-gradient-start)] text-lg font-black text-white">M</span>
        <div className="flex flex-col">
          <p className="text-sm font-bold text-[var(--color-lightest)]">@maria <span className="flex items-center gap-1 text-[10px] font-normal text-[var(--color-light)]"><Star className="size-3 fill-amber-400 text-amber-400" aria-hidden /> 4.8 · 214 deals</span></p>
          <p className="text-[10px] text-[var(--color-light)]">Member since 2022 · replies in ~1h</p>
        </div>
        <button type="button" onClick={() => setFollow((f) => !f)} className={cn("ml-auto rounded-lg px-3 py-1.5 text-[11px] font-bold", follow ? "bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]" : "btn-gradient text-white")}>
          {follow ? "Following" : "Follow"}
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg text-3xl" style={{ background: itemGradient(LISTING.item) }}>🎬</div>
        <div className="flex flex-col">
          <p className="text-sm font-bold text-[var(--color-lightest)]">{LISTING.item.title}</p>
          <p className="text-sm font-black text-[var(--btn-gradient-start)]">R$ {LISTING.price}</p>
          <p className="text-[10px] text-[var(--color-light)]">{LISTING.cond} · {LISTING.city}</p>
        </div>
        <MessageCircle className="ml-auto size-5 text-[var(--color-light)]" aria-hidden />
      </div>

      <SectionLabel>More from @maria</SectionLabel>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DEMO_ITEMS.slice(1, 5).map((it) => (
          <div key={it.id} className="w-20 shrink-0">
            <Cover item={it} className="rounded-lg" />
            <p className="truncate text-[9px] text-[var(--color-light)]">R$ {[45, 120, 65, 240][DEMO_ITEMS.indexOf(it)]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListingManager() {
  const [tab, setTab] = useState("Active");
  const tabs = ["Active", "Pending", "Sold", "Draft"];
  const rows = [
    { item: DEMO_ITEMS[0], status: "Active", views: 120 },
    { item: DEMO_ITEMS[1], status: "Active", views: 34 },
    { item: DEMO_ITEMS[3], status: "Sold", views: 210 },
    { item: DEMO_ITEMS[5], status: "Draft", views: 0 },
  ];
  const shown = tab === "All" ? rows : rows.filter((r) => r.status === tab);
  return (
    <div className="flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--color-lightest)]">My shop</p>
        <span className="rounded-full bg-[var(--color-mid)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-light)]">2 active · 1 sold</span>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {tabs.map((t) => (
          <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {shown.map((r) => (
          <div key={r.item.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg text-xl" style={{ background: itemGradient(r.item) }}>🎬</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">{r.item.title}</p>
              <p className="flex items-center gap-1 text-[10px] text-[var(--color-light)]"><Eye className="size-3" aria-hidden /> {r.views} views</p>
            </div>
            {r.status === "Sold" ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-400">SOLD</span>
            ) : (
              <div className="flex gap-1">
                <button type="button" className="flex items-center gap-1 rounded-lg border border-[var(--color-mid)]/40 px-2 py-1 text-[9px] font-semibold text-[var(--color-light)]"><TrendingUp className="size-3" aria-hidden /> Bump</button>
                <button type="button" className="rounded-lg border border-[var(--color-mid)]/40 px-2 py-1 text-[9px] font-semibold text-[var(--color-light)]">Edit</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}