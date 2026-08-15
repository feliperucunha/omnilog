const DB_NAME = "geeklogs-api-cache";
const STORE = "get";
const DB_VERSION = 1;
const MAX_PERSISTED = 80;

const PERSIST_KEY_INCLUDES = [
  "GET /me",
  "GET /search",
  "GET /logs?",
  "GET /logs/index",
  "GET /logs/counts",
  "GET /logs/status-counts",
];

export function shouldPersistCacheKey(key: string): boolean {
  return PERSIST_KEY_INCLUDES.some((part) => key.includes(part));
}

type PersistedEntry = {
  key: string;
  data: unknown;
  expiresAt: number;
  storedAt: number;
};

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
    } catch {
      resolve(null);
    }
  });
}

export async function loadPersistedGetCache(): Promise<PersistedEntry[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result as PersistedEntry[] | undefined) ?? [];
        resolve(rows.filter((row) => row && typeof row.key === "string"));
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pending: Map<string, PersistedEntry> | null = null;

export function schedulePersistGetEntry(entry: PersistedEntry): void {
  if (!shouldPersistCacheKey(entry.key)) return;
  if (!pending) pending = new Map();
  pending.set(entry.key, entry);
  if (persistTimer != null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const batch = pending;
    pending = null;
    if (batch && batch.size > 0) void flushPersist(batch);
  }, 250);
}

export function scheduleDeletePersistedKeysMatching(prefix: string): void {
  void deletePersistedKeysMatching(prefix);
}

async function deletePersistedKeysMatching(prefix: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    if (!prefix) {
      store.clear();
      return;
    }
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const keys = (req.result as IDBValidKey[] | undefined) ?? [];
      for (const key of keys) {
        if (typeof key === "string" && key.includes(prefix)) store.delete(key);
      }
    };
  } catch {
    /* ignore */
  }
}

async function flushPersist(batch: Map<string, PersistedEntry>): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const entry of batch.values()) {
      store.put(entry);
    }
    const countReq = store.count();
    countReq.onsuccess = () => {
      if ((countReq.result ?? 0) <= MAX_PERSISTED) return;
      const allReq = store.getAll();
      allReq.onsuccess = () => {
        const rows = ((allReq.result as PersistedEntry[]) ?? []).sort(
          (a, b) => a.storedAt - b.storedAt
        );
        const extra = rows.length - MAX_PERSISTED;
        for (let i = 0; i < extra; i++) {
          const key = rows[i]?.key;
          if (key) store.delete(key);
        }
      };
    };
  } catch {
    /* quota / private mode */
  }
}
