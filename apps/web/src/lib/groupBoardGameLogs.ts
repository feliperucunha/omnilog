import type { Log } from "@geeklogs/shared";

const expansionKey = (source: string | null | undefined, externalId: string) =>
  `${source ?? "bgg"}:${externalId}`;

const PLACEHOLDER_ID_PREFIX = "expansion-parent:";

export function isExpansionParentPlaceholder(log: Log): boolean {
  return log.id.startsWith(PLACEHOLDER_ID_PREFIX);
}

export function createExpansionParentPlaceholder(
  source: Log["boardGameSource"],
  externalId: string,
  title: string | null | undefined
): Log {
  const now = new Date().toISOString();
  return {
    id: `${PLACEHOLDER_ID_PREFIX}${expansionKey(source, externalId)}`,
    userId: "",
    mediaType: "boardgames",
    externalId,
    title: title?.trim() || "Unknown",
    image: null,
    grade: null,
    review: null,
    listType: null,
    status: null,
    season: null,
    episode: null,
    chapter: null,
    volume: null,
    pagesRead: null,
    startedAt: null,
    completedAt: null,
    contentHours: null,
    hoursToBeat: null,
    gamePlatform: null,
    own: null,
    wantToBuy: null,
    sold: null,
    matchesPlayed: null,
    genres: null,
    createdAt: now,
    updatedAt: now,
    boardGameSource: source ?? "bgg",
    expansionOfExternalId: null,
    expansionOfTitle: null,
  };
}

/** Adds temporary base-game cards so expansions can group before their parents finish loading. */
export function addExpansionParentPlaceholders(logs: Log[], parents: Log[] = []): Log[] {
  const combined = parents.length > 0 ? [...logs, ...parents] : logs;
  const known = new Set(combined.map((log) => expansionKey(log.boardGameSource, log.externalId)));
  const placeholders: Log[] = [];
  const seen = new Set<string>();
  for (const log of combined) {
    const parentExternalId = log.expansionOfExternalId;
    if (!parentExternalId) continue;
    const key = expansionKey(log.boardGameSource, parentExternalId);
    if (known.has(key) || seen.has(key)) continue;
    seen.add(key);
    placeholders.push(
      createExpansionParentPlaceholder(log.boardGameSource, parentExternalId, log.expansionOfTitle)
    );
  }
  return placeholders.length > 0 ? [...combined, ...placeholders] : combined;
}

export function groupBoardGameLogs(logs: Log[]): Array<{ log: Log; children: Log[] }> {
  const byExternalId = new Map<string, Log>();
  for (const log of logs) {
    if (log.externalId) byExternalId.set(expansionKey(log.boardGameSource, log.externalId), log);
  }
  const findRoot = (log: Log): Log => {
    let current = log;
    const seen = new Set<string>([current.id]);
    while (current.expansionOfExternalId) {
      const parent = byExternalId.get(
        expansionKey(current.boardGameSource, current.expansionOfExternalId)
      );
      if (!parent || seen.has(parent.id)) break;
      seen.add(parent.id);
      current = parent;
    }
    return current;
  };
  const childrenByRoot = new Map<string, Log[]>();
  const rootOrder: Log[] = [];
  const seenRoots = new Set<string>();
  for (const log of logs) {
    const root = findRoot(log);
    if (!seenRoots.has(root.id)) {
      seenRoots.add(root.id);
      rootOrder.push(root);
    }
    if (root.id === log.id) continue;
    const children = childrenByRoot.get(root.id) ?? [];
    children.push(log);
    childrenByRoot.set(root.id, children);
  }
  return rootOrder.map((log) => ({ log, children: childrenByRoot.get(log.id) ?? [] }));
}
