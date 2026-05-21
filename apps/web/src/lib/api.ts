import { APP_VERSION } from "@geeklogs/shared";
import type { LoadingErrorCode } from "./loadingErrorCodes.js";
import { LoadingErrorCode as LoadingErrorCodeEnum } from "./loadingErrorCodes.js";

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
let API_BASE = rawApiUrl ?? "/api";
if (import.meta.env.DEV && API_BASE.startsWith("https://localhost")) {
  API_BASE = API_BASE.replace("https://", "http://");
}
if (API_BASE.startsWith("http") && !API_BASE.endsWith("/api")) {
  API_BASE = API_BASE.replace(/\/?$/, "") + "/api";
}
export function getApiBase(): string {
  return API_BASE;
}
/** Per-attempt timeout; apiFetch retries several times for cold/sleeping servers. */
const DEFAULT_TIMEOUT_MS = 55_000;

/** Called once when the first API response is received (cold-start UX). Set from app root. */
let onFirstApiResponse: (() => void) | null = null;
let onFirstApiError: ((code: LoadingErrorCode) => void) | null = null;
let firstApiOutcomeFired = false;

export function setOnFirstApiResponse(callback: () => void): void {
  onFirstApiResponse = callback;
}
export function setOnFirstApiError(callback: (code: LoadingErrorCode) => void): void {
  onFirstApiError = callback;
}

function fireFirstApiResponseOnce(): void {
  if (firstApiOutcomeFired) return;
  firstApiOutcomeFired = true;
  onFirstApiResponse?.();
  onFirstApiResponse = null;
  onFirstApiError = null;
}

function fireFirstApiErrorOnce(code: LoadingErrorCode = LoadingErrorCodeEnum.UNKNOWN): void {
  if (firstApiOutcomeFired) return;
  firstApiOutcomeFired = true;
  onFirstApiError?.(code);
  onFirstApiResponse = null;
  onFirstApiError = null;
}

function statusToLoadingErrorCode(status: number): LoadingErrorCode {
  if (status === 401) return LoadingErrorCodeEnum.UNAUTHORIZED;
  if (status === 403) return LoadingErrorCodeEnum.FORBIDDEN;
  if (status === 404) return LoadingErrorCodeEnum.NOT_FOUND;
  if (status >= 500 && status < 600) return LoadingErrorCodeEnum.SERVER_ERROR;
  return LoadingErrorCodeEnum.CLIENT_ERROR;
}

import {
  DEFAULT_TTL_MS,
  getCached,
  getCachedEntry,
  setCached,
  invalidateByPrefix,
  markStaleByPrefix,
} from "./cache.js";

import { clearAuthSession, getItemSync } from "./storage.js";
import { isPublicAuthPath } from "./authSession.js";

/** Sentinel for cookie-based sessions (no token in storage). */
const COOKIE_SESSION = "cookie";

export const APP_VERSION_MISMATCH_CODE = "APP_VERSION_MISMATCH";

export function isNativePlatform(): boolean {
  const w = typeof window !== "undefined"
    ? (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
    : null;
  return Boolean(w?.Capacitor?.isNativePlatform?.());
}

export function getAuthHeaders(): HeadersInit {
  const token = getItemSync("geeklogs_token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (isNativePlatform()) {
    headers["X-App-Version"] = APP_VERSION;
  }
  if (token && token !== COOKIE_SESSION) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/** Dispatch so AuthContext can clear state on 401 (e.g. when using cookie session). */
function dispatchLogout(): void {
  window.dispatchEvent(new CustomEvent("auth:logout"));
}

let sessionExpiryHandling: Promise<void> | null = null;

async function handleSessionExpired(): Promise<void> {
  if (sessionExpiryHandling) return sessionExpiryHandling;
  sessionExpiryHandling = (async () => {
    await clearAuthSession();
    dispatchLogout();
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (!isPublicAuthPath(path)) {
        window.location.assign("/login");
      }
    }
  })().finally(() => {
    sessionExpiryHandling = null;
  });
  return sessionExpiryHandling;
}

/** Error code returned by API for log limit (free tier). Check err.message === this to show tier message. */
export const LOG_LIMIT_REACHED_CODE = "LOG_LIMIT_REACHED";

/** Error code when the user's API key was rejected by the provider (401/403). */
export const INVALID_API_KEY_CODE = "INVALID_API_KEY";

/** Thrown when API returns 4xx/5xx. Use statusCode to treat 401 as session expired (logout). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    /** Overrides cold-start / loading screen error code (e.g. version mismatch on 401). */
    public readonly loadingErrorCode?: LoadingErrorCode
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thrown when API returns 400 with code INVALID_API_KEY. provider is the key to use with API_KEY_META. */
export class InvalidApiKeyError extends Error {
  constructor(
    message: string,
    public readonly provider: string
  ) {
    super(message);
    this.name = "InvalidApiKeyError";
  }
}

/**
 * Shown when the response isn’t normal app data (often right after the hosted app wakes up).
 * Kept stable so retry logic can match on this exact string.
 */
const HTML_RESPONSE_MESSAGE =
  "Geeklogs isn’t ready yet—this often happens when it hasn’t been used for a while. Wait a moment, then try again.";

/** Fallbacks when the backend doesn’t return a clear message (plain language, no jargon). */
const MSG = {
  versionOutdated:
    "This copy of Geeklogs is too old. Update it from the store or site where you installed it, then open the app again.",
  sessionEnded: "Your sign-in has expired. Please sign in again to keep using your lists and reviews.",
  genericServer:
    "Geeklogs couldn’t finish that just now. Please try again in a minute or two—especially if you haven’t opened the app in a while.",
  genericNotOk:
    "Something didn’t work while talking to Geeklogs. Please try again. If it keeps happening, check your internet connection.",
  notFound: "We couldn’t find that—it may have been removed or the link might be wrong.",
  tookTooLong:
    "Geeklogs is taking much longer than usual—often right after it hasn’t been used for a while. Check your internet, wait a bit, and try again.",
  offline:
    "We couldn’t reach Geeklogs. Check that you’re online (Wi‑Fi or mobile data), then try again.",
  parseFallback:
    "We couldn’t understand the reply from Geeklogs. Please try again in a moment.",
  downloadFailed:
    "We couldn’t prepare your file. Check that you’re still signed in, then try exporting again.",
} as const;

function looksLikeHtml(text: string): boolean {
  const t = text.trimStart().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html");
}

function parseErrorResponse(text: string, fallback: string): string {
  if (looksLikeHtml(text)) return HTML_RESPONSE_MESSAGE;
  try {
    const data = JSON.parse(text) as { error?: string | Record<string, unknown>; code?: string };
    if (data.code === LOG_LIMIT_REACHED_CODE) return LOG_LIMIT_REACHED_CODE;
    if (typeof data.error === "string") return data.error;
    if (data.error && typeof data.error === "object") {
      const obj = data.error as { message?: string; code?: string };
      if (obj.code === LOG_LIMIT_REACHED_CODE) return LOG_LIMIT_REACHED_CODE;
      if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
      return MSG.parseFallback;
    }
  } catch {
    const t = text?.trim() ?? "";
    if (t && !looksLikeHtml(t) && !t.includes("{") && !t.includes("[") && t.length < 300) {
      return t.slice(0, 280);
    }
  }
  return fallback;
}

/** Parses 400 response body for Zod-style field errors: { error: { field: ["msg"] } }. Returns null if not field errors. */
function parseFieldErrors(text: string): Record<string, string> | null {
  try {
    const data = JSON.parse(text) as { error?: Record<string, unknown> };
    const err = data.error;
    if (!err || typeof err !== "object" || Array.isArray(err)) return null;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(err)) {
      const arr = Array.isArray(value) ? value : [value];
      const first = arr.map(String).find((s) => s.length > 0);
      if (first) out[key] = first;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Thrown when API returns 400 with field-level validation errors. */
export class ApiValidationError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string>
  ) {
    super(message);
    this.name = "ApiValidationError";
  }
}

/** Statuses where a sleeping / cold-starting server may recover on retry. */
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const MAX_FETCH_ATTEMPTS = 4;
const RETRY_BACKOFF_MS = [2000, 4500, 9000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableAfterError(err: unknown): boolean {
  if (err instanceof InvalidApiKeyError || err instanceof ApiValidationError) return false;
  if (err instanceof ApiError) {
    if (err.loadingErrorCode === LoadingErrorCodeEnum.VERSION_MISMATCH) return false;
    if (RETRYABLE_HTTP_STATUSES.has(err.statusCode)) return true;
    /** Proxy / sleeping host often returns HTML instead of JSON. */
    if (err.message === HTML_RESPONSE_MESSAGE) return true;
    return false;
  }
  if (err instanceof Error && err.name === "AbortError") return true;
  if (err instanceof TypeError) return true;
  return false;
}

function fireFirstApiErrorFromCaught(err: unknown): void {
  if (err instanceof InvalidApiKeyError || err instanceof ApiValidationError) {
    fireFirstApiErrorOnce(LoadingErrorCodeEnum.CLIENT_ERROR);
    return;
  }
  if (err instanceof ApiError) {
    if (
      err.loadingErrorCode === LoadingErrorCodeEnum.VERSION_MISMATCH &&
      isNativePlatform()
    ) {
      return;
    }
    fireFirstApiErrorOnce(err.loadingErrorCode ?? statusToLoadingErrorCode(err.statusCode));
    return;
  }
  if (err instanceof Error && err.name === "AbortError") {
    fireFirstApiErrorOnce(LoadingErrorCodeEnum.TIMEOUT);
    return;
  }
  fireFirstApiErrorOnce(LoadingErrorCodeEnum.NETWORK);
}

/** Invalidate cached GET requests. Call after mutations (create/update/delete logs). */
export function invalidateApiCache(prefix: string): void {
  invalidateByPrefix(prefix);
}

/** Custom event dispatched when logs/items cache is invalidated so Dashboard/MediaLogs can refetch milestone progress. */
export const LOGS_INVALIDATED_EVENT = "geeklogs-logs-invalidated";

/** Background re-warm of dashboard/statistics caches after mutations. */
export const LOGS_CACHE_WARM_EVENT = "geeklogs-logs-cache-warm";

/** Invalidate logs and items caches (use after any log mutation). */
export function invalidateLogsAndItemsCache(): void {
  swrInflight.clear();
  markStaleByPrefix("/logs");
  markStaleByPrefix("/items");
  markStaleByPrefix("/me");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LOGS_INVALIDATED_EVENT));
    window.dispatchEvent(new CustomEvent(LOGS_CACHE_WARM_EVENT));
  }
}

export { DEFAULT_TTL_MS, HEAVY_PAGE_TTL_MS } from "./cache.js";
export { getCachedEntry } from "./cache.js";

export interface ApiFetchOptions extends RequestInit {
  timeout?: number;
  /** When true, do not redirect to /login on 401 (e.g. for session restore or logout). */
  skipAuthRedirect?: boolean;
}

/** One fetch attempt; does not fire cold-start callbacks (retries may run first). */
async function performSingleFetchAttempt<T>(
  path: string,
  options: ApiFetchOptions | undefined,
  timeoutMs: number
): Promise<T> {
  const { timeout: _t, skipAuthRedirect, ...fetchOptions } = options ?? {};

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      credentials: "include",
      signal: controller.signal,
      headers: { ...getAuthHeaders(), ...fetchOptions.headers },
    });
    clearTimeout(timeoutId);

    const text = await res.text();

    if (res.status === 401) {
      let code: string | undefined;
      try {
        const data = JSON.parse(text) as { code?: string };
        code = data.code;
      } catch {
        /* ignore */
      }
      if (code === APP_VERSION_MISMATCH_CODE && isNativePlatform()) {
        let requiredVersion: string | undefined;
        try {
          const body = JSON.parse(text) as { requiredVersion?: string };
          requiredVersion = body.requiredVersion;
        } catch {
          /* ignore */
        }
        window.dispatchEvent(
          new CustomEvent("app:version-mismatch", { detail: { requiredVersion } })
        );
        throw new ApiError(parseErrorResponse(text, MSG.versionOutdated), 401, LoadingErrorCodeEnum.VERSION_MISMATCH);
      }
      const message = parseErrorResponse(text, MSG.sessionEnded);
      if (!skipAuthRedirect) {
        void handleSessionExpired();
      } else {
        /**
         * Session probe and similar calls use skipAuthRedirect; 401 means "no session" but the API
         * responded. Treat as cold-start success so guests are not stuck on the loading/error overlay
         * (e.g. public profile at /:userId).
         */
        fireFirstApiResponseOnce();
      }
      throw new ApiError(message, 401);
    }

    if (looksLikeHtml(text)) {
      throw new ApiError(HTML_RESPONSE_MESSAGE, res.ok ? 502 : res.status);
    }

    if (!res.ok) {
      const message = parseErrorResponse(
        text,
        res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504
          ? MSG.genericServer
          : res.status === 404
            ? MSG.notFound
            : MSG.genericNotOk
      );
      if (res.status === 400) {
        try {
          const data = JSON.parse(text) as { code?: string; provider?: string };
          if (data.code === INVALID_API_KEY_CODE && typeof data.provider === "string") {
            window.dispatchEvent(
              new CustomEvent("api:invalid-key", { detail: { provider: data.provider } })
            );
            throw new InvalidApiKeyError(message, data.provider);
          }
        } catch (e) {
          if (e instanceof InvalidApiKeyError) throw e;
        }
        const fieldErrors = parseFieldErrors(text);
        if (fieldErrors) throw new ApiValidationError(message, fieldErrors);
      }
      throw new ApiError(message, res.status);
    }

    if (!text) return undefined as T;
    if (looksLikeHtml(text)) {
      throw new ApiError(HTML_RESPONSE_MESSAGE, 502);
    }
    return JSON.parse(text) as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error) throw err;
    throw new Error(MSG.offline);
  }
}

async function fetchInternal<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      const result = await performSingleFetchAttempt<T>(path, options, timeoutMs);
      fireFirstApiResponseOnce();
      return result;
    } catch (e) {
      lastError = e;
      const canRetry = attempt < MAX_FETCH_ATTEMPTS - 1 && isRetryableAfterError(e);
      if (!canRetry) {
        fireFirstApiErrorFromCaught(e);
        if (e instanceof Error && e.name === "AbortError") {
          throw new Error(MSG.tookTooLong);
        }
        throw e;
      }
      const delayMs = RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      await sleep(delayMs);
    }
  }
  fireFirstApiErrorFromCaught(lastError);
  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new Error(MSG.tookTooLong);
  }
  throw lastError;
}

async function performSinglePublicFetchAttempt<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "omit",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(isNativePlatform() ? { "X-App-Version": APP_VERSION } : {}),
        ...options?.headers,
      },
    });
    clearTimeout(timeoutId);
    const text = await res.text();
    if (looksLikeHtml(text)) {
      throw new ApiError(HTML_RESPONSE_MESSAGE, res.ok ? 502 : res.status);
    }
    if (!res.ok) {
      const message = parseErrorResponse(text, res.status === 404 ? MSG.notFound : MSG.genericNotOk);
      throw new ApiError(message, res.status);
    }
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") throw err;
    if (err instanceof ApiError) throw err;
    throw err instanceof Error ? err : new Error(MSG.offline);
  }
}

function publicFetchErrorToError(e: unknown): Error {
  if (e instanceof Error && e.name === "AbortError") {
    return new Error(MSG.tookTooLong);
  }
  if (e instanceof ApiError) return new Error(e.message);
  if (e instanceof Error) return e;
  return new Error(MSG.offline);
}

/**
 * Fetch public API (no auth). Use for read-only public endpoints (e.g. /users/:id).
 * Does not send credentials or redirect on 401.
 */
export async function apiFetchPublic<T>(path: string, options?: RequestInit): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      const result = await performSinglePublicFetchAttempt<T>(path, options);
      fireFirstApiResponseOnce();
      return result;
    } catch (e) {
      lastError = e;
      const canRetry = attempt < MAX_FETCH_ATTEMPTS - 1 && isRetryableAfterError(e);
      if (!canRetry) {
        fireFirstApiErrorFromCaught(e);
        throw publicFetchErrorToError(e);
      }
      const delayMs = RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      await sleep(delayMs);
    }
  }
  fireFirstApiErrorFromCaught(lastError);
  throw publicFetchErrorToError(lastError);
}

/**
 * Fetch from API. Use for mutations and when you don't want cache.
 */
export async function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions
): Promise<T> {
  return fetchInternal<T>(path, options);
}

const rawApiBase = (): string => {
  let base = rawApiUrl ?? "/api";
  if (import.meta.env.DEV && base.startsWith("https://localhost"))
    base = base.replace("https://", "http://");
  if (base.startsWith("http") && !base.endsWith("/api"))
    base = base.replace(/\/?$/, "") + "/api";
  return base;
};

/**
 * Fetch a file from the API (e.g. CSV export). Returns blob and suggested filename.
 * Uses credentials so auth is sent. Caller should trigger download (e.g. object URL + link click).
 */
export async function apiFetchFile(
  path: string
): Promise<{ blob: Blob; filename: string }> {
  const url = `${rawApiBase()}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    const msg = parseErrorResponse(text, MSG.downloadFailed);
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename =
    disposition?.match(/filename="([^"]+)"/)?.[1] ?? "download";
  return { blob, filename };
}

/**
 * Trigger a file download.
 * - Web: same as before — object URL + programmatic anchor click (file downloads to the user's machine).
 * - Native (Android/iOS): write to app cache and open the share sheet so the user can save the file.
 */
export async function downloadFile(blob: Blob, filename: string): Promise<void> {
  const w = typeof window !== "undefined" ? (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }) : null;
  const isNative = Boolean(w?.Capacitor?.isNativePlatform?.());

  // Web: original behavior — no Capacitor or isNativePlatform() is false in the browser
  if (!isNative) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Native only: Filesystem + Share (Capacitor plugins are dynamically imported so they are not loaded on web)
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const text = await blob.text();
  const path = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  await Filesystem.writeFile({
    path,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path });
  await Share.share({
    url: uri,
    dialogTitle: filename,
  });
}

/**
 * Fetch from API with client cache for GET requests. Use for reads that benefit from caching.
 * Pass ttlMs to control how long the response is cached (default 2 minutes).
 * Mutations should call invalidateLogsAndItemsCache() so subsequent cached reads are fresh.
 */
export async function apiFetchCached<T>(
  path: string,
  options?: ApiFetchOptions & { ttlMs?: number }
): Promise<T> {
  const method = options?.method ?? "GET";
  if (method !== "GET") {
    return fetchInternal<T>(path, options);
  }
  const cached = getCached<T>(method, path);
  if (cached !== undefined) return cached;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const { ttlMs: _ttl, ...fetchOpts } = options ?? {};
  const data = await fetchInternal<T>(path, fetchOpts);
  setCached(method, path, data, ttlMs);
  return data;
}

const swrInflight = new Map<string, Promise<unknown>>();

function cacheDataChanged(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return true;
  }
}

async function revalidateGet<T>(
  path: string,
  fetchOpts: ApiFetchOptions | undefined,
  ttlMs: number
): Promise<T> {
  const key = `GET ${path}`;
  const existing = swrInflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetchInternal<T>(path, fetchOpts)
    .then((data) => {
      setCached("GET", path, data, ttlMs);
      return data;
    })
    .finally(() => {
      swrInflight.delete(key);
    });

  swrInflight.set(key, promise);
  return promise;
}

export type ApiFetchSWROptions = ApiFetchOptions & {
  ttlMs?: number;
  /** Called when a background revalidation returns (only if JSON changed). */
  onUpdate?: (data: unknown) => void;
  onRefreshing?: (refreshing: boolean) => void;
};

/**
 * Stale-while-revalidate GET: returns cached data immediately when present, revalidates in background.
 * Without cache, awaits the network (callers should show loading).
 */
export async function apiFetchSWR<T>(
  path: string,
  options?: ApiFetchSWROptions
): Promise<{ data: T; fromCache: boolean }> {
  const method = options?.method ?? "GET";
  if (method !== "GET") {
    const data = await fetchInternal<T>(path, options);
    return { data, fromCache: false };
  }

  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const { ttlMs: _ttl, onUpdate, onRefreshing, ...fetchOpts } = options ?? {};
  const entry = getCachedEntry<T>("GET", path);

  if (!entry) {
    onRefreshing?.(true);
    try {
      const data = await revalidateGet<T>(path, fetchOpts, ttlMs);
      return { data, fromCache: false };
    } finally {
      onRefreshing?.(false);
    }
  }

  const runBackground = async () => {
    onRefreshing?.(true);
    try {
      const previous = entry.data;
      const fresh = await revalidateGet<T>(path, fetchOpts, ttlMs);
      if (onUpdate && cacheDataChanged(previous, fresh)) {
        onUpdate(fresh);
      }
    } catch {
      /* keep stale UI on background failure */
    } finally {
      onRefreshing?.(false);
    }
  };

  void runBackground();

  return { data: entry.data, fromCache: true };
}
