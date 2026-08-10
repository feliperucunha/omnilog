import type { LogAffinityContext } from "./affinityContext.js";
import type { ScopedReview } from "./scopedReview.js";

import type { AnimeMangaTitleParts } from "./animeMangaTitleLanguage.js";

export const MEDIA_TYPES = [
  "movies",
  "tv",
  "boardgames",
  "games",
  "books",
  "anime",
  "manga",
  "comics",
] as const;

/** Categories where optional purchase / spend amount is tracked (also use own / want-to-buy collection UI). */
export const SPEND_TRACKED_MEDIA_TYPES = ["games", "boardgames", "books", "manga", "comics"] as const;
export type SpendTrackedMediaType = (typeof SPEND_TRACKED_MEDIA_TYPES)[number];

export type MediaType = (typeof MEDIA_TYPES)[number];

/** Narrow a string to MediaType; returns "movies" if not a valid media type. */
export function toMediaType(s: string): MediaType {
  return MEDIA_TYPES.includes(s as MediaType) ? (s as MediaType) : "movies";
}

/** Board game search/detail provider. Stored in user preference. */
export const BOARD_GAME_PROVIDERS = ["bgg", "ludopedia"] as const;
export type BoardGameProvider = (typeof BOARD_GAME_PROVIDERS)[number];

export const LIST_TYPES = ["favorites", "pending"] as const;
export type ListType = (typeof LIST_TYPES)[number];

/** Status options per media type for logging */
export const LOG_STATUS_OPTIONS: Record<MediaType, readonly string[]> = {
  movies: ["watched", "plan to watch"],
  tv: ["completed", "watching", "plan to watch", "dropped"],
  boardgames: ["played", "plan to play"],
  games: ["completed", "plan to play", "dropped", "playing"],
  books: ["read", "plan to read", "reading", "dropped"],
  anime: ["completed", "watching", "plan to watch", "dropped"],
  manga: ["read", "plan to read", "reading", "dropped"],
  comics: ["read", "plan to read", "reading", "dropped"],
} as const;

export type LogStatus = (typeof LOG_STATUS_OPTIONS)[MediaType][number];

/** Map API status value to i18n key segment (e.g. "plan to watch" -> "planToWatch") */
export const STATUS_I18N_KEYS: Record<string, string> = {
  watched: "watched",
  "plan to watch": "planToWatch",
  completed: "completed",
  watching: "watching",
  dropped: "dropped",
  played: "played",
  "plan to play": "planToPlay",
  playing: "playing",
  read: "read",
  "plan to read": "planToRead",
  reading: "reading",
  favorites: "favorites",
  pending: "pending",
};

/** Statuses that mean "in progress" - set startedAt when user picks these */
export const IN_PROGRESS_STATUSES = ["watching", "reading", "playing"] as const;

/** Statuses that mean "completed" - set completedAt when user picks these */
export const COMPLETED_STATUSES = ["watched", "completed", "read", "played"] as const;

/** Max hits returned for catalog search (`GET /search`) and user search (`GET /search/users`). */
export const SEARCH_RESULTS_PAGE_SIZE = 30;

export interface SearchResult {
  id: string;
  title: string;
  image: string | null;
  year?: string | null;
  subtitle?: string | null;
  /** Average time to beat in hours (games only, from RAWG playtime). */
  timeToBeatHours?: number | null;
  /** Genre names (when available from API). Show up to 2 badges. */
  genres?: string[] | null;
  /**
   * Public/catalog rating when the source provides it (scales differ: TMDB ~0–10, RAWG ~0–5, MAL ~0–10, BGG Bayesian ~0–10).
   * Used for recommendation ordering when present.
   */
  score?: number | null;
  /** Books: representative page count (median across editions when available). */
  pagesCount?: number | null;
}

/** Available rails (Netflix-style carousels) for the empty-search browse endpoint. */
export const BROWSE_RAIL_KEYS = ["trending", "topRated", "popular", "newReleases", "hot"] as const;
export type BrowseRailKey = (typeof BROWSE_RAIL_KEYS)[number];

export interface BrowseRail {
  key: BrowseRailKey;
  results: SearchResult[];
}

export interface BrowseResponse {
  type: MediaType;
  rails: BrowseRail[];
  requiresApiKey?: string;
  link?: string;
  tutorial?: string;
}

/** Sort option for search: value sent to API, labelKey for i18n (e.g. searchSort.titleAsc). */
export interface SearchSortOption {
  value: string;
  labelKey: string;
}

/** Search sort options per media type (API-dependent). Default first = relevance. */
export const SEARCH_SORT_OPTIONS: Record<MediaType, readonly SearchSortOption[]> = {
  movies: [
    { value: "relevance", labelKey: "searchSort.relevance" },
    { value: "title_asc", labelKey: "searchSort.titleAsc" },
    { value: "title_desc", labelKey: "searchSort.titleDesc" },
    { value: "year_desc", labelKey: "searchSort.yearNewest" },
    { value: "year_asc", labelKey: "searchSort.yearOldest" },
  ],
  tv: [
    { value: "relevance", labelKey: "searchSort.relevance" },
    { value: "title_asc", labelKey: "searchSort.titleAsc" },
    { value: "title_desc", labelKey: "searchSort.titleDesc" },
    { value: "year_desc", labelKey: "searchSort.yearNewest" },
    { value: "year_asc", labelKey: "searchSort.yearOldest" },
  ],
  boardgames: [
    { value: "relevance", labelKey: "searchSort.relevance" },
    { value: "title_asc", labelKey: "searchSort.titleAsc" },
    { value: "title_desc", labelKey: "searchSort.titleDesc" },
    { value: "year_desc", labelKey: "searchSort.yearNewest" },
    { value: "year_asc", labelKey: "searchSort.yearOldest" },
  ],
  games: [
    { value: "relevance", labelKey: "searchSort.relevance" },
    { value: "released_desc", labelKey: "searchSort.releasedNewest" },
    { value: "released_asc", labelKey: "searchSort.releasedOldest" },
    { value: "rating_desc", labelKey: "searchSort.ratingHighest" },
    { value: "name_asc", labelKey: "searchSort.titleAsc" },
    { value: "name_desc", labelKey: "searchSort.titleDesc" },
  ],
  books: [
    { value: "relevance", labelKey: "searchSort.relevance" },
    { value: "title_asc", labelKey: "searchSort.titleAsc" },
    { value: "title_desc", labelKey: "searchSort.titleDesc" },
    { value: "year_desc", labelKey: "searchSort.yearNewest" },
    { value: "year_asc", labelKey: "searchSort.yearOldest" },
  ],
  anime: [
    { value: "relevance", labelKey: "searchSort.relevance" },
    { value: "title_asc", labelKey: "searchSort.titleAsc" },
    { value: "title_desc", labelKey: "searchSort.titleDesc" },
    { value: "score_desc", labelKey: "searchSort.scoreHighest" },
    { value: "start_date_desc", labelKey: "searchSort.yearNewest" },
    { value: "start_date_asc", labelKey: "searchSort.yearOldest" },
  ],
  manga: [
    { value: "relevance", labelKey: "searchSort.relevance" },
    { value: "title_asc", labelKey: "searchSort.titleAsc" },
    { value: "title_desc", labelKey: "searchSort.titleDesc" },
    { value: "score_desc", labelKey: "searchSort.scoreHighest" },
    { value: "start_date_desc", labelKey: "searchSort.yearNewest" },
    { value: "start_date_asc", labelKey: "searchSort.yearOldest" },
  ],
  comics: [
    { value: "relevance", labelKey: "searchSort.relevance" },
    { value: "title_asc", labelKey: "searchSort.titleAsc" },
    { value: "title_desc", labelKey: "searchSort.titleDesc" },
    { value: "year_desc", labelKey: "searchSort.yearNewest" },
    { value: "year_asc", labelKey: "searchSort.yearOldest" },
  ],
};

/**
 * Item detail for the public item page (same shape as SearchResult, used for header).
 * For board games, which fields are present depends on the source API (BGG vs Ludopedia);
 * the details UI only renders sections for which data exists.
 */
export interface ItemDetail {
  id: string;
  title: string;
  image: string | null;
  /** Smaller/poster URL when the API provides it (e.g. BGG thumbnail). Clients should use `image ?? thumbnail` for display. */
  thumbnail?: string | null;
  year?: string | null;
  subtitle?: string | null;
  /** Anime/manga: alternate title forms for display preference (original vs English). */
  titleVariants?: AnimeMangaTitleParts | null;
  /** When mediaType is boardgames: which API provided this data ("bgg" | "ludopedia"). Enables UI to show "Source: …". */
  itemSource?: "bgg" | "ludopedia" | null;
  /** Runtime in minutes (movies, TV, etc.) for content-hours stats */
  runtimeMinutes?: number | null;
  /** Average time to beat in hours (games only, from RAWG playtime). */
  timeToBeatHours?: number | null;
  /** Plot/synopsis/overview from API */
  description?: string | null;
  /** Genre names */
  genres?: string[] | null;
  /** Tagline (movies/TV) */
  tagline?: string | null;
  /** Content rating (e.g. PG-13, TV-MA) */
  contentRating?: string | null;
  /** Average score from API (e.g. TMDB 0–10, RAWG 0–100) */
  score?: number | null;
  /** TV/Anime: number of episodes */
  episodesCount?: number | null;
  /** TV: number of seasons */
  seasonsCount?: number | null;
  /** Board games: min/max players */
  playersMin?: number | null;
  playersMax?: number | null;
  /** Board games: playing time in minutes */
  playingTimeMinutes?: number | null;
  /** Board games: BGG community average weight (complexity), ~1–5 when from BGG with stats. */
  averageWeight?: number | null;
  /** Books: representative page count (median across editions when available). */
  pagesCount?: number | null;
  /** Books: author names */
  authors?: string[] | null;
  /** Comics/Books: publisher name */
  publisher?: string | null;
  /** Comics: number of issues */
  issuesCount?: number | null;
  /** Manga: chapters / volumes */
  chaptersCount?: number | null;
  volumesCount?: number | null;
  /** Games: platform names */
  platforms?: string[] | null;
  /** Full release/first air date (e.g. "1999-12-15") */
  releaseDate?: string | null;
  /** Status (e.g. Released, Ended, Returning Series) */
  status?: string | null;
  /** Movie: production country names */
  productionCountries?: string[] | null;
  /** Movie: spoken language names */
  spokenLanguages?: string[] | null;
  /** TV: network names; movies/anime: streaming providers (TMDB watch providers / MAL licensors). */
  networks?: string[] | null;
  /** Games: developer names */
  developers?: string[] | null;
  /** Games: publisher names (can be multiple) */
  publishers?: string[] | null;
  /** Games: ESRB/content rating */
  esrbRating?: string | null;
  /** Games: tag names */
  tags?: string[] | null;
  /** Board games: minimum age */
  minAge?: number | null;
  /** Board games: category names (e.g. Card Game) */
  categories?: string[] | null;
  /** Board games: mechanic names */
  mechanics?: string[] | null;
  /** Anime: studio names */
  studios?: string[] | null;
  /** Anime: theme names */
  themes?: string[] | null;
  /** Manga (Jikan): demographic labels (e.g. Shōnen, Seinen). */
  demographics?: string[] | null;
  /** Anime: episode duration string (e.g. "24 min per ep") */
  duration?: string | null;
  /** Manga: serialization name (where it was published) */
  serialization?: string | null;
  /** Books: subject names */
  subjects?: string[] | null;
}

/** Current user's reaction to a log/review */
export type ReactionType = "like" | "dislike";

export type ReviewScope = "show" | "season" | "episode";

/** A review shown on the item page (from any user) */
export interface ItemReview {
  id: string;
  userId?: string;
  /** Log id for reactions (parent series log when id is a scoped review). */
  reactionLogId?: string;
  reviewScope?: ReviewScope;
  /** Display name: username when set, otherwise email (for backward compat). Prefer showing reviewerUsername. */
  userEmail: string;
  /** Reviewer's username when set; use this for display instead of email when present. */
  reviewerUsername?: string | null;
  /** True when the review author has Pro-tier features (Pro, Beta, or Admin). */
  isPro?: boolean;
  /** True when the review author is an Admin */
  isAdmin?: boolean;
  /** All earned review badges for this medium (icon + level + label). Show all on review cards. */
  reviewerBadges?: Array<{ level: number; label: string; icon: string }>;
  /** Reviewer's review count in this category (for badge tooltip: "X has N reviews in Y"). */
  reviewerReviewsInCategory?: number;
  /** Reviewer level (1-based) for backward compat; equals last badge in reviewerBadges when present */
  reviewerLevel?: number;
  /** Label for reviewer level (e.g. "Critic", "Expert") */
  reviewerLevelLabel?: string;
  /** Icon for reviewer level (emoji or icon key) */
  reviewerLevelIcon?: string;
  grade: number | null;
  review: string | null;
  listType: string | null;
  status: string | null;
  season: number | null;
  episode: number | null;
  chapter: number | null;
  volume: number | null;
  startedAt: string | null;
  completedAt: string | null;
  contentHours: number | null;
  createdAt: string;
  /** Number of like reactions (thumbs up). */
  likesCount?: number;
  /** Number of dislike reactions (thumbs down). */
  dislikesCount?: number;
  /** Current user's reaction, if any. */
  userReaction?: ReactionType | null;
}

export interface ItemPageData {
  item: ItemDetail;
  reviews: ItemReview[];
  meanGrade: number | null;
  /** Total number of reviews (for pagination). */
  reviewsTotal?: number;
  /** Current reviews page (1-based). */
  reviewsPage?: number;
  /** Reviews per page. */
  reviewsLimit?: number;
}

export interface Log {
  id: string;
  userId: string;
  mediaType: MediaType;
  externalId: string;
  title: string;
  image: string | null;
  grade: number | null;
  review: string | null;
  listType: string | null;
  status: string | null;
  season: number | null;
  episode: number | null;
  chapter: number | null;
  volume: number | null;
  /** Books, manga, comics: pages read so far. */
  pagesRead: number | null;
  startedAt: string | null;
  completedAt: string | null;
  contentHours: number | null;
  /** Games only: how long it took the user to beat (hours). */
  hoursToBeat: number | null;
  /** Games only: console or platform (e.g. PlayStation 5, PC). */
  gamePlatform: string | null;
  /** Board games and video games: user owns a copy. */
  own: boolean | null;
  /** Board games and video games: user wants to buy a copy. */
  wantToBuy: boolean | null;
  /** Spend-tracked categories: user sold / no longer owns; optional sale proceeds below. */
  sold: boolean | null;
  /** Boardgames only: number of matches/sessions played. */
  matchesPlayed: number | null;
  /** Genre names (for stats and badges). Stored when logging. */
  genres: string[] | null;
  /** Board games: mechanic names from BGG / Ludopedia when logging. */
  mechanics?: string[] | null;
  /** Upstream API rating on a 0-10 scale (TMDB / MAL / RAWG metacritic), lazily enriched server-side. */
  apiScore?: number | null;
  /** TV/movies/anime: network or streaming provider names lazily enriched by the API. */
  networks?: string[] | null;
  /** TV only: raw TMDB status (e.g. "Ended", "Returning Series", "Canceled"); lazily enriched. */
  tvStatus?: string | null;
  /** Books only: page count (Open Library editions median), lazily enriched server-side. */
  pagesCount?: number | null;
  /** Boardgames only: min players from BGG / Ludopedia, lazily enriched server-side. */
  playersMin?: number | null;
  /** Boardgames only: max players from BGG / Ludopedia, lazily enriched server-side. */
  playersMax?: number | null;
  /** Boardgames only: BGG / Ludopedia complexity (1–5). */
  averageWeight?: number | null;
  /** Snapshot for personalized recommendations (optional). */
  affinityContext?: LogAffinityContext | null;
  createdAt: string;
  updatedAt: string;
  /** Board games: which API this log’s externalId came from (affects image aspect handling for BGG). */
  boardGameSource?: BoardGameProvider | null;
  /** Optional amount paid, in minor units (e.g. cents), with purchaseCurrency. */
  purchaseAmountMinor?: number | null;
  /** ISO 4217 currency code when purchaseAmountMinor is set. */
  purchaseCurrency?: string | null;
  /** Amount received from sale (minor units) when sold is true. */
  saleAmountMinor?: number | null;
  /** ISO 4217 when saleAmountMinor is set. */
  saleCurrency?: string | null;
  /** Number of like reactions (feed/reviews). */
  likesCount?: number;
  /** Number of dislike reactions (feed/reviews). */
  dislikesCount?: number;
  /** Current user's reaction, if any. */
  userReaction?: ReactionType | null;
  /** TV/anime only: season and episode granular ratings (included on list endpoints). */
  scopedReviews?: ScopedReview[];
}

export interface CreateLogInput {
  mediaType: MediaType;
  externalId: string;
  title: string;
  image?: string | null;
  grade?: number;
  review?: string;
  listType?: ListType | null;
  status?: string | null;
  season?: number | null;
  episode?: number | null;
  chapter?: number | null;
  volume?: number | null;
  contentHours?: number | null;
  /** Games only: how long it took to beat (hours). */
  hoursToBeat?: number | null;
  /** Genre/category names from item (for stats, badges, recommendations). */
  genres?: string[] | null;
  /** Board games: mechanic names from item detail. */
  mechanics?: string[] | null;
  affinityContext?: LogAffinityContext | null;
  /** When mediaType is boardgames: which API this id came from (bgg | ludopedia). Stored so details are fetched from the correct API. */
  boardGameSource?: BoardGameProvider | null;
  /** Board games and video games: user owns a copy. */
  own?: boolean | null;
  /** Board games and video games: user wants to buy a copy. */
  wantToBuy?: boolean | null;
  /** Sold / no longer owned (spend-tracked categories). */
  sold?: boolean | null;
  /** Board games only: number of matches/sessions played. */
  matchesPlayed?: number | null;
  /** Optional purchase amount (minor units); requires purchaseCurrency for eligible media types. */
  purchaseAmountMinor?: number | null;
  purchaseCurrency?: string | null;
  saleAmountMinor?: number | null;
  saleCurrency?: string | null;
}

/** One player row in a board game match session. */
export interface BoardGameMatchPlayer {
  name: string;
  score: number | null;
  winner: boolean;
  /** Present when this row references a registered app user (by id). */
  appUserId?: string | null;
}

/** Board games only: a logged play session (separate from the main log review). */
export interface BoardGameMatch {
  id: string;
  logId: string;
  playedAt: string;
  /** Session length in hours (0.5–6 in 30 min steps). */
  durationHours: number;
  players: BoardGameMatchPlayer[];
  notes: string | null;
  createdAt: string;
}

export interface CreateBoardGameMatchInput {
  playedAt: string;
  durationHours?: number;
  players: BoardGameMatchPlayer[];
  notes?: string | null;
}

export interface UpdateLogInput {
  image?: string | null;
  grade?: number;
  review?: string;
  listType?: ListType | null;
  status?: string | null;
  season?: number | null;
  episode?: number | null;
  chapter?: number | null;
  volume?: number | null;
  contentHours?: number | null;
  /** Games only: how long it took to beat (hours). */
  hoursToBeat?: number | null;
  genres?: string[] | null;
  mechanics?: string[] | null;
  affinityContext?: LogAffinityContext | null;
  /** Board games and video games: user owns a copy. */
  own?: boolean | null;
  /** Board games and video games: user wants to buy a copy. */
  wantToBuy?: boolean | null;
  /** Board games only: number of matches/sessions played. */
  matchesPlayed?: number | null;
  purchaseAmountMinor?: number | null;
  purchaseCurrency?: string | null;
}

export interface AuthRegisterInput {
  email: string;
  password: string;
  username?: string;
  city?: string;
  cityLabel?: string;
  country?: string;
  phone?: string;
}

export interface AuthLoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username?: string;
    email: string;
    onboarded: boolean;
    city?: string | null;
    cityLabel?: string | null;
    phone?: string | null;
  };
}
