import type { BoardGameMatch, Log } from "@geeklogs/shared";

export interface BoardGameMatchCompleteState {
  image: string | null;
  title: string;
  grade: number | null;
  matchesPlayed: number | null;
  match: BoardGameMatch;
  mediaType?: "boardgames";
}

export function boardGameMatchCompleteStateFromSave(log: Log, match: BoardGameMatch): BoardGameMatchCompleteState {
  return {
    image: log.image,
    title: log.title,
    grade: log.grade,
    matchesPlayed: log.matchesPlayed,
    match,
    mediaType: log.mediaType === "boardgames" ? "boardgames" : undefined,
  };
}
