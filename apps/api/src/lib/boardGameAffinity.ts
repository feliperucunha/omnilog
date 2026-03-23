import { parseGenresJson, parseMechanicsJson } from "./serializeLog.js";
import { parseLogAffinityContextJson } from "./logAffinityContext.js";

export type BoardGameLogForAffinity = {
  genres: string | null;
  mechanics: string | null;
  grade: number | null;
  status: string | null;
  affinityContext: string | null;
};

function normalizeTagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}

function gradeToAffinityMultiplier(log: { grade: number | null; status: string | null }): number {
  if (log.grade != null && log.grade >= 0 && log.grade <= 10) {
    return 0.35 + (log.grade / 10) * 0.85;
  }
  return 0.3;
}

/**
 * Weighted averages from stored BGG-style stats (playing time, weight, player count).
 */
export function weightedBoardGameProfile(logs: BoardGameLogForAffinity[]): {
  avgPlay: number | null;
  avgWeight: number | null;
  avgPlayers: number | null;
} {
  let sw = 0;
  let accPlay = 0;
  let accWeight = 0;
  let accPlayers = 0;
  let hasPlay = false;
  let hasWeight = false;
  let hasPlayers = false;

  for (const log of logs) {
    const ctx = parseLogAffinityContextJson(log.affinityContext ?? null)?.boardgames;
    if (!ctx) continue;
    const w = gradeToAffinityMultiplier(log);
    sw += w;
    if (ctx.playingTimeMinutes != null && ctx.playingTimeMinutes > 0) {
      accPlay += ctx.playingTimeMinutes * w;
      hasPlay = true;
    }
    if (ctx.averageWeight != null && ctx.averageWeight > 0) {
      accWeight += ctx.averageWeight * w;
      hasWeight = true;
    }
    const pm = ctx.playersMin;
    const px = ctx.playersMax;
    if (pm != null && px != null) {
      accPlayers += ((pm + px) / 2) * w;
      hasPlayers = true;
    }
  }

  if (sw <= 0) {
    return { avgPlay: null, avgWeight: null, avgPlayers: null };
  }
  return {
    avgPlay: hasPlay ? accPlay / sw : null,
    avgWeight: hasWeight ? accWeight / sw : null,
    avgPlayers: hasPlayers ? accPlayers / sw : null,
  };
}

/**
 * Nudge category-like tags from aggregate play time / weight / player count (BGG-oriented labels).
 */
export function applyBoardGameProfileBoosts(
  scores: Map<string, number>,
  queryLabel: Map<string, string>,
  profile: { avgPlay: number | null; avgWeight: number | null; avgPlayers: number | null }
): void {
  const boost = (canonical: string, displayLabel: string, amount: number) => {
    const k = normalizeTagKey(canonical);
    scores.set(k, (scores.get(k) ?? 0) + amount);
    if (!queryLabel.has(k)) queryLabel.set(k, displayLabel);
  };

  if (profile.avgWeight != null) {
    if (profile.avgWeight < 2.4) {
      boost("party game", "Party Game", 0.42);
      boost("card game", "Card Game", 0.28);
      boost("children's game", "Children's Game", 0.22);
    } else if (profile.avgWeight > 3.35) {
      boost("strategy games", "Strategy Games", 0.48);
      boost("economic", "Economic", 0.36);
      boost("wargame", "Wargame", 0.28);
    }
  }

  if (profile.avgPlay != null) {
    if (profile.avgPlay <= 45) {
      boost("card game", "Card Game", 0.22);
      boost("party game", "Party Game", 0.18);
    } else if (profile.avgPlay >= 120) {
      boost("strategy games", "Strategy Games", 0.32);
    }
  }

  if (profile.avgPlayers != null) {
    if (profile.avgPlayers <= 2.2) {
      boost("abstract strategy", "Abstract Strategy", 0.24);
    } else if (profile.avgPlayers >= 5) {
      boost("party game", "Party Game", 0.26);
    }
  }
}

/**
 * Aggregate signed weights per normalized tag from categories + mechanics.
 * Optional `affinityContext.boardgames` refines boosts from weight / time / players.
 */
export function buildTagAffinityMaps(logs: BoardGameLogForAffinity[]): {
  scores: Map<string, number>;
  queryLabel: Map<string, string>;
} {
  const scores = new Map<string, number>();
  const queryLabel = new Map<string, string>();

  for (const log of logs) {
    const categories = parseGenresJson(log.genres) ?? [];
    const mechanics = parseMechanicsJson(log.mechanics) ?? [];
    const tags = [...categories, ...mechanics];
    if (tags.length === 0) continue;

    let delta: number;
    if (log.grade != null && log.grade >= 0 && log.grade <= 10) {
      delta = (log.grade - 5) / 5;
      if (log.grade >= 8) delta *= 1.12;
      if (log.grade <= 3) delta *= 1.15;
    } else {
      delta = 0.22;
    }

    for (const raw of tags) {
      const key = normalizeTagKey(raw);
      if (!key) continue;
      scores.set(key, (scores.get(key) ?? 0) + delta);
      const prev = queryLabel.get(key);
      const trimmed = raw.trim();
      if (!prev || trimmed.length > prev.length) queryLabel.set(key, trimmed);
    }
  }

  const profile = weightedBoardGameProfile(logs);
  if (profile.avgPlay != null || profile.avgWeight != null || profile.avgPlayers != null) {
    applyBoardGameProfileBoosts(scores, queryLabel, profile);
  }

  return { scores, queryLabel };
}

/** Pick diverse search strings: top positive tags, max `maxQueries`. */
export function pickAffinitySearchQueries(
  scores: Map<string, number>,
  queryLabel: Map<string, string>,
  maxQueries: number
): string[] {
  const ranked = [...scores.entries()]
    .filter(([, v]) => v > 0.06)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => queryLabel.get(k) ?? k);

  const out: string[] = [];
  const seenNorm = new Set<string>();
  for (const q of ranked) {
    const n = normalizeTagKey(q);
    if (seenNorm.has(n)) continue;
    seenNorm.add(n);
    out.push(q);
    if (out.length >= maxQueries) break;
  }
  return out;
}
