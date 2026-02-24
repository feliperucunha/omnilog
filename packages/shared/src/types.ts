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

/** Item detail for the public item page (same shape as SearchResult, used for header) */
export interface ItemDetail {
  id: string;
  title: string;
  image: string | null;
  year?: string | null;
  subtitle?: string | null;
  /** Runtime in minutes (movies, TV, etc.) for content-hours stats */
  runtimeMinutes?: number | null;
  /** Average time to beat in hours (games only, from RAWG playtime). */
  timeToBeatHours?: number | null;
}

/** A review shown on the item page (from any user) */
export interface ItemReview {
  id: string;
  userEmail: string;
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
  user: { id: string; email: string; onboarded: boolean };
}
