import type { LogAffinityContext } from "@geeklogs/shared";

export function parseBoardGameWeightValue(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 5) {
    return Math.round(v * 1000) / 1000;
  }
  if (typeof v === "string") {
    const n = parseFloat(v.trim().replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n <= 5) return Math.round(n * 1000) / 1000;
  }
  return null;
}

export function boardGameAverageWeightFromAffinity(
  affinity: LogAffinityContext | null | undefined
): number | null {
  return parseBoardGameWeightValue(affinity?.boardgames?.averageWeight);
}
