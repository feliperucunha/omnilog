import { COMPLETED_STATUSES } from "@geeklogs/shared";
import { gradeToStars, starsToGrade } from "@/lib/gradeStars";
import { isoToDateInput } from "@/lib/readingDates";

export function gradeStarsUnchanged(stars: number | null, logGrade: number | null | undefined): boolean {
  const logStars = logGrade != null ? gradeToStars(logGrade) : null;
  return stars === logStars;
}

export function gradeForPayload(stars: number | null): number | null {
  return stars == null ? null : starsToGrade(stars);
}

export function logDateInputMatchesStored(
  storedIso: string | null | undefined,
  input: string
): boolean {
  if (!input.trim()) return storedIso == null || storedIso === "";
  const fromStored = storedIso ? isoToDateInput(storedIso) : "";
  return input.trim() === fromStored;
}

export function episodePayloadValue(
  episode: number | "",
  status: string | null,
  episodesCount: number | null | undefined,
  showSeasonEpisode: boolean
): number | null {
  const isCompleted = status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
  if (isCompleted && showSeasonEpisode && episodesCount != null && episodesCount > 0) {
    return episodesCount;
  }
  return episode === "" ? null : episode;
}

export function episodeFieldUnchanged(
  episode: number | "",
  logEpisode: number | null | undefined
): boolean {
  return (episode === "" ? null : episode) === (logEpisode ?? null);
}
