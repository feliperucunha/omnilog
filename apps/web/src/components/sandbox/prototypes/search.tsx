import { useMemo, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { DEMO_ITEMS, MEDIA_META } from "../sandboxData";
import { Chip, Cover, Rail, SectionLabel } from "./kit";

const CATALOG = [
  ...DEMO_ITEMS,
  { id: "d1", title: "Dune (1984)", mediaType: "movies", logs: 1 },
  { id: "d2", title: "Dune: House Atreides", mediaType: "books", logs: 0 },
  { id: "d3", title: "Dune: Imperium", mediaType: "boardgames", logs: 0 },
] as (typeof DEMO_ITEMS)[number][];

function match(t: string, q: string) {
  return t.toLowerCase().includes(q.toLowerCase());
}

export function SearchQuick() {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const res = CATALOG.filter((it) => match(it.title, q));
  const groups = useMemo(() => {
    const g: Record<string, (typeof CATALOG)[number][]> = {};
    res.forEach((it) => {
      (g[it.mediaType] ??= []).push(it);
    });
    return g;
  }, [res]);

  return (
    <div className="flex min-h-[26rem] flex-col bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 py-2.5">
        <SearchIcon className="size-4 text-[var(--color-light)]" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search anything…"
          className="flex-1 bg-transparent text-sm text-[var(--color-lightest)] outline-none placeholder:text-[var(--color-light)]"
        />
        {q ? (
          <button type="button" onClick={() => setQ("")} aria-label="Clear"><X className="size-3.5 text-[var(--color-light)]" aria-hidden /></button>
        ) : (
          <kbd className="rounded border border-[var(--color-mid)]/40 px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-light)]">/</kbd>
        )}
      </div>

      {focused && (
        <div className="mt-2 flex flex-col overflow-hidden rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]">
          {q === "" ? (
            <div className="flex flex-col gap-2 p-3">
              <SectionLabel>Recent</SectionLabel>
              {["Severance", "Dune: Part Two", "The Bear"].map((s) => (
                <button key={s} type="button" onClick={() => setQ(s)} className="text-left text-xs text-[var(--color-lightest)]">{s}</button>
              ))}
            </div>
          ) : res.length === 0 ? (
            <p className="p-3 text-xs text-[var(--color-light)]">No results for “{q}”.</p>
          ) : (
            <div className="flex max-h-56 flex-col overflow-y-auto p-1">
              {Object.entries(groups).map(([type, items]) => (
                <div key={type} className="flex flex-col py-1">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase text-[var(--color-light)]">{MEDIA_META[type].label}</p>
                  {items.map((it) => (
                    <button key={it.id} type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--color-mid)]/20">
                      <Cover item={it} className="aspect-square w-7 rounded-md [&_span]:hidden" />
                      <span className="text-xs text-[var(--color-lightest)]">{it.title}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 border-t border-[var(--color-mid)]/20 px-3 py-1.5 text-[9px] text-[var(--color-light)]">
            <kbd className="rounded border border-[var(--color-mid)]/40 px-1">↑↓</kbd> to move
            <kbd className="rounded border border-[var(--color-mid)]/40 px-1">↵</kbd> to open
          </div>
        </div>
      )}
    </div>
  );
}

const RAIL_ORDER: (keyof typeof MEDIA_META)[] = ["movies", "tv", "games", "books"];

export function SearchBrowse() {
  const [cat, setCat] = useState("movies");
  const items = DEMO_ITEMS.filter((it) => it.mediaType === cat).concat(DEMO_ITEMS.filter((it) => it.mediaType !== cat));
  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {RAIL_ORDER.map((k) => (
          <Chip key={k} active={cat === k} onClick={() => setCat(k)}>{MEDIA_META[k].label}s</Chip>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Popular this month</SectionLabel>
          <button type="button" className="text-[10px] font-semibold text-[var(--btn-gradient-start)]">See all →</button>
        </div>
        <Rail items={items.slice(0, 6)} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Trending (last 7 days)</SectionLabel>
          <button type="button" className="text-[10px] font-semibold text-[var(--btn-gradient-start)]">See all →</button>
        </div>
        <Rail items={[...items].reverse().slice(0, 6)} />
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>New & recent</SectionLabel>
        <Rail items={DEMO_ITEMS.slice(2, 8)} />
      </section>

      <div className="flex flex-wrap gap-1.5">
        {["2024", "Sci-Fi", "4K", "Anime", "Co-op"].map((f) => (
          <Chip key={f}>{f}</Chip>
        ))}
      </div>
    </div>
  );
}

const GROUPS: (keyof typeof MEDIA_META)[] = ["movies", "books", "games", "boardgames"];

export function SearchGrouped() {
  const [type, setType] = useState<"all" | (typeof GROUPS)[number]>("all");
  const q = "dune";
  const scoped = CATALOG.filter((it) => match(it.title, q));
  const shown = type === "all" ? scoped : scoped.filter((it) => it.mediaType === type);
  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 py-2.5">
        <SearchIcon className="size-4 text-[var(--color-light)]" aria-hidden />
        <span className="text-sm text-[var(--color-lightest)]">{q}</span>
        <span className="ml-auto text-[10px] text-[var(--color-light)]">{scoped.length} results</span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <Chip active={type === "all"} onClick={() => setType("all")}>All ({scoped.length})</Chip>
        {GROUPS.map((g) => {
          const n = scoped.filter((it) => it.mediaType === g).length;
          return <Chip key={g} active={type === g} onClick={() => setType(g)}>{MEDIA_META[g].label} ({n})</Chip>;
        })}
      </div>

      <div className="flex flex-col gap-2">
        {shown.map((it) => (
          <div key={it.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2">
            <Cover item={it} className="aspect-square w-10 rounded-md [&_span]:hidden" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">{it.title}</p>
              <p className="text-[10px] text-[var(--color-light)]">{MEDIA_META[it.mediaType].label} · {it.logs ? `${it.logs} logs` : "not logged"}</p>
            </div>
            <button type="button" className="btn-gradient rounded-md px-2.5 py-1 text-[10px] font-semibold text-white">+ Log</button>
          </div>
        ))}
      </div>
    </div>
  );
}