import { randomUUID } from "node:crypto";
import { decodeHtmlEntities } from "@geeklogs/shared";
import { prisma } from "../lib/prisma.js";
import { tierHasUnlimitedLogs } from "../lib/userTier.js";
import { sanitizeText, sanitizeUrl, TITLE_MAX_LENGTH, EXTERNAL_ID_MAX_LENGTH } from "../lib/sanitize.js";
import { getBoardGameById, getBoardGamesByIdsForImport } from "./bgg.js";
import { getBoardGameByIdLudopedia, fetchLudopediaColecaoObjectIdsForProfileName } from "./ludopedia.js";
import { fetchBggCollectionObjectIds } from "./bggCollection.js";
import { handleLogCreated } from "./gamification.service.js";
import { InvalidApiKeyError } from "../lib/InvalidApiKeyError.js";

const FREE_LOG_LIMIT = 500;
const MAX_IMPORT_ITEMS = 50_000;
const MAX_JOB_MS = 45 * 60 * 1000;
const BGG_IMPORT_BATCH = 20;

/** Rolling window between collection imports (protects BGG / Ludopedia daily quotas). */
export const COLLECTION_IMPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type CollectionImportSource = "bgg" | "ludopedia";
export type CollectionDuplicateMode = "skip" | "replace";

type JobStatus = "queued" | "running" | "completed" | "failed" | "timeout" | "limit_reached";

type JobState = {
  id: string;
  userId: string;
  status: JobStatus;
  source: CollectionImportSource;
  duplicateMode: CollectionDuplicateMode;
  current: number;
  total: number;
  lastTitle: string | null;
  error: string | null;
  code?: string;
  created: number;
  updated: number;
  imported: number;
  replaced: number;
  skipped: number;
  failed: number;
};

const jobs = new Map<string, JobState>();

function nowMs(): number {
  return Date.now();
}

/** Prefer `BGG_API_TOKEN` / `LUDOPEDIA_API_TOKEN` so a bad user key in Settings does not break imports. */
function preferEnvApiToken(envVal: string | undefined, userVal: string | null | undefined): string | null {
  const e = envVal?.trim();
  if (e) return e;
  const u = userVal?.trim();
  if (u) return u;
  return null;
}

export function getCollectionImportJob(jobId: string, userId: string): JobState | null {
  const j = jobs.get(jobId);
  if (!j || j.userId !== userId) return null;
  return j;
}

export type StartCollectionImportInput = {
  userId: string;
  source: CollectionImportSource;
  bggUsername?: string;
  ludopediaUsername?: string;
  duplicateMode: CollectionDuplicateMode;
};

export type StartCollectionImportResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string; code?: string; nextAvailableAt?: string };

function nextImportAvailableAt(last: Date | null): string {
  if (last == null) return new Date(0).toISOString();
  return new Date(last.getTime() + COLLECTION_IMPORT_COOLDOWN_MS).toISOString();
}

function isCooldownActive(last: Date | null): boolean {
  if (last == null) return false;
  return nowMs() - last.getTime() < COLLECTION_IMPORT_COOLDOWN_MS;
}

/** Create job, validate, queue worker. */
export async function startCollectionImportJobAsync(input: StartCollectionImportInput): Promise<StartCollectionImportResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      bggApiToken: true,
      ludopediaApiToken: true,
      tier: true,
      lastBoardGameCollectionImportAt: true,
    },
  });
  if (!user) {
    return { ok: false, error: "Account not found. Sign in and try again." };
  }

  if (isCooldownActive(user.lastBoardGameCollectionImportAt)) {
    return {
      ok: false,
      error:
        "A collection import was started recently. To avoid hitting BGG and Ludopedia daily API limits, you can run at most one import every 24 hours. Try again after the time below.",
      code: "COLLECTION_IMPORT_COOLDOWN",
      nextAvailableAt: nextImportAvailableAt(user.lastBoardGameCollectionImportAt),
    };
  }

  const bggToken = preferEnvApiToken(process.env.BGG_API_TOKEN, user.bggApiToken);
  const ludopediaToken = preferEnvApiToken(process.env.LUDOPEDIA_API_TOKEN, user.ludopediaApiToken);
  const duplicateMode = input.duplicateMode;

  let objectIds: string[] = [];

  const started = nowMs();

  try {
    if (input.source === "bgg") {
      const u = (input.bggUsername ?? "").trim();
      if (!u) {
        return { ok: false, error: "Enter your BoardGameGeek profile username to import your collection." };
      }
      if (!bggToken) {
        return { ok: false, error: "Add your BoardGameGeek API key in Settings first, then you can import.", code: "API_KEY_REQUIRED" };
      }
      const col = await fetchBggCollectionObjectIds(u, bggToken);
      if (col.error) {
        return { ok: false, error: col.error, code: col.errorCode };
      }
      objectIds = col.objectIds.slice(0, MAX_IMPORT_ITEMS);
    } else {
      if (!ludopediaToken) {
        return {
          ok: false,
          error: "Ludopedia import needs an API token. Set LUDOPEDIA_API_TOKEN for the app or add your token in Settings.",
          code: "API_KEY_REQUIRED",
        };
      }
      const lu = (input.ludopediaUsername ?? "").trim();
      if (!lu) {
        return { ok: false, error: "Enter the Ludopedia profile name whose collection you want to import." };
      }
      const col = await fetchLudopediaColecaoObjectIdsForProfileName(ludopediaToken, lu);
      if (col.error) {
        return { ok: false, error: col.error, code: col.errorCode };
      }
      objectIds = col.objectIds.slice(0, MAX_IMPORT_ITEMS);
    }
  } catch (e) {
    if (e instanceof InvalidApiKeyError) {
      return { ok: false, error: "The API key was rejected. Update it in Settings and try again.", code: "API_KEY_INVALID" };
    }
    const msg = e instanceof Error ? e.message : "Import could not be started. Try again in a moment.";
    return { ok: false, error: msg };
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { lastBoardGameCollectionImportAt: new Date() },
  });

  const jobId = randomUUID();
  const job: JobState = {
    id: jobId,
    userId: input.userId,
    status: "queued",
    source: input.source,
    duplicateMode,
    current: 0,
    total: objectIds.length,
    lastTitle: null,
    error: null,
    created: started,
    updated: started,
    imported: 0,
    replaced: 0,
    skipped: 0,
    failed: 0,
  };
  jobs.set(jobId, job);

  if (objectIds.length === 0) {
    job.status = "completed";
    job.updated = nowMs();
  } else {
    void runImportJob(
      job,
      objectIds,
      bggToken,
      ludopediaToken,
      user.tier ?? "free",
      started
    );
  }

  return { ok: true, jobId };
}

export function getNextBoardGameCollectionImportTime(last: Date | null): string | null {
  if (last == null) return null;
  if (!isCooldownActive(last)) return null;
  return nextImportAvailableAt(last);
}

async function canCreateOneMoreLog(userId: string, tier: string): Promise<boolean> {
  if (tierHasUnlimitedLogs(tier)) return true;
  const c = await prisma.log.count({ where: { userId } });
  return c < FREE_LOG_LIMIT;
}

function delayMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runImportJob(
  job: JobState,
  objectIds: string[],
  bggToken: string | null,
  ludopediaToken: string | null,
  tier: string,
  jobStartMs: number
): Promise<void> {
  job.status = "running";
  job.total = objectIds.length;
  job.updated = nowMs();
  const userId = job.userId;
  const source = job.source;
  const duplicateMode = job.duplicateMode;

  const detailToken = source === "bgg" ? bggToken : ludopediaToken;
  if (!detailToken) {
    job.status = "failed";
    job.error = "API token missing. Add your key in Settings.";
    job.updated = nowMs();
    return;
  }

  const processRow = async (extId: string, item: Awaited<ReturnType<typeof getBoardGameById>>, index: number) => {
    job.current = index + 1;
    job.updated = nowMs();

    if (item == null) {
      job.failed += 1;
      return;
    }

    const title = sanitizeText(decodeHtmlEntities(item.title), TITLE_MAX_LENGTH);
    const ext = sanitizeText(extId, EXTERNAL_ID_MAX_LENGTH);
    if (!title || !ext) {
      job.failed += 1;
      return;
    }
    job.lastTitle = title;
    const rawImage = item.image ?? item.thumbnail ?? null;
    const image = rawImage != null ? sanitizeUrl(rawImage) : null;
    const genres = item.genres?.length
      ? JSON.stringify(item.genres.slice(0, 20).map((g) => decodeHtmlEntities(g)))
      : item.categories?.length
        ? JSON.stringify(item.categories.slice(0, 20).map((g) => decodeHtmlEntities(g)))
        : null;
    const mechanics =
      item.mechanics && item.mechanics.length > 0
        ? JSON.stringify(item.mechanics.slice(0, 20).map((m) => decodeHtmlEntities(m)))
        : null;
    const boardGameSource: "bgg" | "ludopedia" = source;

    const existing = await prisma.log.findUnique({
      where: { userId_mediaType_externalId: { userId, mediaType: "boardgames", externalId: ext } },
    });
    if (existing) {
      if (duplicateMode === "replace") {
        await prisma.log.update({
          where: { id: existing.id },
          data: {
            title,
            image: image ?? null,
            genres: genres,
            mechanics: mechanics,
            boardGameSource,
            own: true,
            wantToBuy: false,
            sold: false,
          },
        });
        job.replaced += 1;
      } else {
        job.skipped += 1;
      }
      return;
    }

    if (!(await canCreateOneMoreLog(userId, tier))) {
      job.status = "limit_reached";
      job.code = "LOG_LIMIT_REACHED";
      job.error = "Your log limit for this plan was reached during the import.";
      job.updated = nowMs();
      void handleLogCreated(userId).catch(() => {});
      throw new Error("LOG_LIMIT");
    }

    await prisma.log.create({
      data: {
        userId,
        mediaType: "boardgames",
        externalId: ext,
        title,
        image: image ?? null,
        grade: null,
        review: null,
        listType: null,
        status: "plan to play",
        startedAt: null,
        completedAt: null,
        contentHours: null,
        hoursToBeat: null,
        season: null,
        episode: null,
        chapter: null,
        volume: null,
        genres: genres,
        mechanics: mechanics,
        affinityContext: null,
        boardGameSource,
        own: true,
        wantToBuy: false,
        sold: false,
        matchesPlayed: 0,
        purchaseAmountMinor: null,
        purchaseCurrency: null,
        saleAmountMinor: null,
        saleCurrency: null,
        spendFieldsAt: null,
      },
    });
    job.imported += 1;
  };

  if (source === "bgg") {
    for (let batchStart = 0; batchStart < objectIds.length; batchStart += BGG_IMPORT_BATCH) {
      if (nowMs() - jobStartMs > MAX_JOB_MS) {
        job.status = "timeout";
        job.error =
          "The import hit the per-run time cap. If your list is long, your catalog was only partly imported. Run the import again after 24 hours and choose to skip games already in Geeklogs to pull in the rest more quickly.";
        job.updated = nowMs();
        void handleLogCreated(userId).catch(() => {});
        return;
      }
      if (!(await canCreateOneMoreLog(userId, tier))) {
        job.status = "limit_reached";
        job.code = "LOG_LIMIT_REACHED";
        job.error = "Your log limit for this plan was reached during the import. Upgrade or free space, then use Import again (after 24h).";
        job.updated = nowMs();
        void handleLogCreated(userId).catch(() => {});
        return;
      }

      const chunk = objectIds.slice(batchStart, batchStart + BGG_IMPORT_BATCH);
      let batchMap: Map<string, NonNullable<Awaited<ReturnType<typeof getBoardGameById>>>>;
      try {
        batchMap = await getBoardGamesByIdsForImport(chunk, detailToken);
      } catch (e) {
        if (e instanceof InvalidApiKeyError) {
          job.status = "failed";
          job.error = "The API key was rejected while importing. Update it in Settings and try again after 24 hours.";
          job.code = "API_KEY_INVALID";
          job.updated = nowMs();
          void handleLogCreated(userId).catch(() => {});
          return;
        }
        throw e;
      }

      for (let j = 0; j < chunk.length; j++) {
        if (nowMs() - jobStartMs > MAX_JOB_MS) {
          job.status = "timeout";
          job.error =
            "The import hit the per-run time cap. If your list is long, your catalog was only partly imported. Run the import again after 24 hours and choose to skip games already in Geeklogs to pull in the rest more quickly.";
          job.updated = nowMs();
          void handleLogCreated(userId).catch(() => {});
          return;
        }

        const extId = chunk[j]!;
        const i = batchStart + j;

        try {
          let item = batchMap.get(extId) ?? null;
          if (item == null) {
            item = await getBoardGameById(extId, detailToken);
          }
          await processRow(extId, item, i);
        } catch (e) {
          if (e instanceof Error && e.message === "LOG_LIMIT") {
            return;
          }
          if (e instanceof InvalidApiKeyError) {
            job.status = "failed";
            job.error = "The API key was rejected while importing. Update it in Settings and try again after 24 hours.";
            job.code = "API_KEY_INVALID";
            job.updated = nowMs();
            void handleLogCreated(userId).catch(() => {});
            return;
          }
          job.failed += 1;
        }
      }
    }
  } else {
    for (let i = 0; i < objectIds.length; i++) {
      if (nowMs() - jobStartMs > MAX_JOB_MS) {
        job.status = "timeout";
        job.error =
          "The import hit the per-run time cap. If your list is long, your catalog was only partly imported. Run the import again after 24 hours and choose to skip games already in Geeklogs to pull in the rest more quickly.";
        job.updated = nowMs();
        void handleLogCreated(userId).catch(() => {});
        return;
      }
      if (!(await canCreateOneMoreLog(userId, tier))) {
        job.status = "limit_reached";
        job.code = "LOG_LIMIT_REACHED";
        job.error = "Your log limit for this plan was reached during the import. Upgrade or free space, then use Import again (after 24h).";
        job.updated = nowMs();
        void handleLogCreated(userId).catch(() => {});
        return;
      }

      const extId = objectIds[i]!;

      try {
        const item = await getBoardGameByIdLudopedia(extId, detailToken);
        await processRow(extId, item, i);
        await delayMs(120);
      } catch (e) {
        if (e instanceof Error && e.message === "LOG_LIMIT") {
          return;
        }
        if (e instanceof InvalidApiKeyError) {
          job.status = "failed";
          job.error = "The API key was rejected while importing. Update it in Settings and try again after 24 hours.";
          job.code = "API_KEY_INVALID";
          job.updated = nowMs();
          void handleLogCreated(userId).catch(() => {});
          return;
        }
        job.failed += 1;
      }
    }
  }

  job.status = "completed";
  job.updated = nowMs();
  try {
    await handleLogCreated(userId);
  } catch {
    // ignore
  }
}

export function _clearJobsForTests() {
  jobs.clear();
}
