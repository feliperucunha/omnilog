import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronDown, List, Rows3, Star } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS, MEDIA_META } from "../sandboxData";
import { Chip, Cover, Meter, MockDock, Stars } from "./kit";

const STATUS = ["All", "Watching", "Completed", "Backlog"];

export function LogsPosters() {
  const [view, setView] = useState<"grid" | "list" | "compact">("grid");
  const [status, setStatus] = useState("All");
  const [active, setActive] = useState<string | null>(null);

  const items = status === "All" ? DEMO_ITEMS : DEMO_ITEMS.slice(0, 5);
  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {STATUS.map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-mid)]/40 p-0.5">
          {([["grid", Rows3], ["list", List], ["compact", ChevronDown]] as const).map(([v, Icon]) => (
            <button
              key={v}
              type="button"
              aria-label={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md p-1.5",
                view === v ? "bg-[var(--btn-gradient-start)]/20 text-white" : "text-[var(--color-light)]"
              )}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      </div>

      {view === "grid" && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setActive(it.id)}
              className="group relative"
            >
              <Cover item={it} />
              <span className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[9px] font-bold text-amber-300">
                ★ {it.logs}
              </span>
              <span className="absolute inset-x-0 bottom-0 hidden h-1/3 items-end justify-center gap-1 bg-gradient-to-t from-black/80 to-transparent pb-1 group-hover:flex">
                <Chip active className="text-[9px]">+ Log</Chip>
                <Chip className="text-[9px]">Edit</Chip>
              </span>
            </button>
          ))}
        </div>
      )}

      {view === "list" && (
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2">
              <Cover item={it} className="aspect-square w-12 [&_span]:hidden" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">{it.title}</p>
                <p className="text-[10px] text-[var(--color-light)]">{MEDIA_META[it.mediaType].label} · {it.logs}%</p>
                <Meter value={it.logs * 4} className="mt-1" />
              </div>
              <Stars value={3 + (it.logs % 3)} />
              <button type="button" onClick={() => setActive(it.id)} className="btn-gradient rounded-md px-2.5 py-1 text-[10px] font-semibold text-white">
                + Log
              </button>
            </div>
          ))}
        </div>
      )}

      {view === "compact" && (
        <div className="flex flex-col text-[11px]">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between border-b border-[var(--color-mid)]/10 py-2">
              <span className="truncate text-[var(--color-lightest)]">{it.title}</span>
              <div className="flex items-center gap-2 text-[10px] text-[var(--color-light)]">
                <span>{it.logs}%</span>
                <Meter value={it.logs * 4} className="w-14" />
                <Star className="size-3 text-amber-400" aria-hidden />
              </div>
            </div>
          ))}
        </div>
      )}

      <MockDock />

      <AnimatePresence>
        {active && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-black/50" aria-label="Close"
              onClick={() => setActive(null)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={springSoft}
              className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 rounded-t-2xl border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-4"
            >
              <div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-mid)]" />
              <p className="text-sm font-bold text-[var(--color-lightest)]">Quick actions</p>
              {["Edit progress", "Mark complete", "Add rating", "Remove"].map((a) => (
                <button key={a} type="button" className="rounded-lg bg-[var(--color-darkest)]/50 px-3 py-2 text-left text-xs font-semibold text-[var(--color-lightest)]">
                  {a}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

type SortKey = "title" | "progress" | "date" | "rewatch";

const TABLE_DATA = DEMO_ITEMS.map((it) => ({
  item: it,
  progress: it.logs * 4,
  date: `Aug ${(it.logs % 20) + 1}`,
  rewatch: it.logs % 3,
  rating: it.logs % 5 + 3,
}));

export function LogsTable() {
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [asc, setAsc] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  const sorted = [...TABLE_DATA].sort((a, b) => {
    const ka = sortKey === "title" ? a.item.title : String(a[sortKey]);
    const kb = sortKey === "title" ? b.item.title : String(b[sortKey]);
    return (ka < kb ? -1 : ka > kb ? 1 : 0) * (asc ? 1 : -1);
  });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setAsc((v) => !v);
    else { setSortKey(k); setAsc(true); }
  };
  const toggleSel = (id: string) =>
    setSelected((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const Head = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-2 py-1.5 text-left">
      <button type="button" onClick={() => toggleSort(k)} className="flex items-center gap-1 font-semibold text-[var(--color-light)]">
        {children} {sortKey === k ? (asc ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />) : null}
      </button>
    </th>
  );

  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-[var(--color-lightest)]">My log</p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--btn-gradient-start)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--btn-gradient-start)]">
            {selected.length} selected
          </span>
          {selected.length > 0 && <Chip active>Bulk edit</Chip>}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-mid)]/20">
        <table className="w-full min-w-[480px] text-left text-[11px]">
          <thead className="bg-[var(--color-darkest)]/50">
            <tr className="text-[10px] uppercase tracking-wide">
              <th className="w-6 px-2 py-1.5"><input type="checkbox" readOnly className="accent-[var(--btn-gradient-start)]" /></th>
              <Head k="title">Title</Head>
              <Head k="progress">Progress</Head>
              <th className="hidden px-2 py-1.5 text-left text-[var(--color-light)] md:table-cell">Status</th>
              <Head k="date"><span className="hidden sm:inline">Last</span></Head>
              <Head k="rewatch"><span className="hidden sm:inline">Rewatch</span></Head>
              <th className="px-2 py-1.5 text-left text-[var(--color-light)]">★</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.item.id} className={cn("border-b border-[var(--color-mid)]/10", selected.includes(row.item.id) && "bg-[var(--btn-gradient-start)]/10")}>
                <td className="px-2 py-2">
                  <input type="checkbox" readOnly checked={selected.includes(row.item.id)} className="accent-[var(--btn-gradient-start)]" onClick={() => toggleSel(row.item.id)} />
                </td>
                <td className="px-2 py-2 font-semibold text-[var(--color-lightest)]">{row.item.title}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <Meter value={row.progress} className="w-16" />
                    <span className="text-[var(--color-light)] w-8">{row.progress}%</span>
                  </div>
                </td>
                <td className="hidden px-2 py-2 text-[var(--color-light)] md:table-cell">
                  {row.progress >= 100 ? "Completed" : row.progress > 0 ? "In progress" : "Backlog"}
                </td>
                <td className="px-2 py-2 text-[var(--color-light)]">{row.date}</td>
                <td className="hidden px-2 py-2 text-[var(--color-light)] sm:table-cell">{row.rewatch}</td>
                <td className="px-2 py-2"><Stars value={row.rating} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MockDock />
    </div>
  );
}

export function LogsKanban() {
  const [cols, setCols] = useState<Record<string, string[]>>({
    Backlog: DEMO_ITEMS.slice(0, 2).map((i) => i.id),
    "In progress": DEMO_ITEMS.slice(2, 5).map((i) => i.id),
    Done: DEMO_ITEMS.slice(5, 7).map((i) => i.id),
    Dropped: DEMO_ITEMS.slice(7).map((i) => i.id),
  });
  const target = (id: string) => Object.entries(cols).find(([, ids]) => ids.includes(id))?.[0];

  const move = (id: string, dir: 1 | -1) => {
    const from = target(id);
    if (!from) return;
    const order = ["Backlog", "In progress", "Done", "Dropped"];
    const next = order[Math.min(3, Math.max(0, order.indexOf(from) + dir))];
    if (next === from) return;
    setCols((c) => ({
      ...c,
      [from]: c[from].filter((x) => x !== id),
      [next]: [...c[next], id],
    }));
  };

  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--color-lightest)]">Board</p>
        <Chip>＋ Drag to move</Chip>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Object.entries(cols).map(([col, ids]) => (
          <div key={col} className="flex w-40 shrink-0 flex-col gap-2 rounded-xl bg-[var(--color-darkest)]/40 p-2">
            <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-light)]">
              {col} · {ids.length}
            </p>
            {ids.map((id) => {
              const it = DEMO_ITEMS.find((x) => x.id === id)!;
              return (
                <div key={id} className="rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-2 shadow-sm">
                  <Cover item={it} className="mb-1 aspect-video w-full rounded-md [&_span]:hidden" />
                  <p className="truncate text-[11px] font-semibold text-[var(--color-lightest)]">{it.title}</p>
                  <Meter value={it.logs * 4} className="mt-1" />
                  <div className="mt-1.5 flex items-center gap-1">
                    <button type="button" onClick={() => move(id, -1)} className="rounded bg-[var(--color-mid)]/20 px-1.5 py-0.5 text-[10px] text-[var(--color-light)]">◀</button>
                    <button type="button" onClick={() => move(id, 1)} className="rounded bg-[var(--color-mid)]/20 px-1.5 py-0.5 text-[10px] text-[var(--color-light)]">▶</button>
                  </div>
                </div>
              );
            })}
            {ids.length === 0 && (
              <div className="rounded-lg border border-dashed border-[var(--color-mid)]/30 p-3 text-center text-[10px] text-[var(--color-light)]">
                Drop here
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}