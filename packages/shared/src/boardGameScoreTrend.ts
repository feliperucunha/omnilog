export type BoardGameScoreTrend = "higher" | "lower";

export type BoardGameScorePlayerRef = {
  appUserId?: string | null;
  name: string;
  score?: number | null;
};

export function boardGamePlayerIdentityKey(p: Pick<BoardGameScorePlayerRef, "appUserId" | "name">): string {
  const id = p.appUserId?.trim();
  if (id) return `id:${id}`;
  return `n:${p.name.trim().toLowerCase()}`;
}

export function boardGameScoreTrend(
  current: number | null | undefined,
  previous: number | null | undefined
): BoardGameScoreTrend | null {
  if (current == null || typeof current !== "number" || !Number.isFinite(current)) return null;
  if (previous == null || typeof previous !== "number" || !Number.isFinite(previous)) return null;
  if (current > previous) return "higher";
  if (current < previous) return "lower";
  return null;
}

export function priorRecordedScoreForPlayerInSessions(
  sessionsAsc: ReadonlyArray<{ players: ReadonlyArray<BoardGameScorePlayerRef> }>,
  sessionIndex: number,
  player: Pick<BoardGameScorePlayerRef, "appUserId" | "name">
): number | null {
  if (sessionIndex <= 0) return null;
  const key = boardGamePlayerIdentityKey(player);
  for (let i = sessionIndex - 1; i >= 0; i--) {
    const row = sessionsAsc[i]?.players.find((q) => boardGamePlayerIdentityKey(q) === key);
    const score = row?.score;
    if (score != null && typeof score === "number" && Number.isFinite(score)) return score;
  }
  return null;
}
