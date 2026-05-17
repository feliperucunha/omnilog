import {
  apiFetch,
  getApiBase,
  getAuthHeaders,
  APP_VERSION_MISMATCH_CODE,
  isNativePlatform,
} from "./api";
import { removeItem } from "./storage";
import type { BoardGameProvider } from "@geeklogs/shared";

export class CollectionImportStartError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorCode?: string,
    public readonly nextAvailableAt?: string
  ) {
    super(message);
    this.name = "CollectionImportStartError";
  }
}

export type CollectionDuplicateMode = "skip" | "replace";

export type CollectionImportJobState = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "timeout" | "limit_reached";
  source: BoardGameProvider;
  duplicateMode: CollectionDuplicateMode;
  current: number;
  total: number;
  lastTitle: string | null;
  error: string | null;
  code?: string;
  imported: number;
  replaced: number;
  skipped: number;
  failed: number;
  created: number;
  updated: number;
};

export async function startBoardGameCollectionImport(body: {
  source: BoardGameProvider;
  bggUsername?: string;
  ludopediaUsername?: string;
  duplicateMode: CollectionDuplicateMode;
}): Promise<{ jobId: string }> {
  const res = await fetch(`${getApiBase()}/board-games/collection-import`, {
    method: "POST",
    credentials: "include",
    headers: { ...getAuthHeaders() },
    body: JSON.stringify({
      source: body.source,
      bggUsername: body.bggUsername,
      ludopediaUsername: body.ludopediaUsername,
      duplicateMode: body.duplicateMode,
    }),
  });
  const text = await res.text();
  if (res.status === 401) {
    let code: string | undefined;
    try {
      code = (JSON.parse(text) as { code?: string }).code;
    } catch {
      /* ignore */
    }
    if (code === APP_VERSION_MISMATCH_CODE && isNativePlatform()) {
      window.dispatchEvent(new CustomEvent("app:version-mismatch", { detail: {} }));
      throw new CollectionImportStartError("App version outdated. Please update and try again.", 401);
    }
    void removeItem("geeklogs_token").then(() => removeItem("geeklogs_user"));
    window.dispatchEvent(new CustomEvent("auth:logout"));
    window.location.href = "/login";
    throw new CollectionImportStartError("Session expired. Sign in again.", 401);
  }
  if (!res.ok) {
    let parsed: { error?: string; code?: string; nextAvailableAt?: string } = {};
    try {
      parsed = JSON.parse(text) as { error?: string; code?: string; nextAvailableAt?: string };
    } catch {
      /* ignore */
    }
    const msg = typeof parsed.error === "string" && parsed.error.trim() ? parsed.error : "Import could not be started.";
    throw new CollectionImportStartError(msg, res.status, parsed.code, parsed.nextAvailableAt);
  }
  if (!text) throw new CollectionImportStartError("Empty response from server", res.status);
  return JSON.parse(text) as { jobId: string };
}

export async function getBoardGameCollectionImportJob(jobId: string): Promise<CollectionImportJobState> {
  return apiFetch<CollectionImportJobState>(`/board-games/collection-import/${encodeURIComponent(jobId)}`);
}

export type PollOptions = {
  onUpdate?: (job: CollectionImportJobState) => void;
  maxWaitMs?: number;
  intervalMs?: number;
};

export async function pollBoardGameCollectionImportJob(
  jobId: string,
  opts: PollOptions = {}
): Promise<CollectionImportJobState> {
  const maxWait = opts.maxWaitMs ?? 185_000;
  const interval = opts.intervalMs ?? 500;
  const t0 = Date.now();
  let last: CollectionImportJobState | null = null;
  for (;;) {
    if (Date.now() - t0 > maxWait) {
      if (last) {
        return {
          ...last,
          status: "timeout",
          error: last.error ?? "Import is taking too long. You can try again from the add-entry menu (once every 24 hours).",
        };
      }
      throw new Error("Import timeout");
    }
    last = await getBoardGameCollectionImportJob(jobId);
    opts.onUpdate?.(last);
    if (
      last.status === "completed" ||
      last.status === "failed" ||
      last.status === "timeout" ||
      last.status === "limit_reached"
    ) {
      return last;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}
