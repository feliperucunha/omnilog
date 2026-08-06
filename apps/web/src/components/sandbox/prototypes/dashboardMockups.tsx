import { useState, type ReactNode } from "react";
import {
  Plus,
  Search,
  Star,
  Pencil,
  ChevronDown,
  List,
  LayoutGrid,
  Columns3,
  ThumbsUp,
  ThumbsDown,
  Clapperboard,
  Tv,
  Gamepad2,
  Dices,
  BookOpen,
  Film,
  BookMarked,
  SquareStack,
  Share2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS, MEDIA_META } from "../sandboxData";

/* ------------------------------------------------------------------ */
/* Demo data                                                           */
/* ------------------------------------------------------------------ */

export type DemoStatus = "completed" | "in_progress" | "planned" | "dropped";

export interface DemoLog {
  id: string;
  title: string;
  category: string;
  status: DemoStatus;
  score?: { source: string; value: string };
  stars: number;
  progress?: string;
  meta: string;
  genre: string;
  review: string;
  addedDaysAgo: number;
  plusUnit?: string;
  match?: boolean;
}

export const DEMO_LOG_ITEMS: DemoLog[] = [
  {
    id: "d1",
    title: "Dune: Part Two",
    category: "movies",
    status: "completed",
    score: { source: "IMDB", value: "8.6" },
    stars: 4,
    meta: "Sci-Fi · Warner · 2h 46m",
    genre: "Sci-Fi",
    review: "Chalamet and Zendaya carry the desert home. Villeneuve turns the second half into pure cinema.",
    addedDaysAgo: 2,
  },
  {
    id: "d2",
    title: "Severance",
    category: "tv",
    status: "in_progress",
    score: { source: "IMDB", value: "8.7" },
    stars: 4.5,
    progress: "Season 2 · Ep 4",
    meta: "Apple TV+ · Mystery",
    genre: "Mystery",
    review: "The office-cult tension is unreal. Cobel is the MVP so far.",
    addedDaysAgo: 1,
    plusUnit: "episode",
  },
  {
    id: "d3",
    title: "The Bear",
    category: "tv",
    status: "in_progress",
    score: { source: "IMDB", value: "8.5" },
    stars: 4,
    progress: "Season 3 · Ep 2",
    meta: "FX · Drama",
    genre: "Drama",
    review: "Every kitchen scene is a panic attack in the best way.",
    addedDaysAgo: 3,
    plusUnit: "episode",
  },
  {
    id: "d4",
    title: "Elden Ring",
    category: "games",
    status: "in_progress",
    score: { source: "RAWG", value: "4.5" },
    stars: 4.5,
    meta: "FromSoftware · Souls",
    genre: "Souls",
    review: "120 hours and the map still surprises me.",
    addedDaysAgo: 5,
    progress: "68h played",
  },
  {
    id: "d5",
    title: "Baldur's Gate 3",
    category: "games",
    status: "completed",
    score: { source: "RAWG", value: "4.7" },
    stars: 5,
    meta: "Larian · RPG",
    genre: "RPG",
    review: "The gold standard of CRPGs. Act 3 overstays slightly.",
    addedDaysAgo: 12,
  },
  {
    id: "d6",
    title: "Horizons & Cages",
    category: "boardgames",
    status: "completed",
    score: { source: "Weight", value: "3.2/5" },
    stars: 4,
    meta: "2–4 players · 60m · 3 days ago",
    genre: "Strategy",
    review: "Snappy worker placement. The cage-scoring twist is fresh.",
    addedDaysAgo: 3,
    match: true,
  },
  {
    id: "d7",
    title: "The Left Hand of Elegy",
    category: "books",
    status: "in_progress",
    score: undefined,
    stars: 3.5,
    progress: "Chapter 12 · 320 pages",
    meta: "Literary fiction · 12h read",
    genre: "Fiction",
    review: "Lush prose, glacial middle act. Holding out for the ending.",
    addedDaysAgo: 4,
  },
  {
    id: "d8",
    title: "Frieren: Beyond Journey's End",
    category: "anime",
    status: "in_progress",
    score: { source: "MAL", value: "9.0" },
    stars: 4.5,
    progress: "Season 1 · Ep 14",
    meta: "Madhouse · Fantasy",
    genre: "Fantasy",
    review: "Quiet melancholy done right. The Himmel flashbacks hurt.",
    addedDaysAgo: 2,
    plusUnit: "episode",
  },
  {
    id: "d9",
    title: "Vagabond",
    category: "manga",
    status: "in_progress",
    score: { source: "MAL", value: "9.1" },
    stars: 5,
    progress: "Chapter 214 · Vol 12",
    meta: "Seinen · Historical",
    genre: "Seinen",
    review: "Inoue's brushwork is unfair. Peak manga art, period.",
    addedDaysAgo: 6,
    plusUnit: "chapter",
  },
  {
    id: "d10",
    title: "Saga",
    category: "comics",
    status: "in_progress",
    score: undefined,
    stars: 4,
    progress: "Volume 6 · Ch 36",
    meta: "Image · Space-opera",
    genre: "Fantasy",
    review: "Still the best ongoing comic after 50 issues.",
    addedDaysAgo: 1,
    plusUnit: "volume",
  },
  {
    id: "d11",
    title: "Past Lives",
    category: "movies",
    status: "completed",
    score: { source: "IMDB", value: "7.8" },
    stars: 4,
    meta: "Drama · A24 · 1h 46m",
    genre: "Drama",
    review: "In-yun theory broke me. The bar scene is perfect restraint.",
    addedDaysAgo: 9,
  },
  {
    id: "d12",
    title: "God of War: Ragnarök",
    category: "games",
    status: "completed",
    score: { source: "RAWG", value: "4.6" },
    stars: 4.5,
    meta: "Santa Monica · Action",
    genre: "Action",
    review: "An ending that earns its epilogue. Brok deserved better.",
    addedDaysAgo: 15,
  },
];

export const DEMO_CATEGORIES = [
  { key: "all", label: "All" },
  { key: "movies", label: "Movies" },
  { key: "tv", label: "TV" },
  { key: "games", label: "Games" },
  { key: "boardgames", label: "Board games" },
  { key: "books", label: "Books" },
];

export const STATUS_META: Record<
  DemoStatus,
  { label: string; chip: string; dot: string; edge: string }
> = {
  completed: {
    label: "Completed",
    chip: "bg-emerald-600 text-white",
    dot: "bg-emerald-500",
    edge: "border-l-emerald-500",
  },
  in_progress: {
    label: "In progress",
    chip: "bg-amber-400 text-[var(--color-darkest)]",
    dot: "bg-amber-400",
    edge: "border-l-amber-400",
  },
  planned: {
    label: "Planned",
    chip: "bg-[var(--color-mid)]/90 text-[var(--color-lightest)]",
    dot: "bg-[var(--color-mid)]",
    edge: "border-l-[var(--color-mid)]",
  },
  dropped: {
    label: "Dropped",
    chip: "bg-red-500 text-white",
    dot: "bg-red-500",
    edge: "border-l-red-500",
  },
};

const MEDIA_ICONS: Record<string, typeof Clapperboard> = {
  movies: Clapperboard,
  tv: Tv,
  games: Gamepad2,
  boardgames: Dices,
  books: BookOpen,
  anime: Film,
  manga: BookMarked,
  comics: SquareStack,
};

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

function Poster({
  log,
  className,
  caption = true,
}: {
  log: DemoLog;
  className?: string;
  caption?: boolean;
}) {
  const Icon = MEDIA_ICONS[log.category] ?? Film;
  const hue = (log.id.charCodeAt(0) * 37 + log.title.length * 11) % 360;
  return (
    <div
      className={cn("relative flex aspect-[2/3] overflow-hidden rounded-lg", className)}
      style={{
        background: `linear-gradient(150deg, hsl(${hue} 45% 32%), hsl(${(hue + 28) % 360} 60% 16%))`,
      }}
    >
      <Icon className="absolute inset-0 m-auto size-6 text-white/60" aria-hidden />
      {caption && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] font-semibold text-white">
          {log.title}
        </span>
      )}
    </div>
  );
}

function StatusChip({ status, className }: { status: DemoStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
        m.chip,
        className
      )}
    >
      {m.label}
    </span>
  );
}

function ScoreBadge({ log, className }: { log: DemoLog; className?: string }) {
  if (!log.score) return null;
  const isWeight = log.score.source === "Weight";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-yellow-300 backdrop-blur-sm",
        className
      )}
    >
      {log.score.source} {log.score.value}
      {isWeight && <Star className="size-2.5 fill-yellow-300 text-yellow-300" aria-hidden />}
    </span>
  );
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i < Math.round(value) ? "fill-amber-400 text-amber-400" : "text-[var(--color-mid)]"
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

function RingBadge({
  label,
  sub,
  className,
}: {
  label: string;
  sub: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-mid)]/40 bg-[var(--color-darkest)] text-[10px] font-black text-[var(--color-lightest)]",
        className
      )}
    >
      <span className="sr-only">{sub}</span>
      {label}
    </span>
  );
}

function MetricBar({ current, next }: { current: number; next: number }) {
  const pct = Math.min(100, Math.round((current / next) * 100));
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="truncate font-semibold text-[var(--color-lightest)]">Mile-High Logger</span>
        <span className="shrink-0 text-[var(--color-light)]">
          {current}/{next}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-darkest)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)] transition-all duration-500"
          style={{ width: `${Math.max(6, pct)}%` }}
        />
      </div>
      <p className="truncate text-[9px] text-[var(--color-light)]">Next: “Bookshelver” — read 10 books</p>
    </div>
  );
}

function SearchField({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-mid)]/55 bg-[var(--color-darkest)] px-4 shadow-[var(--shadow-md)] max-md:min-h-[44px]",
        className
      )}
    >
      <Search className="size-4 shrink-0 text-[var(--color-light)]" aria-hidden />
      <input
        placeholder={`Search ${category === "all" ? "your library" : category}…`}
        aria-label="Search titles"
        className="h-full w-full bg-transparent text-sm text-[var(--color-lightest)] outline-none placeholder:text-[var(--color-light)]"
      />
      <span className="size-2 rounded-full bg-[var(--btn-gradient-start)]/70" aria-hidden />
    </div>
  );
}

function ViewSelector({
  view,
  setView,
  className,
}: {
  view: "list" | "compact" | "grid";
  setView: (v: "list" | "compact" | "grid") => void;
  className?: string;
}) {
  const opts: { key: "list" | "compact" | "grid"; icon: typeof List }[] = [
    { key: "list", icon: List },
    { key: "compact", icon: LayoutGrid },
    { key: "grid", icon: Columns3 },
  ];
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-0.5 rounded-full border border-[var(--color-mid)]/25 bg-[var(--color-mid)]/12 p-1 shadow-inner max-md:min-h-[44px]",
        className
      )}
      role="tablist"
      aria-label="View"
    >
      {opts.map((o) => {
        const Icon = o.icon;
        const active = view === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setView(o.key)}
            className={cn(
              "flex h-8 w-9 items-center justify-center rounded-full transition-colors",
              active
                ? "bg-[var(--color-mid)] text-[var(--color-darkest)] shadow-sm"
                : "text-[var(--color-light)]"
            )}
          >
            <Icon className="size-4" strokeWidth={active ? 2.25 : 2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function FilterButton({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1 rounded-md border bg-[var(--color-darkest)] px-3 text-sm font-medium text-[var(--color-lightest)] transition-colors max-md:min-h-[44px]",
        active
          ? "border-[var(--btn-gradient-start)]/70 text-[var(--color-lightest)]"
          : "border-[var(--color-mid)]",
        className
      )}
    >
      {children}
      <ChevronDown className="size-3.5 text-[var(--color-light)]" aria-hidden />
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
  count,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors max-md:min-h-[36px]",
        active
          ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/15 text-white"
          : "border-[var(--color-mid)]/50 bg-[var(--color-dark)] text-[var(--color-light)]",
        className
      )}
    >
      {children}
      {count != null && (
        <span className={cn("text-[10px]", active ? "text-white/80" : "text-[var(--color-light)]")}>
          {count}
        </span>
      )}
    </button>
  );
}

function ActionButtons({
  log,
  compact,
}: {
  log: DemoLog;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5",
        compact ? "flex-col" : "flex-col"
      )}
    >
      {(log.plusUnit || log.match) && (
        <button
          type="button"
          aria-label={log.match ? "Log match" : `Increment ${log.plusUnit}`}
          className="btn-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[var(--shadow-sm)] max-md:h-10 max-md:w-10"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      )}
      <button
        type="button"
        aria-label="Edit"
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-darkest)] text-[var(--color-light)] shadow-[var(--shadow-sm)] transition-colors hover:text-[var(--color-lightest)] max-md:h-10 max-md:w-10"
      >
        <Pencil className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

const FEED = [
  {
    user: "ana",
    time: "2h",
    action: "finished Severance S2",
    media: "TV",
    likes: 14,
    dislikes: 1,
    liked: true,
  },
  {
    user: "pedro",
    time: "5h",
    action: "rated Elden Ring ★ 4.5",
    media: "Games",
    likes: 8,
    dislikes: 0,
    liked: false,
  },
  {
    user: "mira",
    time: "1d",
    action: "added 4 books to Plan to Read",
    media: "Books",
    likes: 5,
    dislikes: 2,
    liked: false,
  },
];

function SocialFeed({
  newCount,
  className,
  panelClassName,
}: {
  newCount: number;
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(true);
  const [friend, setFriend] = useState("All");
  return (
    <section className={cn("flex min-w-0 flex-col gap-2", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left transition-colors hover:bg-[var(--color-mid)]/10 max-md:min-h-[44px]"
      >
        <ChevronDown
          className={cn("size-4 text-[var(--color-light)] transition-transform", !open && "-rotate-90")}
          aria-hidden
        />
        <span className="text-lg font-semibold text-[var(--color-lightest)]">Social</span>
        <span className="ml-auto text-xs text-[var(--color-light)]">
          {newCount} new entries last week
        </span>
      </button>

      {open && (
        <div className={cn("flex flex-col gap-3", panelClassName)}>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Chip active={friend === "All"} onClick={() => setFriend("All")}>
              All
            </Chip>
            {["ana", "pedro", "mira"].map((f) => (
              <Chip key={f} active={friend === f} onClick={() => setFriend(f)}>
                @{f}
              </Chip>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {FEED.map((f) => (
              <div
                key={f.user}
                className="flex items-center gap-2.5 rounded-lg bg-[var(--color-dark)] p-2.5 shadow-[var(--shadow-sm)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--btn-gradient-start)]/20 text-[var(--btn-gradient-start)]">
                  <User className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">
                    <span className="text-[var(--btn-gradient-start)]">@{f.user}</span>{" "}
                    <span className="font-normal text-[var(--color-light)]">{f.action}</span>
                  </p>
                  <p className="text-[10px] text-[var(--color-light)]">
                    {f.media} · {f.time} ago
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[11px]">
                  <span
                    className={cn(
                      "flex items-center gap-0.5",
                      f.liked ? "text-emerald-500" : "text-[var(--color-light)]"
                    )}
                  >
                    <ThumbsUp className="size-3.5" aria-hidden /> {f.likes}
                  </span>
                  <span className="flex items-center gap-0.5 text-[var(--color-light)]">
                    <ThumbsDown className="size-3.5" aria-hidden /> {f.dislikes}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MobileTopBar({
  title,
  right,
}: {
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)] px-3 py-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--btn-gradient-start)] text-[11px] font-bold text-white">
        ◈
      </span>
      <span className="truncate text-base font-semibold text-[var(--color-lightest)]">{title}</span>
      <div className="ml-auto flex items-center gap-2">
        {right}
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-mid)]/30 text-[11px] font-bold text-[var(--color-lightest)]">
          F
        </span>
      </div>
    </div>
  );
}

function DesktopChrome({
  title,
  share,
}: {
  title: string;
  share: boolean;
}) {
  return (
    <div className="hidden items-center gap-3 border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)] px-4 py-3 md:flex">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--btn-gradient-start)] text-[11px] font-bold text-white">
        ◈
      </span>
      <span className="text-lg font-semibold text-[var(--color-lightest)]">{title}</span>
      <div className="ml-auto flex items-center gap-3 text-[11px] font-medium text-[var(--color-light)]">
        <span>Stats</span>
        <span>Market</span>
        {share && (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--color-mid)] px-2.5 py-1.5 text-[var(--color-lightest)]"
          >
            <Share2 className="size-3.5" aria-hidden /> Share
          </button>
        )}
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-mid)]/30 text-[11px] font-bold text-[var(--color-lightest)]">
          F
        </span>
      </div>
    </div>
  );
}

function MobileDock({
  plusLabel = "Add",
}: {
  plusLabel?: string;
}) {
  const tabs = [
    { t: "Home", i: "▦" },
    { t: "Stats", i: "▤" },
    { t: "Search", i: "🔍" },
  ];
  return (
    <div className="grid grid-cols-5 items-stretch gap-1 border-t border-[var(--color-mid)]/20 bg-[var(--color-dark)] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 md:hidden">
      {tabs.map((tab, idx) => (
        <span
          key={tab.t}
          className={cn(
            "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[9px]",
            idx === 0 ? "text-[var(--btn-gradient-start)]" : "text-[var(--color-light)]"
          )}
        >
          <span className="text-sm">{tab.i}</span>
          {tab.t}
        </span>
      ))}
      <span aria-hidden />
      <button
        type="button"
        aria-label={plusLabel}
        className="btn-gradient mx-auto mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl text-white"
      >
        <span className="text-lg font-black leading-none">+</span>
      </button>
    </div>
  );
}

function useDashboardState() {
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"list" | "compact" | "grid">("list");
  const [status, setStatus] = useState<DemoStatus | "all">("all");
  const logs =
    category === "all"
      ? DEMO_LOG_ITEMS
      : DEMO_LOG_ITEMS.filter((l) => l.category === category);
  const shown = status === "all" ? logs : logs.filter((l) => l.status === status);
  return { category, setCategory, view, setView, status, setStatus, shown };
}

export {
  DEMO_ITEMS,
  MEDIA_META,
  Poster,
  StatusChip,
  ScoreBadge,
  Stars,
  RingBadge,
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
};
