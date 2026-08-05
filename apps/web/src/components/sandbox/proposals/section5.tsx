import { GraduationCap, Tags, FileText } from "lucide-react";
import type { ProposalTopic } from "../proposalTypes";
import { wf } from "../proposalTypes";

export const section5: ProposalTopic[] = [
  {
    id: "onboarding",
    page: "Onboarding & first-run",
    type: "Workflow",
    icon: GraduationCap,
    currentUx:
      "A multi-step onboarding wizard (categories, preferences, initial items) with skip options and a dev preview toggle.",
    options: [
      {
        id: "onboarding-a",
        label: "A",
        title: "3-step value ramp",
        tagline: "Account → categories → your first log, with real feedback.",
        inspiredBy: ["Headspace", "AniList"],
        effort: "Large",
        wireframe: wf([
          " Step 1 · What do you love?  ",
          "   [Movies][TV][Books] [Skip]",
          " Step 2 · Pick a look        ",
          "   theme · language · view  ",
          " Step 3 · Log your first     ",
          "   search 'dune' → [Log it] ",
          " progress bar, always skippable",
        ]),
        coreIdea:
          "Ruthlessly short onboarding: ask only what changes the experience (visible categories, language/theme), then drop the user into a first-log action so they feel value in under a minute.",
        desktop:
          "A compact 3-step wizard with a persistent progress bar and an always-visible Skip; the last step is a real search + log.",
        mobile:
          "Full-screen steps with a bottom Continue; toggles use big native controls; the first-log step is one tap on a recommended item.",
        changes: ["Cut onboarding to 3 outcome-focused steps", "End onboarding in a logged item"],
        rationale:
          "Activation wins when the 'aha' (a saved log) happens in the first session (Headspace/AniList).",
        tradeoffs: ["Large flow rework", "Risk: users skip to an empty app"],
      },
      {
        id: "onboarding-b",
        label: "B",
        title: "Spotlight overlay",
        tagline: "Keep signup minimal; teach in-place with spotlights.",
        inspiredBy: ["Linear", "Figma"],
        effort: "Small",
        wireframe: wf([
          "  ┌─ next ───────────────┐   ",
          "  │ 1/3 Add a log         │   ",
          "  │ highlight the '+'     │   ",
          "  │ [Got it] [Skip tour]  │   ",
          "  └──────────────────────┘   ",
          "  real app visible behind    ",
        ]),
        coreIdea:
          "Keep the existing registration, then run a contextual spotlight tour on the real dashboard (this app already has an onboarding-spotlight system) instead of a separate wizard.",
        desktop:
          "3-4 sequential spotlights over the actual UI ('Search here', 'Add a log here', 'Stats are here') with Got-it/Skip controls.",
        mobile:
          "The same tour adapts to the dock and FAB; it resumes from where the user last was.",
        changes: ["Replace the separate wizard with in-app spotlights", "Reuse the existing spotlight infra"],
        rationale:
          "Contextual teaching (Linear/Figma) beats abstract wizards and avoids a throwaway flow.",
        tradeoffs: ["Depends on a stable UI to highlight", "Users can dismiss and stay lost"],
      },
      {
        id: "onboarding-c",
        label: "C",
        title: "Taste-first import",
        tagline: "Import or 'try on' with a starter set, then personalize.",
        inspiredBy: ["Spotify onboarding", "Letterboxd import"],
        effort: "Medium",
        wireframe: wf([
          " Step 1 · Import your stuff? ",
          "  [CSV] [Board game collection]",
          " Step 2 · Pick 5 favorites   ",
          "  ▢ Dune ▢ Severance ▢ Elden ",
          "  ▢ The Bear ▢ BG3 [Next]   ",
          " → we recommend from your   ",
          "   picks + seed your library ",
        ]),
        coreIdea:
          "Let users import existing collections (CSV/board-game import already exists) or pick 5 favorites to seed recommendations and an instant home screen.",
        desktop:
          "Import-first flow for power users; a favorites-picker for everyone else; both land on a populated home.",
        mobile:
          "Simple tap-to-pick favorites grid; import is a secondary link for data migrators.",
        changes: ["Add an import-first onboarding path", "Seed the home from picks/import"],
        rationale:
          "An instant, full home (Spotify/Letterboxd) converts far better than an empty first session.",
        tradeoffs: ["Import parsing effort", "Favorites picker adds a step for some"],
      },
    ],
  },

  {
    id: "market-detail",
    page: "Market: listing detail & My listings",
    type: "Page",
    icon: Tags,
    currentUx:
      "A listing detail page (photos, description, seller, contact) and a 'My listings' management page.",
    options: [
      {
        id: "market-detail-a",
        label: "A",
        title: "Gallery-first listing",
        tagline: "Big photo gallery, price sticky, seller card + quick contact.",
        inspiredBy: ["Mercado Livre", "eBay"],
        effort: "Small",
        wireframe: `┌────────────────────────────
│ [📷 gallery — swipe]       │
│ Dune (Movie) · R$ 89       │
│ condition · location · 3d  │
│ ─ seller card ──────────── │
│ [Chat with seller] [Save]  │
│ description, specs below   │
└────────────────────────────`,
        coreIdea:
          "Make the photo gallery the hero, keep the price and contact sticky, and surface a seller card with trust signals (member since, rating, response time).",
        desktop:
          "Left: gallery + description; right sticky panel: price, condition, seller, and Chat/Save actions.",
        mobile:
          "Full-bleed swipeable gallery; a sticky bottom bar holds price + 'Chat with seller'.",
        changes: ["Rebalance toward a gallery + sticky commerce bar", "Add a seller trust card"],
        rationale: "Marketplace conversion lives on photos, price and trust (Mercado Livre/eBay).",
        tradeoffs: ["Depends on quality photos", "Sticky bars eat mobile space"],
      },
      {
        id: "market-detail-b",
        label: "B",
        title: "Seller-centric layout",
        tagline: "Lead with who's selling, and their other listings.",
        inspiredBy: ["Depop", "Vinted"],
        effort: "Medium",
        wireframe: `┌────────────────────────────
│ [seller]  @name · ★ 4.8    │
│ member since 2022 · 12h    │
│ [message seller] [follow]  │
│ ─ listing ──────────────── │
│ photo · price · condition  │
│ ─ more from @name ──────── │
│ ▹▹▹▹▹  rail                │
└────────────────────────────`,
        coreIdea:
          "Put the seller at the top (avatar, rating, response time) and cross-sell their other listings, building community and trust.",
        desktop:
          "Seller header, then the listing card, then a 'More from this seller' rail; follow/message actions persist in the sidebar.",
        mobile:
          "Seller card first, then the listing, then the rail; a floating message button stays in reach.",
        changes: ["Reorder the page around the seller", "Add cross-selling rail + follow"],
        rationale: "Depop/Vinted prove seller identity drives commerce and repeat visits.",
        tradeoffs: ["Trust signals require profile data", "Two-column layout must collapse cleanly"],
      },
      {
        id: "market-detail-c",
        label: "C",
        title: "My listings as a manager",
        tagline: "Manage listings like a shop: status, bump, sold, stats.",
        inspiredBy: ["Shopify", "Mercado Livre seller hub"],
        effort: "Medium",
        wireframe: wf([
          " My shop · 12 active · 3 sold  ",
          " [Active][Pending][Sold][Draft]",
          " Dune        views 120 · bump  ",
          " Firefly     views 34 · bump   ",
          " Elden Ring  SOLD  ✓ · remove  ",
          " sort · bulk actions · stats  ",
        ]),
        coreIdea:
          "Turn 'My listings' into a seller hub: status tabs (active/pending/sold/draft), view counts, a 'Bump' action, and bulk tools.",
        desktop:
          "Tabbed rows with views, status and actions; a summary header; bulk select for edit/deactivate.",
        mobile:
          "A compact manager list with a filter sheet and swipe actions.",
        changes: ["Add status tabs and a summary header", "Add view counts and a bump action"],
        rationale: "Seller hubs (Shopify/Mercado) reduce management friction and reward sellers.",
        tradeoffs: ["Needs listing metrics", "Bump may need a moderation/queue system"],
      },
    ],
  },

  {
    id: "info",
    page: "Info & legal (About / FAQ / Privacy / Terms)",
    type: "Page",
    icon: FileText,
    currentUx:
      "Static prose pages with titles; FAQ is a Q&A list, legal is plain text.",
    options: [
      {
        id: "info-a",
        label: "A",
        title: "Searchable FAQ with categories",
        tagline: "Instant answers with a search filter and topic tabs.",
        inspiredBy: ["Intercom", "Stripe help"],
        effort: "Medium",
        wireframe: wf([
          " 🔍 search questions…         ",
          " [Getting started][Billing]…  ",
          " ┌────────────────────────────",
          " │ ▶ Why am I limited to 500?│",
          " │ ▶ How do I export?        │",
          " │ ▶ What is the calendar?   │",
          " │ expandable answers        │",
          " └────────────────────────────",
        ]),
        coreIdea:
          "Make FAQ a searchable, categorized knowledge base: a search box filters questions live; tabs group by topic; answers expand inline.",
        desktop:
          "Search-first layout with topic tabs and a sticky 'contact support' CTA.",
        mobile:
          "Native bottom sheet for answers; search is the hero control.",
        changes: ["Add search + topic grouping to FAQ", "Add a support contact path"],
        rationale: "Self-serve support (Intercom/Stripe) reduces tickets and feels modern.",
        tradeoffs: ["Content curation effort", "Search index needs updating"],
      },
      {
        id: "info-b",
        label: "B",
        title: "Contextual help in-app",
        tagline: "Docs live where the question happens.",
        inspiredBy: ["Notion", "Linear"],
        effort: "Medium",
        wireframe: wf([
          " on the page you're using:   ",
          "  [ ? ] → 'How do I log a    ",
          "   board game match?'        ",
          " opens a small card:         ",
          "   steps + [open full FAQ]   ",
          " contextual, per-feature help",
        ]),
        coreIdea:
          "Replace a separate help silo with contextual ? buttons on each page that open short, relevant help cards linked to the full FAQ.",
        desktop:
          "A persistent help menu plus per-page ? affordances; help cards slide in without navigation.",
        mobile:
          "A help FAB or topbar ?; cards render as bottom sheets with a 'read more' link.",
        changes: ["Add contextual help surfaces", "Author short per-page guides"],
        rationale: "In-context help (Notion/Linear) reduces abandonment at the moment of doubt.",
        tradeoffs: ["Content authoring across pages", "Risk of UI clutter"],
      },
      {
        id: "info-c",
        label: "C",
        title: "Transparent trust center",
        tagline: "A friendly hub for privacy, terms, plans and data rights.",
        inspiredBy: ["1Password", "Basecamp"],
        effort: "Medium",
        wireframe: wf([
          "  Trust center               ",
          "  ▸ Your data & export       ",
          "  ▸ Privacy in plain terms   ",
          "  ▸ Terms & conditions       ",
          "  ▸ Plan policies & billing  ",
          "  ▸ Security & transparency  ",
          "  plain language + quick links",
        ]),
        coreIdea:
          "Group About, FAQ, Privacy, Terms and data-rights into a friendly, human-written 'trust center' with quick links and plain-language summaries.",
        desktop:
          "A hub page with summary cards per topic and quick links; legal kept as canonical subpages.",
        mobile:
          "Cards list style; legal subpages stay readable with a reading-time header.",
        changes: ["Create a hub page for info/legal", "Write plain-language summaries"],
        rationale: "Transparency hubs (1Password/Basecamp) build trust, a core retention lever for user-data products.",
        tradeoffs: ["Copy effort", "Legal review needed for summaries"],
      },
    ],
  },
];