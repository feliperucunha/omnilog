/**
 * Parse genres JSON string from Log.genres to string[] for API response.
 */
export function parseGenresJson(json: string | null): string[] | null {
  if (!json || json.trim() === "") return null;
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return null;
    return arr.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 20);
  } catch {
    return null;
  }
}

export function serializeLog<T extends {
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  genres?: string | null;
}>(log: T) {
  return {
    ...log,
    startedAt: log.startedAt?.toISOString() ?? null,
    completedAt: log.completedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
    genres: parseGenresJson(log.genres ?? null),
  };
}
