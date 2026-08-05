import type { LucideIcon } from "lucide-react";
import { Clapperboard, Tv, Gamepad2, BookOpen, Dices, Library } from "lucide-react";

export interface DemoItem {
  id: string;
  title: string;
  mediaType: keyof typeof MEDIA_META;
  hue: number;
  logs: number;
}

export const MEDIA_META: Record<
  string,
  { label: string; icon: LucideIcon; from: string; to: string }
> = {
  movies: { label: "Movie", icon: Clapperboard, from: "#7C3AED", to: "#DB2777" },
  tv: { label: "TV Show", icon: Tv, from: "#0284C7", to: "#06B6D4" },
  games: { label: "Game", icon: Gamepad2, from: "#F59E0B", to: "#EF4444" },
  boardgames: { label: "Board game", icon: Dices, from: "#10B981", to: "#059669" },
  books: { label: "Book", icon: BookOpen, from: "#8B5CF6", to: "#6366F1" },
};

export const DEMO_ITEMS: DemoItem[] = [
  { id: "m1", title: "Dune: Part Two", mediaType: "movies", hue: 262, logs: 3 },
  { id: "t1", title: "Severance", mediaType: "tv", hue: 200, logs: 8 },
  { id: "t2", title: "The Bear", mediaType: "tv", hue: 174, logs: 12 },
  { id: "g1", title: "Elden Ring", mediaType: "games", hue: 32, logs: 14 },
  { id: "b1", title: "Horizons & Cages", mediaType: "boardgames", hue: 150, logs: 6 },
  { id: "k1", title: "The Left Hand of Elegy", mediaType: "books", hue: 245, logs: 2 },
  { id: "m2", title: "Past Lives", mediaType: "movies", hue: 330, logs: 4 },
  { id: "g2", title: "Baldur's Gate 3", mediaType: "games", hue: 18, logs: 20 },
];

export function itemGradient(item: DemoItem) {
  const meta = MEDIA_META[item.mediaType];
  return `linear-gradient(135deg, color-mix(in srgb, ${meta.from} 85%, #000 15%), ${
    meta.to
  })`;
}

export function mediaIcon(mediaType: string): LucideIcon {
  return MEDIA_META[mediaType]?.icon ?? Library;
}