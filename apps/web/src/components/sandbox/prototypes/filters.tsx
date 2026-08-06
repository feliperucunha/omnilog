import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  LayoutList,
  ListFilter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS, MEDIA_META, type DemoItem } from "../sandboxData";
import { Chip, Cover, SectionLabel, Stars } from "./kit";

const STATUS = ["All", "Planned", "In progress", "Completed"] as const;
type StatusKey = (typeof STATUS)[number];
type SortKey = "newest" | "title" | "rating" | "progress";
type MediaKey = keyof typeof MEDIA_META;

/** Deterministic status derived from demo data so filters actually do something. */
function statusOf(item: DemoItem): Exclude<StatusKey, "All"> {
  if (item.logs >= 12) return "Completed";
  if (item.logs >= 6) return "In progress";
  return "Planned";
}

function ratingOf(item: DemoItem): number {
  return (item.logs % 5) + 3;
}

function sortItems(items: DemoItem[], key: SortKey, asc: boolean): DemoItem[] {
  const cmp = (a: DemoItem, b: DemoItem) => {
    switch (key) {
      case "title":
        return a.title.localeCompare(b.title);
      case "rating":
        return ratingOf(a) - ratingOf(b);
      case "progress":
        return a.logs * 4 - b.logs * 4;
      default:
        return Number(b.id.replace(/\D/g, "")) - Number(a.id.replace(/\D/g, ""));
    }
  };
  return [...items].sort((a, b) => cmp(a, b) * (asc ? 1 : -1));
}

function useFilteredLibrary(status: Exclude<StatusKey, "All"> | "All", media: MediaKey | "all") {
  return useMemo(
    () =>
      DEMO_ITEMS.filter(
        (it) =>
          (status === "All" || statusOf(it) === status) &&
          (media === "all" || it.mediaType === media)
      ),
    [status, media]
  );
}

function ResultRow({ item, hint }: { item: DemoItem; hint: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2">
      <Cover item={item} className="aspect-square w-10 rounded-md [&_span]:hidden" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">{item.title}</p>
        <p className="text-[10px] text-[var(--color-light)]">
          {MEDIA_META[item.mediaType].label} · {hint}
        </p>
      </div>
      <Stars value={ratingOf(item)} />
      <button
        type="button"
        className="btn-gradient rounded-md px-2.5 py-1 text-[10px] font-semibold text-white"
      >
        + Log
      </button>
    </div>
  );
}

function Results({ items }: { items: DemoItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-mid)]/30 p-6 text-center text-[11px] text-[var(--color-light)]">
        Nothing matches these filters.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <ResultRow key={it.id} item={it} hint={`${it.logs} logs · ${it.logs * 4}%`} />
      ))}
    </div>
  );
}

/* ================================================================== */
/* VERSION A — "Sheet"                                                 */
/* A hidden filter panel that slides up as a bottom sheet, keeping the */
/* toolbar clean. Sort lives in a segmented control + direction toggle. */
/* ================================================================== */

export function FilterSheet() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StatusKey>("All");
  const [media, setMedia] = useState<MediaKey | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [asc, setAsc] = useState(false);

  const activeCount =
    (status !== "All" ? 1 : 0) + (media !== "all" ? 1 : 0);
  const items = useFilteredLibrary(status, media);
  const sorted = sortItems(items, sortKey, asc);

  return (
    <div className="relative flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--color-lightest)]">My library</p>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--color-mid)]/40 p-0.5">
            {(["newest", "title", "rating"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSortKey(k)}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-semibold capitalize",
                  sortKey === k ? "bg-[var(--btn-gradient-start)]/20 text-white" : "text-[var(--color-light)]"
                )}
              >
                {k}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Sort direction"
            onClick={() => setAsc((v) => !v)}
            className="rounded-lg border border-[var(--color-mid)]/40 p-1.5 text-[var(--color-light)]"
          >
            {asc ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 text-xs font-semibold text-[var(--color-lightest)]"
      >
        <span className="flex items-center gap-2">
          <ListFilter className="size-4 text-[var(--color-light)]" aria-hidden />
          Filters
        </span>
        <span className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="rounded-full bg-[var(--btn-gradient-start)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--btn-gradient-start)]">
              {activeCount}
            </span>
          )}
          <ChevronDown className="size-3.5 text-[var(--color-light)]" aria-hidden />
        </span>
      </button>

      <Results items={sorted} />

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close filters"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 z-10 bg-black/50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={springSoft}
              className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-4 rounded-t-2xl border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-4 pb-6"
            >
              <div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-mid)]" />
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[var(--color-lightest)]">Filters</p>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("All");
                    setMedia("all");
                  }}
                  className="text-[11px] font-semibold text-[var(--btn-gradient-start)]"
                >
                  Clear all
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <SectionLabel>Status</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS.map((s) => (
                    <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <SectionLabel>Media type</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {(["all", ...Object.keys(MEDIA_META)] as (MediaKey | "all")[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMedia(m)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium",
                        media === m
                          ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/15 text-white"
                          : "border-[var(--color-mid)]/40 bg-[var(--color-darkest)]/40 text-[var(--color-light)]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded",
                          media === m ? "bg-[var(--btn-gradient-start)] text-white" : "bg-[var(--color-mid)]/30"
                        )}
                      >
                        {media === m && <Check className="size-3" aria-hidden />}
                      </span>
                      {m === "all" ? "All" : MEDIA_META[m].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <SectionLabel>Sort by</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      ["newest", "Newest first"],
                      ["title", "Title A–Z"],
                      ["rating", "Highest rated"],
                      ["progress", "Most progress"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSortKey(k)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[11px] font-medium",
                        sortKey === k
                          ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/15 text-white"
                          : "border-[var(--color-mid)]/40 text-[var(--color-light)]"
                      )}
                    >
                      {label}
                      {sortKey === k && <ArrowUpDown className="size-3 text-[var(--btn-gradient-start)]" aria-hidden />}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-gradient mt-1 flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold text-white"
              >
                Show {sorted.length} results
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================== */
/* VERSION B — "Bar"                                                   */
/* Everything inline: status pills, a query field and a sort menu that */
/* pops open under the toolbar. Active filters show as removable chips. */
/* ================================================================== */

export function FilterBar() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusKey>("All");
  const [media, setMedia] = useState<MediaKey | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [asc, setAsc] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const items = useFilteredLibrary(status, media).filter((it) =>
    it.title.toLowerCase().includes(q.toLowerCase())
  );
  const sorted = sortItems(items, sortKey, asc);

  const activeCount = (status !== "All" ? 1 : 0) + (media !== "all" ? 1 : 0);

  return (
    <div className="relative flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {STATUS.map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {s}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3">
            <Search className="size-3.5 shrink-0 text-[var(--color-light)]" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search titles…"
              className="h-full min-w-0 flex-1 bg-transparent text-xs text-[var(--color-lightest)] outline-none placeholder:text-[var(--color-light)]"
            />
            {q ? (
              <button type="button" aria-label="Clear" onClick={() => setQ("")}>
                <X className="size-3.5 text-[var(--color-light)]" aria-hidden />
              </button>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 text-[11px] font-semibold text-[var(--color-lightest)]"
            >
              <SlidersHorizontal className="size-3.5 text-[var(--color-light)]" aria-hidden />
              Sort
              {asc ? <ArrowUp className="size-3 text-[var(--color-light)]" aria-hidden /> : <ArrowDown className="size-3 text-[var(--color-light)]" aria-hidden />}
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full z-20 mt-1.5 flex w-44 flex-col gap-0.5 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)] p-1 shadow-xl"
                >
                  {(
                    [
                      ["newest", "Newest"],
                      ["title", "Title"],
                      ["rating", "Rating"],
                      ["progress", "Progress"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setSortKey(k);
                        setMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium",
                        sortKey === k ? "bg-[var(--btn-gradient-start)]/15 text-white" : "text-[var(--color-light)]"
                      )}
                    >
                      {label}
                      {sortKey === k && <Check className="size-3 text-[var(--btn-gradient-start)]" aria-hidden />}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAsc((v) => !v)}
                    className="mt-1 flex items-center justify-between rounded-lg border-t border-[var(--color-mid)]/20 px-2.5 pt-1.5 text-[11px] font-medium text-[var(--color-light)]"
                  >
                    {asc ? "Ascending" : "Descending"}
                    {asc ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {activeCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {status !== "All" && (
              <button
                type="button"
                onClick={() => setStatus("All")}
                className="flex items-center gap-1 rounded-full border border-[var(--btn-gradient-start)]/60 bg-[var(--btn-gradient-start)]/10 px-2 py-0.5 text-[10px] font-semibold text-white"
              >
                {status}
                <X className="size-3" aria-hidden />
              </button>
            )}
            {media !== "all" && (
              <button
                type="button"
                onClick={() => setMedia("all")}
                className="flex items-center gap-1 rounded-full border border-[var(--btn-gradient-start)]/60 bg-[var(--btn-gradient-start)]/10 px-2 py-0.5 text-[10px] font-semibold text-white"
              >
                {MEDIA_META[media].label}
                <X className="size-3" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setStatus("All");
                setMedia("all");
              }}
              className="text-[10px] font-semibold text-[var(--btn-gradient-start)]"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <SectionLabel>Results</SectionLabel>
        <span className="text-[10px] tabular-nums text-[var(--color-light)]">{sorted.length} items</span>
      </div>
      <Results items={sorted} />
    </div>
  );
}

/* ================================================================== */
/* VERSION C — "Rail"                                                  */
/* Always-visible: a media-type rail on top, status dots + counts, and */
/* a compact sort toggle. No popovers, everything one tap away.        */
/* ================================================================== */

export function FilterRail() {
  const [status, setStatus] = useState<Exclude<StatusKey, "All"> | "All">("All");
  const [media, setMedia] = useState<MediaKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [asc, setAsc] = useState(false);

  const count = (s: Exclude<StatusKey, "All">) => DEMO_ITEMS.filter((it) => statusOf(it) === s).length;
  const items = useFilteredLibrary(status, media);
  const sorted = sortItems(items, sortKey, asc);

  return (
    <div className="flex min-h-[26rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setMedia("all")}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold",
            media === "all"
              ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/15 text-white"
              : "border-[var(--color-mid)]/40 text-[var(--color-light)]"
          )}
        >
          <LayoutList className="size-3.5" aria-hidden /> All
        </button>
        {Object.entries(MEDIA_META).map(([k, meta]) => {
          const Icon = meta.icon;
          const active = media === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setMedia(k as MediaKey)}
              aria-label={meta.label}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                active
                  ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]"
                  : "border-[var(--color-mid)]/40 text-[var(--color-light)]"
              )}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <Chip active={status === "All"} onClick={() => setStatus("All")}>
            All · {DEMO_ITEMS.length}
          </Chip>
          {(["Planned", "In progress", "Completed"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(status === s ? "All" : s)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium",
                status === s
                  ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/15 text-white"
                  : "border-[var(--color-mid)]/50 bg-[var(--color-dark)] text-[var(--color-light)]"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  s === "Completed" ? "bg-emerald-500" : s === "In progress" ? "bg-amber-400" : "bg-[var(--color-mid)]"
                )}
                aria-hidden
              />
              {s} · {count(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-light)]">Sort</span>
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--color-mid)]/30 p-0.5">
          {(["newest", "title", "rating"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSortKey(k)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold capitalize",
                sortKey === k ? "bg-[var(--btn-gradient-start)]/20 text-white" : "text-[var(--color-light)]"
              )}
            >
              {k}
              {sortKey === k && (asc ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Toggle sort direction"
          onClick={() => setAsc((v) => !v)}
          className="rounded-lg border border-[var(--color-mid)]/30 p-1.5 text-[var(--color-light)]"
        >
          <ArrowUpDown className="size-3.5" aria-hidden />
        </button>
      </div>

      <Results items={sorted} />
    </div>
  );
}
