import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  Clapperboard,
  Dices,
  Film,
  Gamepad2,
  BookOpen,
  Heart,
  Share2,
  Sparkles,
  TrendingUp,
  Trophy,
  Tv,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEMO_LOG_ITEMS,
  Poster,
  ScoreBadge,
  Stars,
  StatusChip,
  type DemoLog,
} from "./dashboardMockups";
import { Chip, MockTopNav, Rail, SectionLabel, StatTile } from "./kit";

/* ------------------------------------------------------------------ */
/* Enticing demo profile data                                          */
/* ------------------------------------------------------------------ */

export const DEMO_PUBLIC_PROFILE = {
  username: "marinavault",
  displayName: "Marina V.",
  tagline: "Cinephile · CRPG completionist · Friday-night host",
  bio: "Logging everything since 2019. Currently on a sci-fi binge and a Wingspan win streak.",
  followers: 1_248,
  following: 312,
  logCount: 1_847,
  hoursLogged: 942,
  avgStars: 4.3,
  streakDays: 47,
  completionRate: 68,
} as const;

const PROFILE_CATEGORIES = [
  { key: "movies", label: "Movies", count: 412, icon: Clapperboard },
  { key: "tv", label: "TV", count: 289, icon: Tv },
  { key: "games", label: "Games", count: 156, icon: Gamepad2 },
  { key: "boardgames", label: "Board games", count: 94, icon: Dices },
  { key: "books", label: "Books", count: 118, icon: BookOpen },
  { key: "anime", label: "Anime", count: 76, icon: Film },
] as const;

const PINNED_BADGES = [
  { icon: "🔥", name: "47-day streak" },
  { icon: "📖", name: "Century reader" },
  { icon: "🎬", name: "A24 completist" },
  { icon: "🎲", name: "Tabletop tactician" },
  { icon: "⭐", name: "Top 5% reviewer" },
] as const;

const MILESTONE_BADGES = [
  { category: "Movies", level: 8, label: "Film buff", count: 412 },
  { category: "TV", level: 7, label: "Binge architect", count: 289 },
  { category: "Games", level: 6, label: "Platinum hunter", count: 156 },
  { category: "Board games", level: 5, label: "Match night MVP", count: 94 },
] as const;

const MARKET_LISTINGS = [
  { id: "mk1", title: "Horizons & Cages", price: "R$ 289", condition: "Like new", plays: 6 },
  { id: "mk2", title: "Wingspan", price: "R$ 420", condition: "Excellent", plays: 18 },
  { id: "mk3", title: "Terraforming Mars", price: "R$ 350", condition: "Good", plays: 12 },
] as const;

const BOARD_GAME_MATCHES = [
  { title: "Horizons & Cages", wins: 8, plays: 11, recent: "W 2 days ago" },
  { title: "Wingspan", wins: 12, plays: 18, recent: "W yesterday" },
  { title: "Azul", wins: 5, plays: 7, recent: "W 4 days ago" },
] as const;

const ACTIVITY_HIGHLIGHTS = [
  { verb: "finished", log: DEMO_LOG_ITEMS[0], detail: "★ 5 · masterpiece", ago: "2h" },
  { verb: "logged match", log: DEMO_LOG_ITEMS[5], detail: "W vs. @pedro", ago: "1d" },
  { verb: "reviewed", log: DEMO_LOG_ITEMS[4], detail: "★ 5 · 120h deep dive", ago: "2d" },
  { verb: "started", log: DEMO_LOG_ITEMS[1], detail: "Season 2 · Ep 4", ago: "3d" },
] as const;

const FEATURED_PICKS = DEMO_LOG_ITEMS.slice(0, 5);

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
}

function useProfileShell() {
  const [category, setCategory] = useState<string>("movies");
  const [following, setFollowing] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [badgesOpen, setBadgesOpen] = useState(true);
  const logs =
    category === "all"
      ? DEMO_LOG_ITEMS
      : DEMO_LOG_ITEMS.filter((l) => l.category === category);
  return {
    category,
    setCategory,
    following,
    setFollowing,
    pinnedOpen,
    setPinnedOpen,
    badgesOpen,
    setBadgesOpen,
    logs,
  };
}

function CategoryStrip({
  selected,
  onSelect,
  className,
}: {
  selected: string;
  onSelect: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scrollbar-hide flex gap-5 overflow-x-auto border-b border-[var(--color-mid)]/30 px-3 [scrollbar-width:none] md:px-4",
        className
      )}
    >
      {PROFILE_CATEGORIES.map((c) => {
        const active = selected === c.key;
        const Icon = c.icon;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect(c.key)}
            className={cn(
              "relative flex shrink-0 flex-col items-center gap-0.5 pb-2.5 pt-3 text-[11px] font-semibold transition-colors",
              active ? "text-[var(--color-lightest)]" : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
            )}
          >
            <Icon className="size-3.5 opacity-80" aria-hidden />
            <span>{c.label}</span>
            <span className="text-[9px] font-medium text-[var(--color-light)]">{c.count}</span>
            {active && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function FollowButton({
  following,
  onToggle,
  className,
}: {
  following: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
        following
          ? "border border-[var(--color-mid)]/50 bg-[var(--color-dark)] text-[var(--color-lightest)]"
          : "btn-gradient text-white shadow-[var(--shadow-sm)]",
        className
      )}
    >
      {following ? (
        <>Following</>
      ) : (
        <>
          <UserPlus className="size-3.5" aria-hidden />
          Follow
        </>
      )}
    </button>
  );
}

function LogListRows({ logs, limit = 4 }: { logs: DemoLog[]; limit?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {logs.slice(0, limit).map((log) => (
        <article
          key={log.id}
          className={cn(
            "flex gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/35 p-2.5",
            log.status === "completed" && "border-l-2 border-l-emerald-500",
            log.status === "in_progress" && "border-l-2 border-l-amber-400"
          )}
        >
          <Poster log={log} className="w-14 shrink-0 [&_span]:text-[8px]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-xs font-bold text-[var(--color-lightest)]">{log.title}</h3>
              <StatusChip status={log.status} />
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--color-light)]">{log.meta}</p>
            {log.progress && (
              <p className="mt-0.5 text-[10px] font-medium text-amber-300/90">{log.progress}</p>
            )}
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-[var(--color-light)]">{log.review}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Stars value={log.stars} />
              <ScoreBadge log={log} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function PinnedBadgesRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {PINNED_BADGES.map((b) => (
        <span
          key={b.name}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-mid)]/30 bg-[var(--color-dark)]/80 px-3 py-1 text-xs text-[var(--color-lightest)] shadow-[var(--shadow-sm)]"
        >
          <span aria-hidden>{b.icon}</span>
          {b.name}
        </span>
      ))}
    </div>
  );
}

function MilestoneBadgesGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {MILESTONE_BADGES.map((b) => (
        <div
          key={b.category}
          className="flex flex-col items-center gap-1 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3 text-center"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)] text-sm font-black text-white">
            L{b.level}
          </span>
          <p className="text-[10px] font-bold text-[var(--color-lightest)]">{b.label}</p>
          <p className="text-[9px] text-[var(--color-light)]">
            {b.category} · {b.count} logs
          </p>
        </div>
      ))}
    </div>
  );
}

function MarketSection({ compact = false }: { compact?: boolean }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--color-lightest)]">Market listings</h2>
        <span className="text-[10px] font-medium text-blue-400">View all →</span>
      </div>
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-3")}>
        {MARKET_LISTINGS.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-lg border border-[var(--color-mid)]/25 bg-[var(--color-dark)] p-3"
          >
            <div
              className="flex aspect-[4/3] items-end rounded-md p-2"
              style={{
                background: "linear-gradient(135deg, hsl(150 45% 28%), hsl(170 55% 18%))",
              }}
            >
              <span className="truncate text-[10px] font-bold text-white">{item.title}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-emerald-400">{item.price}</span>
              <span className="text-[9px] text-[var(--color-light)]">{item.condition}</span>
            </div>
            <p className="text-[9px] text-[var(--color-light)]">{item.plays} logged plays</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BoardGamesSection() {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]">
      <h2 className="text-sm font-semibold text-[var(--color-lightest)]">Recent board game matches</h2>
      <div className="flex flex-col gap-2">
        {BOARD_GAME_MATCHES.map((g) => (
          <div
            key={g.title}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-dark)] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">{g.title}</p>
              <p className="text-[10px] text-[var(--color-light)]">
                {g.wins}W · {g.plays} plays
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              {g.recent}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-0 overflow-hidden rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h2 className="text-sm font-semibold text-[var(--color-lightest)]">{title}</h2>
        <ChevronDown
          className={cn("size-4 text-[var(--color-light)] transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && <div className="pt-3">{children}</div>}
    </section>
  );
}

/* ================================================================== */
/* A — Vault Hero: cinematic header + featured picks                     */
/* ================================================================== */

export function PublicProfileA() {
  const { category, setCategory, following, setFollowing, logs } = useProfileShell();
  const p = DEMO_PUBLIC_PROFILE;

  return (
    <div className="flex min-h-[44rem] min-w-0 flex-col bg-[var(--color-darkest)] md:min-h-[48rem]">
      <MockTopNav
        title="Geeklogs"
        right={
          <button type="button" className="rounded-md p-1 text-[var(--color-light)]" aria-label="Share">
            <Share2 className="size-4" aria-hidden />
          </button>
        }
      />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[var(--color-mid)]/20 px-4 pb-5 pt-4 md:px-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 0%, var(--btn-gradient-start) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 90% 20%, var(--btn-gradient-end) 0%, transparent 50%)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)] text-2xl font-black text-white shadow-lg ring-2 ring-white/10">
              M
            </span>
            <div className="min-w-0 flex flex-col gap-1">
              <p className="text-lg font-bold text-[var(--color-lightest)] md:text-2xl">
                {p.displayName}
                <span className="ml-2 text-sm font-normal text-[var(--color-light)]">@{p.username}</span>
              </p>
              <p className="text-xs text-[var(--color-light)]">{p.tagline}</p>
              <p className="max-w-md text-[11px] leading-relaxed text-[var(--color-light)]">{p.bio}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-[var(--color-light)]">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" aria-hidden />
                  {formatCount(p.followers)} followers
                </span>
                <span>{formatCount(p.following)} following</span>
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Sparkles className="size-3" aria-hidden />
                  {p.streakDays}-day streak
                </span>
              </div>
            </div>
          </div>
          <FollowButton following={following} onToggle={() => setFollowing((v) => !v)} />
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Logs" value={formatCount(p.logCount)} sub="all time" />
          <StatTile label="Hours" value={`${p.hoursLogged}h`} sub="consumed" />
          <StatTile label="Avg rating" value={<Stars value={p.avgStars} />} />
          <StatTile label="Completed" value={`${p.completionRate}%`} sub="of started" />
        </div>

        <div className="relative mt-4">
          <SectionLabel>Pinned highlights</SectionLabel>
          <PinnedBadgesRow className="mt-2" />
        </div>
      </div>

      <CategoryStrip selected={category} onSelect={setCategory} />

      <div className="flex min-w-0 flex-col gap-4 p-4 md:p-6">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel>Featured picks</SectionLabel>
            <span className="text-[9px] text-[var(--color-light)]">Curated by Marina</span>
          </div>
          <Rail
            items={FEATURED_PICKS.map((log) => ({
              id: log.id,
              title: log.title,
              mediaType: (["movies", "tv", "games", "boardgames", "books"].includes(log.category)
                ? log.category
                : "movies") as "movies" | "tv" | "games" | "boardgames" | "books",
              hue: log.id.charCodeAt(1) * 20,
              logs: Math.round(log.stars * 2),
            }))}
          />
        </section>

        <section className="rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]">
          <h2 className="mb-3 text-sm font-semibold capitalize text-[var(--color-lightest)]">
            {PROFILE_CATEGORIES.find((c) => c.key === category)?.label ?? category} library
          </h2>
          <LogListRows logs={logs} limit={5} />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <MarketSection compact />
          <BoardGamesSection />
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* B — Production polish: mirrors live public profile layout           */
/* ================================================================== */

export function PublicProfileB() {
  const {
    category,
    setCategory,
    following,
    setFollowing,
    pinnedOpen,
    setPinnedOpen,
    badgesOpen,
    setBadgesOpen,
    logs,
  } = useProfileShell();
  const p = DEMO_PUBLIC_PROFILE;

  return (
    <div className="flex min-h-[44rem] min-w-0 flex-col bg-[var(--color-dark)] md:min-h-[48rem]">
      <MockTopNav title="Geeklogs" />

      <CategoryStrip selected={category} onSelect={setCategory} className="sticky top-0 z-10 bg-[var(--color-dark)]" />

      <div className="flex min-w-0 flex-col gap-6 px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-1">
            <h1 className="text-xl font-bold text-[var(--color-lightest)] sm:text-2xl">
              {p.displayName}&apos;s profile
            </h1>
            <button
              type="button"
              onClick={() => setPinnedOpen((o) => !o)}
              className="flex items-center gap-2 text-left text-sm text-[var(--color-light)] hover:text-[var(--color-lightest)]"
            >
              <span>Pinned highlights ({PINNED_BADGES.length})</span>
              <ChevronDown className={cn("size-4 transition-transform", pinnedOpen && "rotate-180")} aria-hidden />
            </button>
            {pinnedOpen && <PinnedBadgesRow className="pt-1" />}
          </div>
          <FollowButton following={following} onToggle={() => setFollowing((v) => !v)} />
        </div>

        <CollapsibleSection
          title="Milestone badges"
          open={badgesOpen}
          onToggle={() => setBadgesOpen((o) => !o)}
        >
          <MilestoneBadgesGrid />
        </CollapsibleSection>

        <MarketSection />

        <BoardGamesSection />

        <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4 shadow-[var(--shadow-category)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold capitalize text-[var(--color-lightest)]">
              {PROFILE_CATEGORIES.find((c) => c.key === category)?.label ?? category}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {["All statuses", "Completed", "In progress"].map((f, i) => (
                <Chip key={f} active={i === 0}>
                  {f}
                </Chip>
              ))}
            </div>
          </div>
          <LogListRows logs={logs} limit={6} />
        </section>
      </div>
    </div>
  );
}

/* ================================================================== */
/* C — Social spotlight: sidebar stats + activity feed                   */
/* ================================================================== */

export function PublicProfileC() {
  const { category, setCategory, following, setFollowing, logs } = useProfileShell();
  const p = DEMO_PUBLIC_PROFILE;

  return (
    <div className="flex min-h-[44rem] min-w-0 flex-col bg-[var(--color-darkest)] md:min-h-[48rem]">
      <MockTopNav title="Geeklogs" />

      <div className="grid min-w-0 flex-1 gap-0 lg:grid-cols-[17rem_1fr]">
        {/* Sidebar */}
        <aside className="flex flex-col gap-4 border-b border-[var(--color-mid)]/20 p-4 lg:border-b-0 lg:border-r lg:p-5">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-3xl font-black text-white ring-4 ring-[var(--color-mid)]/30">
              M
            </span>
            <p className="text-base font-bold text-[var(--color-lightest)]">{p.displayName}</p>
            <p className="text-xs text-[var(--color-light)]">@{p.username}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-light)]">{p.bio}</p>
          </div>

          <FollowButton
            following={following}
            onToggle={() => setFollowing((v) => !v)}
            className="w-full justify-center"
          />

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Followers", formatCount(p.followers)],
              ["Following", formatCount(p.following)],
              ["Logs", formatCount(p.logCount)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg bg-[var(--color-dark)] p-2">
                <p className="text-sm font-bold text-[var(--color-lightest)]">{val}</p>
                <p className="text-[9px] text-[var(--color-light)]">{label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
              <Trophy className="size-3.5" aria-hidden />
              On a hot streak
            </p>
            <p className="mt-1 text-2xl font-black text-[var(--color-lightest)]">{p.streakDays} days</p>
            <p className="text-[10px] text-[var(--color-light)]">Longest this year · top 3% of users</p>
          </div>

          <div>
            <SectionLabel>Badges</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PINNED_BADGES.slice(0, 4).map((b) => (
                <span
                  key={b.name}
                  title={b.name}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)] text-base"
                >
                  {b.icon}
                </span>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-col gap-4 p-4 md:p-5">
          <section className="rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-dark)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>Recent activity</SectionLabel>
              <TrendingUp className="size-4 text-emerald-400" aria-hidden />
            </div>
            <div className="flex flex-col gap-2">
              {ACTIVITY_HIGHLIGHTS.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-[var(--color-mid)]/15 bg-[var(--color-darkest)]/40 px-2.5 py-2"
                >
                  <Poster log={a.log} className="w-10 shrink-0 [&_span]:hidden" caption={false} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-[var(--color-lightest)]">
                      <span className="font-semibold capitalize">{a.verb}</span>{" "}
                      <span className="font-bold">{a.log.title}</span>
                    </p>
                    <p className="text-[10px] text-[var(--color-light)]">{a.detail}</p>
                  </div>
                  <span className="shrink-0 text-[9px] text-[var(--color-light)]">{a.ago}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-1.5">
            {PROFILE_CATEGORIES.map((c) => (
              <Chip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
                {c.label} ({c.count})
              </Chip>
            ))}
          </div>

          <section className="rounded-xl border border-[var(--color-category-border)] bg-[var(--color-category-bg)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-lightest)]">
                Currently logging
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] text-rose-400">
                <Heart className="size-3 fill-rose-400" aria-hidden />
                {logs.filter((l) => l.status === "in_progress").length} in progress
              </span>
            </div>
            <LogListRows logs={logs.filter((l) => l.status === "in_progress").concat(logs.filter((l) => l.status === "completed")).slice(0, 4)} />
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <MarketSection compact />
            <BoardGamesSection />
          </div>
        </div>
      </div>
    </div>
  );
}
