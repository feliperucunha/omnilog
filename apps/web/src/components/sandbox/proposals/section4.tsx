import { UserRound, Rocket, PlusCircle, PencilLine, MessageSquarePlus } from "lucide-react";
import type { ProposalTopic } from "../proposalTypes";
import { wf } from "../proposalTypes";
import { ConceptQuickAdd } from "../ConceptQuickAdd";
import { ConceptEditSheet } from "../ConceptEditSheet";
import { ConceptReviewSheet } from "../ConceptReviewSheet";
import { ConceptWrapUp } from "../ConceptWrapUp";

export const section4: ProposalTopic[] = [
  {
    id: "profile",
    page: "Public profile",
    type: "Page",
    icon: UserRound,
    currentUx:
      "A user page with avatar, bio, stats, badges, and tabbed content (logs, reviews, market).",
    options: [
      {
        id: "profile-a",
        label: "A",
        title: "Showcase profile",
        tagline: "Cover banner, stats chips, badges row and a favorite collage.",
        inspiredBy: ["Letterboxd", "MAL", "AniList"],
        effort: "Medium",
        preview: <ConceptWrapUp />,
        coreIdea:
          "A cover banner + avatar, a row of stat chips (logs, hours, streak, average), a badges row, and a favorite-media collage before the tabbed content.",
        desktop:
          "Banner across the top; avatar overlapping; chips and badges in one strip; favorites as a 5-up collage.",
        mobile:
          "Banner collapses to a header accent; chips wrap into 2 columns; favorites become a horizontal rail.",
        changes: ["Add a cover banner and stat chips", "Add a favorites collage and badges row"],
        rationale:
          "Showcase profiles (Letterboxd/AniList) make profiles feel like a place to be; social proof grows follow-worthy content.",
        tradeoffs: ["Banner assets and layout effort", "Collage needs cover images"],
      },
      {
        id: "profile-b",
        label: "B",
        title: "Feed-first profile",
        tagline: "The profile is a live activity feed with a floating stats panel.",
        inspiredBy: ["Instagram", "Trakt"],
        effort: "Medium",
        wireframe: `┌────────────────────────────
│ [avatar] Name · ✎ Edit     │
│ @user · 214 logs · ★ 7.8  │
│ ── activity ────────────── │
│ Felipe logged Dune ★4 (2d) │
│ Felipe finished Severance  │
│ Felipe rated a review (3d) │
│ ▸ pinned year recap        │
└────────────────────────────`,
        coreIdea:
          "The default view is a chronological activity feed (log, finished, review) with a compact stats sidebar on desktop.",
        desktop:
          "Two columns: the feed and a sticky stats card (counts, streaks, badges, year recap teaser).",
        mobile:
          "Feed only; stats accessible via a top stats pill that opens a sheet.",
        changes: ["Repurpose tabs into a feed-first layout", "Float the stats into a compact card"],
        rationale:
          "Feeds (Instagram/Trakt) create return loops; activity is the freshest content a profile has.",
        tradeoffs: ["Loses the clean log-grid glance", "Needs a durable activity stream"],
      },
      {
        id: "profile-c",
        label: "C",
        title: "Compact widget grid",
        tagline: "Grid of media cards + stats sidebar, dense and shareable.",
        inspiredBy: ["Backloggd", "MAL"],
        effort: "Small",
        wireframe: `┌────────────────────────────
│ [avatar] Name    stats col │
│ ── media grid ──  logs 214 │
│  ▢▢▢▢▢▢▢▢        hours 84 │
│  ▢▢▢▢▢▢▢▢        streak 7 │
│  tabs: all/movies/…       │
└────────────────────────────`,
        coreIdea:
          "A compact grid of media covers fills the page; a slim right column holds stats and badges; everything stays scannable and screenshot-worthy.",
        desktop:
          "Left grid (dense covers with hover ratings), right sticky stats sidebar, top tabs by category.",
        mobile:
          "Grid only; stats open in a bottom sheet; category tabs filter in place.",
        changes: ["Refocus on a cover grid", "Move stats into a slim sidebar/sheet"],
        rationale:
          "Grid profiles (Backloggd/MAL) maximize content per scroll and are easy to share.",
        tradeoffs: ["Stats are less visible by default", "Smaller identity area"],
      },
    ],
  },

  {
    id: "landing",
    page: "Landing / marketing",
    type: "Page",
    icon: Rocket,
    currentUx:
      "A gradient hero with floating media, feature sections and CTA.",
    options: [
      {
        id: "landing-a",
        label: "A",
        title: "Product-led tour",
        tagline: "Show real logging screens by category instead of abstract features.",
        inspiredBy: ["Linear", "Notion"],
        effort: "Medium",
        wireframe: `┌────────────────────────────
│  Log everything you love   │
│ [ Try free ] [ See it live ]│
│ ───── product carousel ────│
│ ▹ Logs ▹ Progress ▹ Stats  │
│ real screens, one benefit  │
└────────────────────────────`,
        coreIdea:
          "Replace generic feature bullets with real, category-specific product screens (log list, episode progress, stats) in a carousel with captions.",
        desktop:
          "A tabbed screenshot carousel per category; each shot has a one-line caption that maps to a benefit.",
        mobile:
          "Screenshots swipe horizontally; captions below; CTAs repeat after the tour.",
        changes: ["Build a screenshot/carousel tour by category", "Caption shots with benefits"],
        rationale:
          "Product-led marketing (Linear/Notion) lets the product sell itself; seeing your own logging workflow in context converts.",
        tradeoffs: ["Needs polished screenshots of real data", "Carousel maintenance"],
      },
      {
        id: "landing-b",
        label: "B",
        title: "Try-it-in-page demo",
        tagline: "A live, sandboxed demo of the app without an account.",
        inspiredBy: ["Figma", "Roam", "Spotify player"],
        effort: "Large",
        wireframe: `┌────────────────────────────
│ Try it right here          │
│ ┌ mini app preview ──────┐ │
│ │ search 'dune' → log it │ │
│ │ (sample data, no signup)│ │
│ └────────────────────────┘ │
│ [ Create free account ]    │
└────────────────────────────`,
        coreIdea:
          "Embed a small interactive demo (sample data) directly on the landing page: search an item, log it, see a stat update — no account needed.",
        desktop:
          "A framed mini-app in the hero; interactions work on seeded demo data.",
        mobile:
          "The demo occupies a swipeable phone frame; the CTA sits right below.",
        changes: ["Embed a sandboxed mini-app demo", "Seeded demo dataset and reset"],
        rationale:
          "Interactive demos (Figma/Roam) create the 'aha' before signup — the strongest activation play.",
        tradeoffs: ["Real engineering effort", "Demo must stay in sync with the real app"],
      },
      {
        id: "landing-c",
        label: "C",
        title: "Story-driven explainer",
        tagline: "Narrative scroll: problem → tool → stats → community.",
        inspiredBy: ["Apple product pages", "Loom"],
        effort: "Medium",
        wireframe: wf([
          "┌────────────────────────────",
          " 01 · You consume a lot.     ",
          "     (the problem, moody)    ",
          " 02 · Log it all in seconds. ",
          "     (the tool, product)     ",
          " 03 · Stats that feel like   ",
          "     progress. (the payoff)  ",
          " 04 · Join the community.    ",
          "  [ CTA ]                    ",
          "└────────────────────────────",
        ]),
        coreIdea:
          "A scroll-driven narrative in 4 beats — the problem, the tool, the stats payoff, community — each with its own visual and a single CTA at the end.",
        desktop:
          "Full-height scroll sections with reveal animations; one beat per scroll.",
        mobile:
          "Longer sections, sticky progress dots; the CTA re-appears in the last beat.",
        changes: ["Restructure the landing into narrative beats", "Add scroll-driven reveal animations"],
        rationale:
          "Story sells the why (Apple/Loom); a coherent narrative raises perceived value and trust.",
        tradeoffs: ["Copy + visual craft heavy", "Slow builds and motion budget"],
      },
    ],
  },

  {
    id: "workflow-add",
    page: "Workflow: add a log (quick add)",
    type: "Workflow",
    icon: PlusCircle,
    currentUx:
      "Adding a log requires entering a category and opening its log form; there is no global quick-add.",
    options: [
      {
        id: "workflow-add-a",
        label: "A",
        title: "Quick-add FAB with fan-out",
        tagline: "One tap anywhere: pick the media type, log instantly.",
        inspiredBy: ["iOS/Android FABs", "Roam"],
        effort: "Medium",
        preview: <ConceptQuickAdd />,
        coreIdea:
          "A docked FAB fans out media-type actions for instant logging; the sheet remembers your last category and most-used items.",
        desktop:
          "A floating action button bottom-right; it expands a menu (movies, tv, games, books, boardgames) that opens the scoped quick-log sheet.",
        mobile:
          "The FAB sits above the bottom dock; fan-out actions are large thumb targets; a recent-items row speeds up repeat logs.",
        changes: ["Add a global quick-add affordance", "Remember last category and frequent items"],
        rationale:
          "The #1 cost of logging is starting it; a one-tap global add (Roam/iOS FABs) removes that cost.",
        tradeoffs: ["Overlaps the dock on small screens", "Needs a clean back-to-context flow"],
      },
      {
        id: "workflow-add-b",
        label: "B",
        title: "Universal '+' in the nav",
        tagline: "One consistent plus button across top and bottom nav.",
        inspiredBy: ["Google Drive", "Apple Mail"],
        effort: "Small",
        wireframe: wf([
          "  [Dashboard] [Stats] [+][Search]",
          "             ↑ the '+ ' button ",
          " taps → sheet: pick media type, ",
          " then the same scoped form.    ",
        ]),
        coreIdea:
          "A single, consistent '+' button in both the desktop sidebar and mobile dock opens the same quick-add sheet from anywhere.",
        desktop:
          "A distinct '+' item in the sidebar (not just an icon) triggers the same sheet as mobile.",
        mobile:
          "The '+' sits in the dock, centered and emphasized, and opens a media-type picker sheet.",
        changes: ["Add a '+' to sidebar and dock", "One shared quick-add sheet"],
        rationale:
          "Consistency beats cleverness: users learn one universal affordance (Drive/Mail) and form a fast habit.",
        tradeoffs: ["Dock space is precious", "Center '+' competes with the active tab"],
      },
      {
        id: "workflow-add-c",
        label: "C",
        title: "In-context adding",
        tagline: "Every surface offers a contextual 'add' where you already are.",
        inspiredBy: ["AniList", "Notion"],
        effort: "Medium",
        wireframe: wf([
          " search row:  [result] [+ Log] ",
          " item page:   [ + Log / Review]",
          " empty list:  [Log your first]",
          " review card: [Add review]     ",
          " every surface has a next step",
        ]),
        coreIdea:
          "Instead of one global affordance, place contextual add buttons everywhere context already exists: search results, item pages, empty states, category lists.",
        desktop:
          "Search results get an inline '+ Log'; item pages lead with the CTA; empty states show a guided first action.",
        mobile:
          "Same inline actions, sized for thumbs; the empty-state CTA becomes a full-width button.",
        changes: ["Add inline log actions across surfaces", "Upgrade empty states with guided CTAs"],
        rationale:
          "Contextual actions (AniList/Notion) capture intent at the exact moment, minimizing navigation.",
        tradeoffs: ["Requires touching many components", "Risk of CTA clutter"],
      },
    ],
  },

  {
    id: "workflow-edit",
    page: "Workflow: edit / complete an item",
    type: "Workflow",
    icon: PencilLine,
    currentUx:
      "Editing happens in a full log form or an in-card expansion; completing media can be multi-step for board games.",
    options: [
      {
        id: "workflow-edit-a",
        label: "A",
        title: "Single-sheet editor",
        tagline: "One bottom sheet/dialog for status, progress, date, rating — with undo.",
        inspiredBy: ["iOS sheets", "Linear"],
        effort: "Medium",
        preview: <ConceptEditSheet />,
        coreIdea:
          "Editing is one sheet: status segmented control, progress slider, date, rating, notes. Saving shows a transient 'Saved — Undo'.",
        desktop:
          "A centered dialog with the same fields; Undo toast; keyboard shortcuts to save.",
        mobile:
          "A bottom sheet that respects the keyboard; the save button is a large sticky target.",
        changes: ["Unify edit into one sheet", "Add optimistic save + undo"],
        rationale:
          "A single consistent editor (iOS/Linear) reduces form fear; undo removes the cost of mistakes.",
        tradeoffs: ["Complex media types may need extra tabs", "Undo needs a lightweight undo log"],
      },
      {
        id: "workflow-edit-b",
        label: "B",
        title: "Inline card editing",
        tagline: "Edit right in the list without leaving it.",
        inspiredBy: ["Notion", "Trello"],
        effort: "Medium",
        wireframe: wf([
          "▢ Severance ▓2×4  [Edit ▾]   ",
          "  ↳ expanded card            ",
          "   status: [Watching ▾]      ",
          "   progress: ▓▓▓░░ 34%       ",
          "   date: 12/08 · ★ 4         ",
          "   [Save]  changes stay      ",
        ]),
        coreIdea:
          "Cards expand in place to reveal the editor fields; saving animates the card closed with the new values — no navigation.",
        desktop:
          "Click Edit expands the card; fields edit inline; changes apply with an animated card refresh.",
        mobile:
          "Tap Edit expands the card and scrolls it into view; a sticky Save completes the edit.",
        changes: ["Expandable edit inside list cards", "Animate save-to-updated-card"],
        rationale:
          "In-place editing (Notion/Trello) keeps you in flow and avoids modal context switches for frequent tweaks.",
        tradeoffs: ["Cramped on small cards", "Complex fields (matches) need an overflow sheet"],
      },
      {
        id: "workflow-edit-c",
        label: "C",
        title: "Wizard for complex entries",
        tagline: "Step-by-step for board games, TV seasons and other deep logs.",
        inspiredBy: ["Typeform", "Airline booking"],
        effort: "Large",
        wireframe: wf([
          " Step 1 · Status  [Completed]",
          " Step 2 · Progress [10 plays] ",
          " Step 3 · Details  [weights,  ",
          "             score, notes]   ",
          " Step 4 · Summary + Save      ",
          " progress dots · back/next   ",
        ]),
        coreIdea:
          "For complex entries (board game matches, TV seasons, rewatches), split the edit into a short wizard so each field gets focus.",
        desktop:
          "A stepper dialog with back/next and validation per step; summary step previews the saved card.",
        mobile:
          "Full-screen steps with swipe-back; big, clear inputs per screen.",
        changes: ["Build a stepper for complex media types", "Add a final summary step"],
        rationale:
          "Deep logs overwhelm in one screen (Typeform-style); steps reduce errors and increase completion.",
        tradeoffs: ["Overkill for simple logs", "Longer to reach 'done'"],
      },
    ],
  },

  {
    id: "workflow-review",
    page: "Workflow: add a review / rating",
    type: "Workflow",
    icon: MessageSquarePlus,
    currentUx:
      "Reviews are added through the log form or an in-card review expansion with rating, text and scope.",
    options: [
      {
        id: "workflow-review-a",
        label: "A",
        title: "Rich review sheet",
        tagline: "Stars + mood/genre tags + prose with autosave.",
        inspiredBy: ["The StoryGraph", "Letterboxd"],
        effort: "Medium",
        preview: <ConceptReviewSheet />,
        coreIdea:
          "A dedicated review sheet: quarter/star rating, mood/genre tags, prose with a character counter, and autosave of the draft.",
        desktop:
          "A dialog with the rating row, tag chips and a large textarea; autosave indicator; publish + save-draft actions.",
        mobile:
          "A bottom sheet with keyboard-aware layout; tags wrap; autosave persists on blur so nothing is lost.",
        changes: ["Add mood/tag chips and draft autosave", "Dedicated review surface instead of the log form"],
        rationale:
          "Reviewing is emotional; tags + drafts (StoryGraph/Letterboxd) lower the bar and raise review quality.",
        tradeoffs: ["Draft storage and cleanup", "Tag taxonomy needs defining"],
      },
      {
        id: "workflow-review-b",
        label: "B",
        title: "Guided templates",
        tagline: "One-tap structured reviews ('quick review') per media type.",
        inspiredBy: ["Goodreads", "Backloggd"],
        effort: "Small",
        wireframe: wf([
          " Quick review — Dune: Part Two",
          " ★★★★☆  [Save]              ",
          " or a guided template:       ",
          "  ✓ verdict (worth it?)      ",
          "  ✓ highlight                ",
          "  ✓ who it's for             ",
          " optional long form below    ",
        ]),
        coreIdea:
          "Offer a 'quick review' template — verdict, highlight, who it's for — that reads great and is fast, with the long form as an optional tab.",
        desktop:
          "Template fields as text prompts; a star row on top; 'Publish' vs 'Save draft'.",
        mobile:
          "Short template fields; big tap targets; the long form collapses behind 'Write more'.",
        changes: ["Add media-appropriate review templates", "Make the long form optional"],
        rationale:
          "Guided prompts (Goodreads/Backloggd) produce better reviews than a blank box and take less effort.",
        tradeoffs: ["Templates feel rigid to some", "Long-form reviewers may want the raw box"],
      },
      {
        id: "workflow-review-c",
        label: "C",
        title: "Draft center & batch review",
        tagline: "Save drafts anywhere, review your backlog in one place.",
        inspiredBy: ["Notion drafts", "Goodreads"],
        effort: "Medium",
        wireframe: wf([
          " Drafts (3) · for you        ",
          " ▢ Severance — 80% done      ",
          " ▢ Dune: Part Two — stars    ",
          " ▢ The Bear — outline        ",
          " [Review backlog] → list of  ",
          " finished items missing a   ",
          " review, star & done each   ",
        ]),
        coreIdea:
          "A drafts center + a 'review backlog' list: finished items without reviews can be rated and written in one screen.",
        desktop:
          "Two panels: drafts and a backlog list; finishing a draft or backlog item updates the profile feed.",
        mobile:
          "A drafts sheet; the backlog is a checklist with inline stars and a slide-up editor.",
        changes: ["Add a draft center", "Add a review-backlog batch flow"],
        rationale:
          "Batch workflows (Notion/Goodreads) clear the 'I owe reviews' feeling and increase review volume.",
        tradeoffs: ["Draft/review state model", "A whole new surface to build"],
      },
    ],
  },
];