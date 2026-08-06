import { useState } from "react";
import {
  Plus,
  Upload,
  Download,
  ChevronDown,
  SlidersHorizontal,
  CalendarDays,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "../SandboxPrimitives";
import {
  DEMO_CATEGORIES,
  DEMO_LOG_ITEMS,
  STATUS_META,
  Poster,
  StatusChip,
  ScoreBadge,
  Stars,
  MetricBar,
  SearchField,
  ViewSelector,
  FilterButton,
  Chip,
  ActionButtons,
  SocialFeed,
  MobileTopBar,
  DesktopChrome,
  MobileDock,
  useDashboardState,
  RingBadge,
  type DemoLog,
} from "./dashboardMockups";

/* ================================================================== */
/* VERSION A — "Status Rail"                                           */
/* Status-first, scannable horizontal cards with a colored status      */
/* rail, underlined category tabs and a consolidated toolbar.          */
/* ================================================================== */

export function DashboardA() {
  const { category, setCategory, view, setView, status, setStatus, shown } = useDashboardState();
  const [filters, setFilters] = useState(false);

  return (
    <div className="flex min-h-full min-w-0 flex-col bg-[var(--color-darkest)] md:min-h-[44rem]">
      <DesktopChrome title="Dashboard" share />
      <MobileTopBar
        title="Dashboard"
        right={
          <button
            type="button"
            aria-label="Export"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-mid)] text-[var(--color-light)]"
          >
            <Download className="size-3.5" aria-hidden />
          </button>
        }
      />

      {/* Category tabs */}
      <div className="flex items-end gap-6 overflow-x-auto border-b border-[var(--color-mid)]/30 px-3 [scrollbar-width:none] md:px-5">
        {DEMO_CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={cn(
                "relative shrink-0 pb-2.5 pt-1 text-xs font-semibold transition-colors max-md:min-h-[44px]",
                active
                  ? "text-[var(--color-lightest)]"
                  : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
              )}
            >
              {c.label}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--btn-gradient-end)]" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-col gap-3 px-2.5 py-3 md:px-5 md:py-5">
        {/* Desktop milestone + actions */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-3">
            <RingBadge label="L7" sub="Level 7" />
            <MetricBar current={12} next={25} />
            <RingBadge label="L8" sub="Next level" className="ml-1" />
          </div>
          <button
            type="button"
            className="btn-gradient flex h-9 items-center gap-1.5 rounded-md px-3.5 text-sm font-semibold text-white"
          >
            <Upload className="size-4" aria-hidden /> Import
          </button>
          <button
            type="button"
            aria-label="Export"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-mid)] text-[var(--color-light)]"
          >
            <Download className="size-4" aria-hidden />
          </button>
        </div>

        {/* Mobile milestone header */}
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-2.5 md:hidden">
          <RingBadge label="L7" sub="Level 7" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-[var(--color-lightest)]">Movies</span>
              <span className="text-[var(--color-light)]">12/25</span>
            </div>
            <div className="mt-1 h-1 max-w-[11rem] overflow-hidden rounded-full bg-[var(--color-darkest)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)]"
                style={{ width: "48%" }}
              />
            </div>
          </div>
          <RingBadge label="L8" sub="Next level" />
          <button
            type="button"
            aria-label="Import"
            className="btn-gradient flex h-9 flex-none items-center gap-1 rounded-lg px-2 text-xs font-semibold text-white"
          >
            <Upload className="size-3.5" aria-hidden /> Import
          </button>
        </div>

        {/* Mobile filters */}
        <div className="flex flex-col gap-2 md:hidden">
          <div className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-0.5">
            <Chip active={status === "all"} onClick={() => setStatus("all")}>
              All
            </Chip>
            {(["completed", "in_progress", "planned", "dropped"] as const).map((s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[s].dot)} />
                {STATUS_META[s].label}
              </Chip>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFilters((v) => !v)}
            className="flex h-10 w-full items-center justify-between rounded-lg border border-[var(--color-mid)] bg-[var(--color-dark)] px-3 text-sm text-[var(--color-lightest)]"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-[var(--color-light)]" aria-hidden />
              Filters
            </span>
            <span className="text-[var(--color-light)]">{filters ? "Genre · Sort" : "Genre · Sort"}</span>
            <ChevronDown
              className={cn("size-4 text-[var(--color-light)] transition-transform", filters && "rotate-180")}
              aria-hidden
            />
          </button>
          {filters && (
            <div className="grid grid-cols-2 gap-2">
              <FilterButton>All genres</FilterButton>
              <FilterButton>Newest first</FilterButton>
            </div>
          )}
        </div>

        {/* Desktop filters */}
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <FilterButton
            active={status !== "all"}
            onClick={() => setStatus(status === "all" ? "in_progress" : "all")}
          >
            {status === "all" ? "All statuses" : STATUS_META[status].label}
          </FilterButton>
          <FilterButton>All genres</FilterButton>
          <FilterButton>Owned (3)</FilterButton>
          <FilterButton>Newest</FilterButton>
        </div>

        {/* Search + view selector */}
        <div className="flex items-center gap-2">
          <SearchField
            category={category === "all" ? "your library" : category}
            className="flex-1"
          />
          <ViewSelector view={view} setView={setView} />
        </div>

        {/* Cards */}
        <div
          className={cn(
            view === "grid"
              ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5"
              : view === "compact"
                ? "grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6"
                : "grid grid-cols-1 gap-2"
          )}
        >
          {shown.map((log) =>
            view === "list" ? (
              <ARowCard key={log.id} log={log} />
            ) : (
              <ATileCard key={log.id} log={log} />
            )
          )}
        </div>

        <button
          type="button"
          className="mx-auto mt-1 flex h-9 items-center gap-2 rounded-md border border-[var(--color-mid)] px-4 text-xs font-semibold text-[var(--color-lightest)] max-md:min-h-[44px]"
        >
          Load more
        </button>

        <SocialFeed
          newCount={9}
          className="border-t border-[var(--color-mid)]/20 pt-3"
          panelClassName="rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-dark)]/50 p-3"
        />
      </div>

      <div className="mt-auto md:hidden">
        <MobileDock plusLabel="Add" />
      </div>
    </div>
  );
}

function ARowCard({ log }: { log: DemoLog }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-xl border border-l-2 border-[var(--color-mid)]/25 bg-[var(--color-dark)] p-2 shadow-[var(--shadow-card)]",
        STATUS_META[log.status].edge
      )}
    >
      <div className="relative w-16 shrink-0 sm:w-20">
        <Poster log={log} className="h-full w-full rounded-lg" caption={false} />
        <ScoreBadge log={log} className="absolute right-0.5 top-0.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-[var(--color-lightest)]">{log.title}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <Stars value={log.stars} />
          <StatusChip status={log.status} />
          {log.progress && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
              {log.progress}
            </span>
          )}
        </div>
        <p className="line-clamp-1 text-[10px] text-[var(--color-light)]">
          {log.genre} · {log.meta}
        </p>
        <p className="line-clamp-1 text-xs text-[var(--color-light)]">{log.review}</p>
      </div>
      <div className="flex shrink-0 items-center">
        <ActionButtons log={log} />
      </div>
    </div>
  );
}

function ATileCard({ log }: { log: DemoLog }) {
  return (
    <div className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] shadow-[var(--shadow-card)]">
      <div className="relative aspect-[2/3]">
        <Poster log={log} className="absolute inset-0 rounded-none" caption={false} />
        <ScoreBadge log={log} className="absolute right-1.5 top-1.5" />
        <StatusChip status={log.status} className="absolute bottom-1.5 left-1.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-2">
        <p className="truncate text-[11px] font-semibold text-[var(--color-lightest)]">{log.title}</p>
        <div className="flex items-center justify-between gap-1">
          <Stars value={log.stars} />
          <span className="text-[9px] text-[var(--color-light)]">{log.progress ?? log.genre}</span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* VERSION B — "Ambient"                                               */
/* Cover-forward, generous whitespace, a progress-ring milestone,      */
/* pill category chips, poster cards with progress overlays and a      */
/* floating quick-log dock.                                            */
/* ================================================================== */

export function DashboardB() {
  const { category, setCategory, view, setView, shown } = useDashboardState();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex min-h-full min-w-0 flex-col bg-[var(--color-darkest)] md:min-h-[44rem]">
      <DesktopChrome title="Home" share />
      <MobileTopBar
        title="Home"
        right={
          <button
            type="button"
            aria-label="Share"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-mid)] text-[var(--color-light)]"
          >
            <span className="sr-only">Share</span>
            <Download className="size-3.5 rotate-180" aria-hidden />
          </button>
        }
      />

      <div className="flex min-w-0 flex-col gap-4 px-3 py-4 md:px-6 md:py-6">
        {/* Milestone hero */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-mid)]/20 bg-gradient-to-br from-[var(--btn-gradient-start)]/25 to-[var(--color-dark)] p-4">
          <div className="flex items-center gap-4">
            <ProgressRing value={48} size={74} stroke={7}>
              <span className="text-xs font-black text-[var(--color-lightest)]">L7</span>
              <span className="text-[8px] text-[var(--color-light)]">48%</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--btn-gradient-start)]">
                Level 7 · Mile-High Logger
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--color-lightest)]">
                You’ve logged <span className="text-[var(--btn-gradient-start)]">214</span> entries
              </p>
              <p className="mt-1 text-[10px] text-[var(--color-light)]">
                12/25 movies · Next: “Bookshelver” at 10 books
              </p>
            </div>
            <button
              type="button"
              className="btn-gradient hidden h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-sm font-semibold text-white md:flex"
            >
              <Upload className="size-4" aria-hidden /> Import
            </button>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-darkest)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)]"
              style={{ width: "48%" }}
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-0.5">
          {DEMO_CATEGORIES.map((c) => (
            <Chip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
              {c.label}
            </Chip>
          ))}
        </div>

        {/* Search + view */}
        <div className="flex items-center gap-2">
          <SearchField
            category={category === "all" ? "your library" : category}
            className="flex-1"
          />
          <ViewSelector view={view} setView={setView} />
        </div>

        {/* Poster grid */}
        <div
          className={cn(
            view === "list"
              ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              : view === "grid"
                ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5"
                : "grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6"
          )}
        >
          {shown.map((log) => (
            <BPosterCard key={log.id} log={log} caption />
          ))}
        </div>

        <button
          type="button"
          className="mx-auto mt-1 flex h-9 items-center gap-2 rounded-full border border-[var(--color-mid)] px-5 text-xs font-semibold text-[var(--color-lightest)] max-md:min-h-[44px]"
        >
          Load more
        </button>

        <SocialFeed
          newCount={9}
          className="border-t border-[var(--color-mid)]/20 pt-3"
          panelClassName="rounded-2xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)]/60 p-3"
        />
      </div>

      {/* Floating quick-log dock */}
      <div className="sticky bottom-3 z-10 mt-auto flex justify-center px-4 md:bottom-4">
        <div className="relative">
          {addOpen && (
            <div className="absolute bottom-14 left-1/2 w-48 -translate-x-1/2 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)] p-1.5 text-[11px] font-semibold text-[var(--color-lightest)] shadow-xl">
              {["Quick add movie", "Quick add TV", "Quick add book", "Import board games"].map((a) => (
                <button
                  key={a}
                  type="button"
                  className="block w-full rounded-md px-3 py-2 text-left hover:bg-[var(--color-mid)]/20"
                >
                  {a}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            aria-label="Quick add"
            onClick={() => setAddOpen((v) => !v)}
            className="btn-gradient flex items-center justify-center rounded-2xl text-white shadow-[0_10px_28px_rgba(0,0,0,0.5)] md:hidden"
            style={{ height: 52, width: 52 }}
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="md:hidden">
        <MobileDock plusLabel="Add" />
      </div>
    </div>
  );
}

function BPosterCard({ log, caption }: { log: DemoLog; caption: boolean }) {
  return (
    <div className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-mid)]/15 bg-[var(--color-dark)] p-1.5 shadow-[var(--shadow-card)]">
      <div className="relative aspect-[2/3]">
        <Poster log={log} className="absolute inset-0 rounded-xl" caption={false} />
        <ScoreBadge log={log} className="absolute right-1.5 top-1.5" />
        <span
          className={cn(
            "absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
            STATUS_META[log.status].chip
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[log.status].dot)} />
          {STATUS_META[log.status].label}
        </span>
        {log.progress && (
          <div className="absolute inset-x-1.5 bottom-1">
            <div className="h-1 overflow-hidden rounded-full bg-black/50">
              <div className="h-full w-1/2 rounded-full bg-white/80" />
            </div>
          </div>
        )}
      </div>
      {caption && (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-0.5 pb-0.5 pt-1.5">
          <p className="truncate text-[11px] font-semibold text-[var(--color-lightest)]">{log.title}</p>
          <div className="flex items-center gap-1">
            <Stars value={log.stars} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* VERSION C — "Power Grid"                                            */
/* Density-first: compact rows, segmented category control, a desktop  */
/* right rail with level card + status quick-counts, and a split       */
/* toolbar. Mobile stays a tight, single-thumb list.                   */
/* ================================================================== */

export function DashboardC() {
  const { category, setCategory, view, setView, status, setStatus, shown } = useDashboardState();
  const [filters, setFilters] = useState(false);

  const statusCounts = {
    all: DEMO_LOG_ITEMS.length,
    completed: DEMO_LOG_ITEMS.filter((l) => l.status === "completed").length,
    in_progress: DEMO_LOG_ITEMS.filter((l) => l.status === "in_progress").length,
    planned: DEMO_LOG_ITEMS.filter((l) => l.status === "planned").length,
    dropped: DEMO_LOG_ITEMS.filter((l) => l.status === "dropped").length,
  };

  return (
    <div className="flex min-h-full min-w-0 flex-col bg-[var(--color-darkest)] md:min-h-[44rem]">
      <DesktopChrome title="Dashboard" share />
      <MobileTopBar
        title="Dashboard"
        right={
          <button
            type="button"
            aria-label="Export"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-mid)] text-[var(--color-light)]"
          >
            <Download className="size-3.5" aria-hidden />
          </button>
        }
      />

      {/* Segmented category control */}
      <div className="border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)] px-3 py-2 md:px-5">
        <div
          className="scrollbar-hide flex items-center gap-1 overflow-x-auto rounded-full border border-[var(--color-mid)]/25 bg-[var(--color-mid)]/10 p-1"
          role="tablist"
          aria-label="Category"
        >
          {DEMO_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={category === c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors max-md:min-h-[40px]",
                category === c.key
                  ? "bg-[var(--color-mid)] text-[var(--color-darkest)] shadow-sm"
                  : "text-[var(--color-light)]"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 px-2.5 py-3 md:grid-cols-[minmax(0,1fr)_15rem] md:px-5 md:py-5">
        <div className="flex min-w-0 flex-col gap-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setFilters((v) => !v)}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold text-[var(--color-lightest)] max-md:min-h-[44px]",
                filters ? "border-[var(--btn-gradient-start)]" : "border-[var(--color-mid)]"
              )}
            >
              <SlidersHorizontal className="size-4 text-[var(--color-light)]" aria-hidden />
              Filters
              <ChevronDown className="size-3.5 text-[var(--color-light)]" aria-hidden />
            </button>
            <SearchField
              category={category === "all" ? "your library" : category}
              className="min-w-0 flex-1"
            />
            <ViewSelector view={view} setView={setView} />
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-1.5">
              <RingBadge label="L7" sub="Level 7" />
              <div className="mx-1 h-6 w-px bg-[var(--color-mid)]/30" aria-hidden />
              <div className="min-w-0 flex-1">
                <MetricBar current={12} next={25} />
              </div>
              <RingBadge label="L8" sub="Next level" className="ml-1" />
              <button
                type="button"
                className="btn-gradient ml-1 flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white"
              >
                <Upload className="size-3.5" aria-hidden /> Import
              </button>
              <button
                type="button"
                aria-label="Export"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-mid)] text-[var(--color-light)]"
              >
                <Download className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>

          {/* Filters row */}
          {filters && (
            <div className="grid grid-cols-2 gap-2 md:hidden">
              <FilterButton>All genres</FilterButton>
              <FilterButton>Newest first</FilterButton>
            </div>
          )}
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <FilterButton
              active={status !== "all"}
              onClick={() => setStatus(status === "all" ? "in_progress" : "all")}
            >
              {status === "all" ? "All statuses" : STATUS_META[status].label}
            </FilterButton>
            <FilterButton>All genres</FilterButton>
            <FilterButton>Owned (3)</FilterButton>
            <FilterButton>Newest</FilterButton>
          </div>

          {/* Cards */}
          <div
            className={cn(
              view === "grid"
                ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-3"
                : view === "compact"
                  ? "grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-4"
                  : "grid grid-cols-1 gap-1.5"
            )}
          >
            {shown.map((log) =>
              view === "list" ? (
                <CRowCard key={log.id} log={log} />
              ) : (
                <ATileCard key={log.id} log={log} />
              )
            )}
          </div>

          <button
            type="button"
            className="mx-auto mt-1 flex h-9 items-center gap-2 rounded-md border border-[var(--color-mid)] px-4 text-xs font-semibold text-[var(--color-lightest)] max-md:min-h-[44px]"
          >
            Load more
          </button>

          <SocialFeed
            newCount={9}
            className="border-t border-[var(--color-mid)]/20 pt-3"
            panelClassName="rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-dark)]/50 p-3"
          />
        </div>

        {/* Desktop right rail */}
        <aside className="hidden min-w-0 flex-col gap-3 md:flex">
          <div className="rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-light)]">
              This library
            </p>
            <div className="mt-2 flex items-center gap-3">
              <ProgressRing value={48} size={52} stroke={6}>
                <span className="text-[10px] font-black text-[var(--color-lightest)]">L7</span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--color-lightest)]">214 entries</p>
                <p className="text-[10px] text-[var(--color-light)]">48% to Level 8</p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-1">
              {(
                [
                  { key: "all", label: "All", n: statusCounts.all, cls: "" },
                  { key: "completed", label: "Completed", n: statusCounts.completed, cls: "bg-emerald-500" },
                  { key: "in_progress", label: "In progress", n: statusCounts.in_progress, cls: "bg-amber-400" },
                  { key: "planned", label: "Planned", n: statusCounts.planned, cls: "bg-[var(--color-mid)]" },
                  { key: "dropped", label: "Dropped", n: statusCounts.dropped, cls: "bg-red-500" },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(status === s.key ? "all" : (s.key as DemoLog["status"]))}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-[var(--color-mid)]/10 max-md:min-h-[44px]",
                    status === s.key && "bg-[var(--color-mid)]/15"
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", s.cls)} aria-hidden />
                  <span className="flex-1 text-[var(--color-lightest)]">{s.label}</span>
                  <span className="tabular-nums text-[var(--color-light)]">{s.n}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-light)]">
              Quick actions
            </p>
            <button
              type="button"
              className="btn-gradient mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-white"
            >
              <Plus className="size-4" aria-hidden /> Add entry
            </button>
            <button
              type="button"
              className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-[var(--color-mid)] text-xs font-semibold text-[var(--color-lightest)]"
            >
              <CalendarDays className="size-3.5 text-[var(--color-light)]" aria-hidden /> View calendar
            </button>
            <button
              type="button"
              className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-[var(--color-mid)] text-xs font-semibold text-[var(--color-lightest)]"
            >
              <Target className="size-3.5 text-[var(--color-light)]" aria-hidden /> Milestones
            </button>
          </div>
        </aside>
      </div>

      <div className="mt-auto md:hidden">
        <MobileDock plusLabel="Add" />
      </div>
    </div>
  );
}

function CRowCard({ log }: { log: DemoLog }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-l-2 border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-1.5 shadow-[var(--shadow-sm)]",
        STATUS_META[log.status].edge
      )}
    >
      <div className="relative w-12 shrink-0 sm:w-14">
        <Poster log={log} className="h-full w-full rounded-md" caption={false} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-1.5">
          <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">{log.title}</p>
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_META[log.status].dot)} aria-hidden />
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <Stars value={log.stars} />
          {log.score && (
            <span className="truncate text-[9px] font-semibold text-yellow-300/80">
              {log.score.source} {log.score.value}
            </span>
          )}
        </div>
        <p className="truncate text-[10px] text-[var(--color-light)]">
          {log.progress ?? log.genre} · {log.meta}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        <ActionButtons log={log} />
      </div>
    </div>
  );
}
