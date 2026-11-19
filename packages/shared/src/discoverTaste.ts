import type { MediaType } from "./types.js";

export const DISCOVER_MIN_LOGS = 10;
export const DISCOVER_TASTE_REFRESH_MS = 24 * 60 * 60 * 1000;
export const DISCOVER_TASTE_MAX_LOGS_PER_CATEGORY = 120;
export const DISCOVER_TASTE_PROMPT_LOGS_PER_CATEGORY = 25;

export const DISCOVER_PLANNED_STATUS: Record<MediaType, string> = {
  movies: "plan to watch",
  tv: "plan to watch",
  anime: "plan to watch",
  boardgames: "plan to play",
  games: "plan to play",
  books: "plan to read",
  manga: "plan to read",
  comics: "plan to read",
};

export interface DiscoverPlannedTasteItem {
  id: string;
  externalId: string;
  title: string;
  status: string;
}

export interface DiscoverBeyondTasteItem {
  id: string;
  title: string;
  note: string;
}

export interface DiscoverTasteChartItem {
  label: string;
  count: number;
}

export interface DiscoverCategoryTaste {
  lines: string[];
  charts: DiscoverTasteChartItem[];
  planned: DiscoverPlannedTasteItem[];
  beyond: DiscoverBeyondTasteItem[];
}

export interface DiscoverTasteSnapshot {
  refreshedAt: string | null;
  categories: Partial<Record<MediaType, DiscoverCategoryTaste>>;
}
