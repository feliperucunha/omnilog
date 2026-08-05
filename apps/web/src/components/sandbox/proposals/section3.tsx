import { CreditCard, LogIn, Store } from "lucide-react";
import type { ProposalTopic } from "../proposalTypes";
import { wf } from "../proposalTypes";

export const section3: ProposalTopic[] = [
  {
    id: "tiers",
    page: "Plans / Tiers",
    type: "Page",
    icon: CreditCard,
    currentUx:
      "A pricing page with plan cards (Free/Beta/Pro) listing features and an interval toggle.",
    options: [
      {
        id: "tiers-a",
        label: "A",
        title: "Interactive compare table",
        tagline: "Sticky comparison across every feature row.",
        inspiredBy: ["Linear", "Notion pricing"],
        effort: "Medium",
        wireframe: wf([
          "      Free   Beta   Pro      ",
          "Logs   500    500    ∞       ",
          "Stats  █      █      ✓       ",
          "Export —      ✓      ✓       ",
          "Ad-free —     ✓      ✓       ",
          "      [Free] [Beta] [Pro]    ",
          "current plan highlighted      ",
        ]),
        coreIdea:
          "A full feature-by-feature compare table (rows = features, columns = plans) with the user's current plan highlighted and upgrade CTAs per column.",
        desktop:
          "Sticky first column + sticky header; hover highlights a column; the Pro column glows.",
        mobile:
          "Columns slide horizontally with a locked first column; plan cards on top summarize the toggle.",
        changes: ["Replace cards with a full compare table", "Highlight the user's current plan"],
        rationale:
          "Compare tables (Linear/Notion) answer feature questions honestly and convert by making Pro the obvious column.",
        tradeoffs: ["Dense on mobile", "Needs a maintained feature matrix"],
      },
      {
        id: "tiers-b",
        label: "B",
        title: "Benefit-led cards + soft walls",
        tagline: "Sell outcomes, and preview the gated UI.",
        inspiredBy: ["Figma", "Strava"],
        effort: "Medium",
        wireframe: wf([
          "┌────────────────────────────",
          "│ [Pro] See your year in art │",
          "│  ▓ heatmap preview (blur)  │",
          "│  statistics, calendar,     │",
          "│  unlimited logs            │",
          "│  [Unlock Pro — $x/mo]     │",
          "└────────────────────────────",
        ]),
        coreIdea:
          "Lead with benefit cards ('Unlock your year in review', 'Heatmaps, calendar, stats') and show a blurred preview of a gated feature to drive desire.",
        desktop:
          "Three benefit cards each with a mini blurred UI preview and a single Pro CTA; a small compare table below for skeptics.",
        mobile:
          "Cards stack; the blurred preview becomes a tappable 'see it live' demo link.",
        changes: ["Rewrite the page around outcomes", "Add blurred gated-feature previews"],
        rationale:
          "Benefit-led + soft walls (Figma/Strava) convert on desire instead of feature lists.",
        tradeoffs: ["Preview assets need building", "Less explicit for skeptical buyers"],
      },
      {
        id: "tiers-c",
        label: "C",
        title: "Usage-aware upgrade",
        tagline: "A smart, personal reason to upgrade.",
        inspiredBy: ["Dropbox", "Notion usage nudges"],
        effort: "Small",
        wireframe: wf([
          "┌────────────────────────────",
          "│ You have 482 / 500 logs    │",
          "│ ▓▓▓▓▓▓▓▓░░░ 96% full       │",
          "│ At your pace → full in ~2w │",
          "│ [Remove the limit — Pro]   │",
          "└────────────────────────────",
        ]),
        coreIdea:
          "Personalize the page with the user's real usage: '482/500 logs used — about 2 weeks at your pace'; the upgrade ask lands when it is true.",
        desktop:
          "The usage meter + personalized message appear at the top; below, standard plan cards as a safety net.",
        mobile:
          "The meter is the hero; the CTA button sits right under it.",
        changes: ["Read usage in the page and render a personalized prompt", "Compute a pace-based forecast"],
        rationale:
          "Contextual, honest nudges (Dropbox/Notion) convert far better than generic marketing.",
        tradeoffs: ["Adds a personalized backend read", "Only motivates users near a limit"],
      },
    ],
  },

  {
    id: "auth",
    page: "Auth (Login / Register / Forgot)",
    type: "Page",
    icon: LogIn,
    currentUx:
      "A centered card on a dark background with email/password fields, social hints and a brand logo.",
    options: [
      {
        id: "auth-a",
        label: "A",
        title: "Split-screen + quick sign-in",
        tagline: "One-tap login (passkey/magic link) beside the form.",
        inspiredBy: ["Linear", "Stripe"],
        effort: "Medium",
        wireframe: wf([
          "┌──────────┬──────────────┐",
          "│ Brand    │ [Email sign  │",
          "│ value    │  in]         │",
          "│ stats    │ [Magic link] │",
          "│ proof    │ [Passkey]    │",
          "│          │ ────────     │",
          "│          │ email field  │",
          "└──────────┴──────────────┘",
        ]),
        coreIdea:
          "A split layout: left is a brand/value panel (logo, stats, social proof), right is a focused card with passkey/magic-link-first sign-in plus a fallback email/password form.",
        desktop:
          "The brand panel shows product proof; the form card offers one-tap methods first, full form below the divider.",
        mobile:
          "The brand panel collapses to a compact header; passkey/magic-link buttons lead the card for fast entry.",
        changes: ["Add a split layout with a brand/value panel", "Offer passkey/magic-link sign-in"],
        rationale:
          "One-tap + social proof (Linear/Stripe) cuts sign-in friction, the #1 conversion killer.",
        tradeoffs: ["Requires passkey/email infrastructure", "Split layout needs mobile simplification"],
      },
      {
        id: "auth-b",
        label: "B",
        title: "Onboarding into the first log",
        tagline: "Sign up and immediately log your first item.",
        inspiredBy: ["Headspace", "AniList"],
        effort: "Large",
        wireframe: wf([
          " Step 1/3 · Create account    ",
          "┌────────────────────────────",
          "│ [name] [email] [password]  │",
          "│ Continue                   │",
          "│ Step 2 · Pick a category   │",
          "│ [Movies][TV][Books][Games] │",
          "│ Step 3 · Search 'dune' →   │",
          "│ [Log your first item]      │",
          "└────────────────────────────",
        ]),
        coreIdea:
          "Merge registration with onboarding: after the account form, pick visible categories, then land in search with a guided 'log your first item' flow.",
        desktop:
          "A 3-step wizard (account → categories → first search) with progress dots; skipping allowed.",
        mobile:
          "Full-screen steps with a bottom 'Continue' button; the first-log prompt can be one tap on a recommended item.",
        changes: ["Merge signup with the existing onboarding wizard", "End registration in a first-log action"],
        rationale:
          "Getting to the 'aha' (a saved log) during signup (Headspace/AniList) maximizes activation.",
        tradeoffs: ["Larger flow rework", "Risky if signup needs more steps"],
      },
      {
        id: "auth-c",
        label: "C",
        title: "Brand experience card",
        tagline: "A cinematic, on-brand auth consistent with the landing page.",
        inspiredBy: ["Apple", "Goodnotes"],
        effort: "Small",
        wireframe: wf([
          "  gradient hero (media glow)  ",
          "┌────────────────────────────",
          "│      [logo]                │",
          "│  Welcome back              │",
          "│  [email] [password]        │",
          "│  [Forgot?]  [Sign in]      │",
          "│  — or continue with —      │",
          "└────────────────────────────",
        ]),
        coreIdea:
          "Reuse the landing page's gradient/float aesthetic for auth: a subtle animated media-glow background with a clean centered card.",
        desktop:
          "The page inherits the brand mesh/float backgrounds from the landing hero; the card stays compact and focused.",
        mobile:
          "The glow shrinks to a top accent; the card fills most of the viewport with the keyboard pushing it up.",
        changes: ["Apply the landing visual language to auth", "Polish typography and spacing"],
        rationale:
          "Consistency builds trust; a memorable first screen (Apple/Goodnotes) strengthens the brand while staying cheap to build.",
        tradeoffs: ["Pure polish, no functional lift", "Must not slow load times"],
      },
    ],
  },

  {
    id: "market",
    page: "Market (listings)",
    type: "Page",
    icon: Store,
    currentUx:
      "A marketplace of listings with cards, filters, and seller profiles.",
    options: [
      {
        id: "market-a",
        label: "A",
        title: "Product cards with price-led hierarchy",
        tagline: "Photo-first listing cards with prominent price and location.",
        inspiredBy: ["Mercado Livre", "eBay"],
        effort: "Small",
        wireframe: `┌──────────┬──────────┬───────
│ [photo]  │ [photo]  │ [photo]│
│ Dune     │ Firefly  │ Loop  │
│ R$ 89    │ R$ 120   │ R$ 65 │
│ São Paulo│ Rio      │ Curit.│
└──────────┴──────────┴───────`,
        coreIdea:
          "Rebalance the card toward the photo and the price: bigger thumbnails, price first (local currency), condition + location secondary, and a one-tap 'Chat with seller'.",
        desktop:
          "A responsive photo grid; hover reveals condition, shipping and contact actions.",
        mobile:
          "Cards in a 2-column grid; price and photo dominate; contact is a single tap that pre-fills a message.",
        changes: ["Increase photo size and price prominence", "Add one-tap seller contact"],
        rationale:
          "Marketplace UX is won on the price/photo glance (Mercado Livre/eBay); clarity lifts click-through and sales.",
        tradeoffs: ["Requires quality listing photos", "Price formatting per currency needed"],
      },
      {
        id: "market-b",
        label: "B",
        title: "List + summary rows",
        tagline: "Dense rows with state badges and bulk filters.",
        inspiredBy: ["OLX", "Depop"],
        effort: "Medium",
        wireframe: wf([
          " [Active][Sold][Saved] filters ",
          " Dune (movie)  R$89 · São Paulo",
          "   ▸ 3d ago · near new · chat  ",
          " Firefly (game) R$120 · Rio    ",
          "   ▸ 1w ago · like new · chat  ",
          " sort: price · date · distance ",
        ]),
        coreIdea:
          "Offer a dense list/table alternative with status badges (Active/Sold/Saved), filters by state, and sort by price/date/distance.",
        desktop:
          "Rows are sortable and filterable; a summary header (X active, Y saved) gives a quick pulse.",
        mobile:
          "Compact rows with badges; a filter sheet groups by status/price/location.",
        changes: ["Add a dense list view", "Add state badges and a filter sheet"],
        rationale:
          "Power users browse listings like a workflow (OLX/Depop); dense rows let them scan many results fast.",
        tradeoffs: ["Less visual appeal", "Row fields must be chosen carefully"],
      },
      {
        id: "market-c",
        label: "C",
        title: "Nearby map & saved searches",
        tagline: "Local-first browsing with a map toggle and saved searches.",
        inspiredBy: ["Letgo/OfferUp", "Kijiji"],
        effort: "Large",
        wireframe: `┌────────────────────────────
│ [List ▾] [Map]  ⠀ 🔔 save  │
│     📍  ★ listing          │
│   🏠  ★ listing  ★ listing │
│ map pins → cards           │
│ saved search: 'dune' bell  │
└────────────────────────────`,
        coreIdea:
          "Add a map view for local listings, plus saved searches with alert bells for repeat queries.",
        desktop:
          "A list/map toggle; map pins open a card; saved searches live in a sidebar.",
        mobile:
          "Map fills the screen with floating card previews; the saved-searches bell nudges via notification.",
        changes: ["Add a map layer", "Add saved searches + alerts"],
        rationale:
          "Local marketplaces win with geography (OfferUp/Kijiji); saved searches reduce repeat effort and re-engage users.",
        tradeoffs: ["Geocoding + map dependency", "Moderately larger scope"],
      },
    ],
  },
];