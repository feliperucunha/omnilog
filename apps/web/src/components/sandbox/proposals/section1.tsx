import { Home, ListChecks, BarChart3 } from "lucide-react";
import type { ProposalTopic } from "../proposalTypes";
import { wf } from "../proposalTypes";
import { ConceptHero } from "../ConceptHero";
import { ConceptStats } from "../ConceptStats";
import { ConceptHeatmap } from "../ConceptHeatmap";

export const section1: ProposalTopic[] = [
  {
    id: "dashboard",
    page: "Home / Dashboard",
    type: "Page",
    icon: Home,
    currentUx:
      "Category tabs, a media-log list, a small statistics column and a calendar. Functional, but returning users get no motivation moment or obvious next action.",
    options: [
      {
        id: "dashboard-a",
        label: "A",
        title: "Warm, goal-driven hero",
        tagline: "Make Home feel personal and momentum-driven.",
        inspiredBy: ["The StoryGraph", "AniList", "Trakt"],
        effort: "Medium",
        preview: <ConceptHero />,
        coreIdea:
          "Greeting + date, a daily-goal progress ring, trend chips, a streak counter, and a 'Jump back in' rail of recent items above the list.",
        desktop:
          "Greeting + primary 'Log something' CTA. Three cards (goal ring, this week, streak) then a four-up 'Jump back in' cover rail above the existing list.",
        mobile:
          "Single-line greeting; full-width, thumb-close CTA; goal and streak cards stack compactly above the list.",
        changes: ["Adds greeting/goal-ring/streak/trend chips", "New 'Jump back in' rec rail"],
        rationale:
          "Retention peers greet you and show progress (StoryGraph/AniList); a rewarded first glance turns logging into a habit.",
        tradeoffs: ["Vertical space above the mobile list", "Needs daily-goal setting and streak computation"],
      },
      {
        id: "dashboard-b",
        label: "B",
        title: "Quiet command hub",
        tagline: "Density-first, tool-like home for power users.",
        inspiredBy: ["Trakt", "Backloggd", "IMDb"],
        effort: "Medium",
        wireframe: wf([
          "┌──────────────────────────────",
          "│ stats strip · 5 compact      │",
          "│ [All][Movies][TV][Books]…    │",
          "│ ▢ cards (dense)             │",
          "│ (+ sticky Add above dock)    │",
          "└──────────────────────────────",
        ]),
        coreIdea:
          "No hero: a strip of key numbers, filter tabs, a dense grid and a persistent one-tap 'Add to log'. Logging as a tool, not a brand.",
        desktop:
          "Compact stat strip + category filters; dense list with hover quick-actions; a sticky corner 'Log' button opens a quick-add sheet.",
        mobile:
          "Always-visible stat chips + horizontal category pills; a floating '+' just above the bottom nav.",
        changes: ["Adds a navigable stat strip", "Adds a persistent quick-add affordance above the dock"],
        rationale:
          "Power users reject marketing chrome; rapid list + add is the workflow they want, like Trakt and Backloggd.",
        tradeoffs: ["Colder first impression", "Density can feel noisy without strong hierarchy"],
      },
      {
        id: "dashboard-c",
        label: "C",
        title: "Journey-first logbook",
        tagline: "Turn Home into a living, chronological media diary.",
        inspiredBy: ["Letterboxd", "AniList activity"],
        effort: "Large",
        wireframe: wf([
          "OCTOBER          6 logs · 12h",
          "──── today ──────────────────",
          " ▸ Movie  Dune: Part Two     ",
          " ▸ Book   Left Hand of Elegy ",
          " ▸ Series Severance 2×4      ",
          "──── last week ──────────────",
          " ▸ Series Severance 2×3      ",
        ]),
        coreIdea:
          "Home becomes a diary: a month-progress header and a timeline of logs grouped by day with ratings; categories move to a secondary toolbar.",
        desktop:
          "Month-strip header, then a scrolling timeline grouped by day; statistics and categories become secondary toolbar controls.",
        mobile:
          "Day headers with thumbnail + title + star rows; swipe to edit/delete; tap a day for that day's stats.",
        changes: ["Replace the category-first view with a unified timeline", "Add day grouping and a month-progress header"],
        rationale:
          "A diary (Letterboxd/AniList) turns logs into storytelling, lifting revisits and strengthening streaks.",
        tradeoffs: ["Largest data-model and UX change", "Hides the category split unless a tab control returns"],
      },
    ],
  },

  {
    id: "logs",
    page: "Logs list (a category)",
    type: "Page",
    icon: ListChecks,
    currentUx:
      "A list/grid/compact view switcher of media-log cards with status filters. Progress, dates and rewatches aren't scannable as columns.",
    options: [
      {
        id: "logs-a",
        label: "A",
        title: "Media-forward cards",
        tagline: "Cover-first cards with richer metadata and quick actions.",
        inspiredBy: ["Letterboxd", "AniList"],
        effort: "Small",
        wireframe: wf([
          "[Grid ▾] [List] [Compact]",
          "[P][P][P][P]  posters grid ",
          "hover →  log / edit / ★    ",
          "mobile tap → action sheet  ",
        ]),
        coreIdea:
          "Put the artwork first: a responsive poster grid with status-colored framing, a rating overlay, and hover quick actions (log, edit, rewatch).",
        desktop:
          "Responsive poster grid showing poster, year, status badge and rating; hover reveals inline actions.",
        mobile:
          "Tap opens a quick-action sheet; long-press multi-select; swipe to delete or mark done.",
        changes: ["Convert to a card/poster grid with hover actions", "Keep the view switcher and filters"],
        rationale: "Media trackers treat covers as the core affordance; bigger art improves emotion and scannability.",
        tradeoffs: ["Cover-less items take more vertical space", "Hover actions need a mobile tap equivalent"],
      },
      {
        id: "logs-b",
        label: "B",
        title: "Completionist table",
        tagline: "Data-dense, column-scannable progress, dates, rewatches.",
        inspiredBy: ["Trakt", "Spreadsheet exports"],
        effort: "Medium",
        wireframe: wf([
          "Title       Progress  Wat  Rew",
          "Severance   2×4/9   34%   2   1",
          "Dune: Pt 2  done    100%  1   2",
          "sortable ⇅ column headers    ",
        ]),
        coreIdea:
          "Add a sortable table view (columns: title, progress, status, last date, rewatches, rating) alongside the list and grid.",
        desktop:
          "Columns are sortable/filterable; inline progress editing; row selection for bulk actions (mark complete, move list).",
        mobile:
          "Compact rows mapping the same fields; a filter sheet drives which columns are visible on small screens.",
        changes: ["Introduce a sortable table view", "Add a bulk-action bar for row selection"],
        rationale: "Completionists and data lovers want scannable columns; the same data becomes comparable at a glance.",
        tradeoffs: ["Field definitions differ per media type", "Tables are not cover-first"],
      },
      {
        id: "logs-c",
        label: "C",
        title: "Status kanban board",
        tagline: "Drag logs between lists (Backlog / In-progress / Completed / Dropped).",
        inspiredBy: ["MyAnimeList", "Trello"],
        effort: "Large",
        wireframe: wf([
          "[Backlog][Watching][Done][Drop]",
          "  ▢⇢▢⇢▢⇢▢  drag to change    ",
          "inline progress on each card  ",
        ]),
        coreIdea:
          "Organize by status columns and move logs via drag-and-drop; progress is updated inline on each card.",
        desktop:
          "Four columns; dragging a card updates its status, with an optional 'did you finish?' confirmation.",
        mobile:
          "Wide horizontally-scrollable board; tap-and-hold to lift and re-drop, or a status-picker sheet as a low-effort fallback.",
        changes: ["Add a status board (optional view)", "Wire drag-and-drop to the existing list model"],
        rationale: "MAL/AniList proved status boards clarify progress and turn list maintenance into planning.",
        tradeoffs: ["Large re-architecture for a niche", "Kanban is awkward for very long lists"],
      },
    ],
  },

  {
    id: "stats",
    page: "Statistics",
    type: "Page",
    icon: BarChart3,
    currentUx:
      "Stat widgets (time by category / month / year / people), a graph and a recent-logs section.",
    options: [
      {
        id: "stats-a",
        label: "A",
        title: "Momentum stat cards",
        tagline: "Sparklines, deltas and richer rings and breakdowns.",
        inspiredBy: ["The StoryGraph", "AniCards"],
        effort: "Medium",
        preview: <ConceptStats />,
        coreIdea:
          "Give each stat card a mini sparkline + a % delta vs the previous period, plus hour-by-genre bars and a library-status donut.",
        desktop:
          "A 4-up trend-card grid, then a 2-up row (time by category bars + status donut); a period switcher (month / 12-mo / year) at top.",
        mobile:
          "Cards stack to a 2-up grid; the donut becomes a compact row; one vertical scroll for the whole page.",
        changes: ["Add sparklines, deltas and comparison baselines", "Add breakdown bars and a status donut"],
        rationale:
          "StoryGraph/AniCards make stats feel alive; adding direction turns raw numbers into shareable pride.",
        tradeoffs: ["Requires computing a comparison baseline", "Rings/bars must scale well on mobile"],
      },
      {
        id: "stats-b",
        label: "B",
        title: "Customizable module dashboard",
        tagline: "The stats page becomes draggable modules you tailor.",
        inspiredBy: ["The StoryGraph Plus", "Custom blocks"],
        effort: "Medium",
        wireframe: wf([
          "┌───────────┬───────────────┐",
          "│ Hours     │ Top genres    │",
          "│ 84h ▲12%  │ Sci-Fi 38%    │",
          "├───────────┼───────────────┤",
          "│ Streak    │ Calendar      │",
          "│ 7 days    │ (heatmap)     │",
          "└───────────┴───────────────┘",
          "drag to reorder · edit mode ",
        ]),
        coreIdea:
          "Drag stat widgets into any layout, add or remove modules, and persist the layout to the account for deep personalization.",
        desktop:
          "All analytics live in a grid of draggable cards; a module library to add/remove; layout saved per-account.",
        mobile:
          "A clean default grid; 'Edit' mode lets you long-press tiles to reorder and toggle visibility.",
        changes: ["Make the stats page a configurable module grid", "Persist layouts per account"],
        rationale:
          "Power users get an intrinsic, self-served 'custom dashboard' — a strong differentiator like StoryGraph Plus.",
        tradeoffs: ["More state and edge cases", "Needs persistence and empty-module handling"],
      },
      {
        id: "stats-c",
        label: "C",
        title: "Year calendar & recap",
        tagline: "Merge an activity map + wrap-up into one 'Your year' story.",
        inspiredBy: ["Trakt", "GitHub", "AniList", "The StoryGraph"],
        effort: "Medium",
        preview: <ConceptHeatmap />,
        coreIdea:
          "A single yearly activity map (heatmap) plus a seeded wrap-up: top genres, hours, longest streak and busiest months.",
        desktop:
          "Top: the heatmap; below: highlight cards (top genre, hours, streak); an expandable full 'year in review' section.",
        mobile:
          "The heatmap collapses to a month view; highlights render as bold stat pills; the recap can be exported/shared.",
        changes: ["Add a yearly activity heatmap", "Add a shareable year-in-review block"],
        rationale:
          "A strong year-end moment like StoryGraph/Letterboxd turns a year of logging into shareable pride.",
        tradeoffs: ["Heatmap needs per-day activity data", "Large libraries need performant aggregation"],
      },
    ],
  },
];