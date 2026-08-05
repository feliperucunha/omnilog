import { Clapperboard, Search, Settings } from "lucide-react";
import type { ProposalTopic } from "../proposalTypes";
import { wf } from "../proposalTypes";

export const section2: ProposalTopic[] = [
  {
    id: "item",
    page: "Item detail page",
    type: "Page",
    icon: Clapperboard,
    currentUx:
      "A media hero with a back button, facts grid, your log/review forms and community reviews stacked vertically.",
    options: [
      {
        id: "item-a",
        label: "A",
        title: "Hero-driven detail",
        tagline: "Cinematic backdrop, poster, and an always-visible primary action.",
        inspiredBy: ["Trakt", "IMDb", "Letterboxd"],
        effort: "Medium",
        wireframe: wf([
          "┌──────────────────────────────",
          "│  ▾ back        ⠀ Share      │",
          "│ ┌─┐  Title (year)           │",
          "│ │P│  [In Progress] · 7.8 ★  │",
          "│ └─┘  ▸ your progress ring   │",
          "│     [ + Log ] [ Review ]    │",
          "│  ─ media facts ─ reviews ─  │",
          "└──────────────────────────────",
        ]),
        coreIdea:
          "A full-width backdrop hero with the poster overlaid, the primary CTA ('Log' / 'Review' / resume progress) always visible, and a progress ring for in-progress items.",
        desktop:
          "Backdrop hero with poster; right side holds title, status, rating and the sticky primary action; below, facts grid and community reviews.",
        mobile:
          "Backdrop collapses to a compact header; the primary action sticks to the bottom so it is always thumb-reachable while scrolling reviews.",
        changes: ["Add a backdrop hero and sticky primary CTA", "Surface in-progress progress ring on the hero"],
        rationale:
          "Trakt/IMDb keep the 'what do I do here' answer on screen at all times; a hero makes the item feel like content, not a form.",
        tradeoffs: ["Backdrop images need reliable art", "Sticky action consumes mobile vertical space"],
      },
      {
        id: "item-b",
        label: "B",
        title: "Split: media + your activity",
        tagline: "Desktop columns separate facts from your log and friends.",
        inspiredBy: ["AniList", "Trakt"],
        effort: "Medium",
        wireframe: wf([
          "┌──────────────────────────────",
          "│ [media facts  |  YOUR LOG   ]│",
          "│  poster      |  status★log  │",
          "│  genres      |  dates, prg  │",
          "│  similar     |  reviews     │",
          "│  ...         |  friends     │",
          "└──────────────────────────────",
        ]),
        coreIdea:
          "A two-column layout on desktop: left is the canonical media fact sheet (metadata, cast, similar), right is a personal panel (your log, your reviews, friends' activity).",
        desktop:
          "Two scrollable columns; the personal panel is sticky so your actions stay put while reading facts.",
        mobile:
          "Columns become stacked sheets: 'About' and 'Your activity' toggle, or a bottom sheet hosts your log while the page scrolls.",
        changes: ["Restructure the page into fact/activity columns", "Make your-log panel sticky on desktop"],
        rationale:
          "Separating 'about this thing' from 'what I did' (AniList) reduces cognitive load and keeps user data on top.",
        tradeoffs: ["More layout code and breakpoint states", "Small screens need a sheet/tab reconciliation"],
      },
      {
        id: "item-c",
        label: "C",
        title: "Episodic progress logger",
        tagline: "One-tap episode/chapter logs and a per-season progress meter.",
        inspiredBy: ["AniList", "Trakt"],
        effort: "Medium",
        wireframe: wf([
          "┌──────────────────────────────",
          "│ Next episode: S2E5 'Ravaged' │",
          "│ [+ Log episode]  Ep 4/9      │",
          "│ ── season progress ──        │",
          "│ ✓ S2E4   ✓ S2E3   ☐ S2E2    │",
          "│ + backfill a rewatch/date    │",
          "└──────────────────────────────",
        ]),
        coreIdea:
          "For episodic media, a 'Next episode' callout with a one-tap '+ Log episode', a season progress meter, and the ability to backfill a rewatch or a past date.",
        desktop:
          "Next-episode card with a log button; an episode grid with logged states; a progress bar for the whole show.",
        mobile:
          "A full-width 'Log episode' button sized for thumbs; each row is a 44px target; logged episodes record the date and feed streaks.",
        changes: ["Add next-episode callout and quick episode log", "Track episode-level progress in the log model"],
        rationale:
          "Logging the next episode is the core daily habit for serialized media; one tap keeps progress honest without breaking flow.",
        tradeoffs: ["Episode-level data model changes", "Only meaningful for serialized media"],
      },
    ],
  },

  {
    id: "search",
    page: "Search",
    type: "Page",
    icon: Search,
    currentUx:
      "A big centered search bar with a category strip, recommendations carousels, and a results list.",
    options: [
      {
        id: "search-a",
        label: "A",
        title: "Keyboard-first quick search",
        tagline: "Instant dropdown results with arrow-key navigation and a '/' shortcut.",
        inspiredBy: ["Spotify", "GitHub", "Raycast"],
        effort: "Medium",
        wireframe: wf([
          "  /  focus search from anywhere",
          "┌──────────────────────────────",
          "│ 🔍  dune                  ✕  │",
          "│ ▸ Movie   Dune (2021)      │",
          "│ ▸ Movie   Dune: Part Two   │",
          "│ ▸ Book    Dune: House Atre-│",
          "│  ↑↓ to move · ↵ to open    │",
          "└──────────────────────────────",
        ]),
        coreIdea:
          "Search is a command surface: type anywhere to get an instant grouped dropdown (movie/tv/book/game), navigate with arrows, Enter to open.",
        desktop:
          "A '/' shortcut focuses search from any page; results render in a dropdown with keyboard navigation and type-ahead.",
        mobile:
          "Search opens full-screen on focus; recent searches and a scan of media-type tabs on the top of results.",
        changes: ["Add a global slash shortcut + dropdown results", "Add keyboard navigation and recent searches"],
        rationale:
          "Power users type; keyboard-first search (Spotify/Raycast) is the fastest path from intent to item.",
        tradeoffs: ["Global shortcut conflicts need care", "Dropdown vs page model changes"],
      },
      {
        id: "search-b",
        label: "B",
        title: "Browse hub",
        tagline: "Trending, popular and seasonal rails per category.",
        inspiredBy: ["AniList", "JustWatch"],
        effort: "Medium",
        wireframe: wf([
          "  ┌────────────────────────────",
          "  │ [Movies][TV][Games][Books]│",
          "  │ Popular this month        │",
          "  │  ▹▹▹▹▹  cover rail        │",
          "  │ Trending (last 7d)        │",
          "  │  ▹▹▹▹▹  cover rail        │",
          "  │ filters: year, genre,…   │",
          "  └────────────────────────────",
        ]),
        coreIdea:
          "Turn the idle search page into a browse hub: category tabs plus 'Popular this month', 'Trending' and seasonal/format rails.",
        desktop:
          "Category tabs switch the whole rail set; each rail is a horizontal cover strip with an optional 'see all'.",
        mobile:
          "Rails scroll horizontally; the category strip is sticky; infinite-scroll grids on drill-in.",
        changes: ["Replace static recommendations with themed rails", "Add seasonal/format browse filters"],
        rationale:
          "Discovery peers (AniList/JustWatch) browse first, search second; rails create serendipity and lower the barrier to logging.",
        tradeoffs: ["Needs recommendation data per rail", "More content means more caching"],
      },
      {
        id: "search-c",
        label: "C",
        title: "Grouped universal results",
        tagline: "One query, grouped results with counts and tabs.",
        inspiredBy: ["Google", "Spotify"],
        effort: "Small",
        wireframe: wf([
          "Results for 'dune' (214)",
          "Movies (2)   ▸ Dune · Dune Pt2",
          "Books (38)   ▸ Dune (novel)… ",
          "Games (3)    ▸ Dune: Imperium",
          "  [See all in Movies →]      ",
        ]),
        coreIdea:
          "Every query returns a grouped list (each media type is a section with a count) plus tabs to scope results to one category.",
        desktop:
          "Sections for each media type with counts; clicking a section header jumps to the scoped tab of that type.",
        mobile:
          "Grouped cards with counts; a quick tab strip at top to filter to one type; recent searches above results.",
        changes: ["Group results by media type with counts", "Add scoped category tabs to results"],
        rationale:
          "Universal search with grouping (Google/Spotify) answers 'where is it' fast and surfaces the right catalog for the user's habit.",
        tradeoffs: ["Needs parallel category queries", "Grouped lists can feel long on mobile"],
      },
    ],
  },

  {
    id: "settings",
    page: "Settings",
    type: "Page",
    icon: Settings,
    currentUx:
      "Tabs (App / User) over long vertical sections: account, subscription, visibility, language, data tools.",
    options: [
      {
        id: "settings-a",
        label: "A",
        title: "Searchable grouped settings",
        tagline: "iOS-style sections with a search filter and jump list.",
        inspiredBy: ["iOS Settings", "Linear"],
        effort: "Medium",
        wireframe: wf([
          "🔍 Search settings…         ",
          "┌────────────────────────────",
          "│ PROFILE                    │",
          "│   Visibility        ▾ Public│",
          "│   Language          ▾ PT-BR│",
          "│ DATA                       │",
          "│   Export            ▾ CSV  │",
          "│   Import board games   →   │",
          "└────────────────────────────",
        ]),
        coreIdea:
          "Group every setting under clear headers (Profile, Data, Notifications, Plans) with a search filter that narrows the visible rows.",
        desktop:
          "A persistent search box filters rows in place; sections are collapsible; values shown inline on the right.",
        mobile:
          "Rows are tappable and open a right-hand panel or bottom sheet; search behaves like iOS Settings.",
        changes: ["Regroup settings into labeled sections", "Add a search filter across settings"],
        rationale:
          "Long flat settings pages lose discoverability; grouped+searchable (iOS/Linear) is the proven pattern.",
        tradeoffs: ["Large re-grouping effort", "Nested screens add taps for power users"],
      },
      {
        id: "settings-b",
        label: "B",
        title: "Single-column sheets",
        tagline: "Every setting is one row; details open in a drawer.",
        inspiredBy: ["iOS", "Notion"],
        effort: "Small",
        wireframe: wf([
          "┌────────────────────────────",
          "│ Language           ▸ PT-BR │",
          "│ Theme              ▸ Dark  │",
          "│ Email recap        [On]    │",
          "│ Complete modal     [On]    │",
          "│ Export data        ▸       │",
          "│ ─ tap a row → drawer ─     │",
          "└────────────────────────────",
        ]),
        coreIdea:
          "Each setting is a single row with its current value on the right; tapping opens a focused drawer/sheet with the control.",
        desktop:
          "A clean list; the drawer becomes a right-side panel; values update inline after change.",
        mobile:
          "Native-feel bottom sheets per row; toggles inline, complex options open the sheet.",
        changes: ["Flatten sections into a value-inline list", "Open settings detail in drawers"],
        rationale:
          "Value preview + one-tap edit (iOS/Notion) reduces page jumping and is highly mobile friendly.",
        tradeoffs: ["Grouping is less obvious", "Drawer stack needs good back handling"],
      },
      {
        id: "settings-c",
        label: "C",
        title: "Account dashboard",
        tagline: "Profile card, plan card and data tools front and center.",
        inspiredBy: ["Spotify account", "GitHub settings"],
        effort: "Medium",
        wireframe: wf([
          "┌────────────────────────────",
          "│ [avatar]  Felipe · @name   │",
          "│ Pro · renews Sep 12        │",
          "│ ─────────────────────────  │",
          "│ ▢ Profile   ▢ Privacy      │",
          "│ ▢ Plan/↑   ▢ Data tools    │",
          "│ quick tiles → settings     │",
          "└────────────────────────────",
        ]),
        coreIdea:
          "Open Settings with a summary: your profile card, subscription status (with an upgrade CTA), usage, and quick tiles for the main areas.",
        desktop:
          "A 2-3 column grid of area tiles on top; the usual settings below; the plan card always shows a path to Pro.",
        mobile:
          "A profile header with plan badge; tiles act as fast entry points; usage meter (500 logs) visible on the plan tile.",
        changes: ["Add an account summary header + area tiles", "Surface plan/usage with an upgrade path"],
        rationale:
          "Account dashboards (Spotify/GitHub) answer 'who am I here and what is my plan' at a glance and improve upsell.",
        tradeoffs: ["Duplicates content with other pages", "Needs care to avoid a second dashboard"],
      },
    ],
  },
];