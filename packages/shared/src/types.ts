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
  games: ["played", "plan to play", "dropped", "playing"],
  books: ["read", "plan to read", "reading"],
  anime: ["completed", "watching", "plan to watch", "dropped"],
  manga: ["read", "plan to read", "reading"],
  comics: ["read", "plan to read", "reading"],
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
};

/** Statuses that mean "in progress" - set startedAt when user picks these */
export const IN_PROGRESS_STATUSES = ["watching", "reading", "playing"] as const;

/** Statuses that mean "completed" - set completedAt when user picks these */
export const COMPLETED_STATUSES = ["watched", "completed", "read", "played"] as const;

export interface SearchResult {
  id: string;
  title: string;
  image: string | null;
  year?: string | null;
  subtitle?: string | null;
  /** Average time to beat in hours (games only, from RAWG playtime). */
  timeToBeatHours?: number | null;
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
  year?: string | null;
  subtitle?: string | null;
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
  /** TV: network names */
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
  /** Anime: episode duration string (e.g. "24 min per ep") */
  duration?: string | null;
  /** Manga: serialization name (where it was published) */
  serialization?: string | null;
  /** Books: subject names */
  subjects?: string[] | null;
}

/** A review shown on the item page (from any user) */
export interface ItemReview {
  id: string;
  userEmail: string;
  /** True when the review author is on the Pro tier */
  isPro?: boolean;
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
  startedAt: string | null;
  completedAt: string | null;
  contentHours: number | null;
  createdAt: string;
  updatedAt: string;
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
  /** When mediaType is boardgames: which API this id came from (bgg | ludopedia). Stored so details are fetched from the correct API. */
  boardGameSource?: BoardGameProvider | null;
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
}

export interface AuthRegisterInput {
  email: string;
  password: string;
}

export interface AuthLoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: { id: string; username?: string; email: string; onboarded: boolean };
}
