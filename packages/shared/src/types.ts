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
}

/** Item detail for the public item page (same shape as SearchResult, used for header) */
export interface ItemDetail {
  id: string;
  title: string;
  image: string | null;
  year?: string | null;
  subtitle?: string | null;
  /** Runtime in minutes (movies, TV, etc.) for content-hours stats */
  runtimeMinutes?: number | null;
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
