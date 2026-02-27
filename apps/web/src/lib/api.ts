const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
let API_BASE = rawApiUrl ?? "/api";
if (import.meta.env.DEV && API_BASE.startsWith("https://localhost")) {
  API_BASE = API_BASE.replace("https://", "http://");
}
if (API_BASE.startsWith("http") && !API_BASE.endsWith("/api")) {
  API_BASE = API_BASE.replace(/\/?$/, "") + "/api";
}
const DEFAULT_TIMEOUT_MS = 15000;

import { getCached, setCached, invalidateByPrefix } from "./cache.js";

/** Sentinel for cookie-based sessions (no token in localStorage). */
const COOKIE_SESSION = "cookie";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("logeverything_token");
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token && token !== COOKIE_SESSION) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/** Dispatch so AuthContext can clear state on 401 (e.g. when using cookie session). */
function dispatchLogout(): void {
  window.dispatchEvent(new CustomEvent("auth:logout"));
}

/** Error code returned by API for log limit (free tier). Check err.message === this to show tier message. */
export const LOG_LIMIT_REACHED_CODE = "LOG_LIMIT_REACHED";

function parseErrorResponse(text: string, fallback: string): string {
  try {
    const data = JSON.parse(text) as { error?: string | Record<string, unknown>; code?: string };
    if (data.code === LOG_LIMIT_REACHED_CODE) return LOG_LIMIT_REACHED_CODE;
    if (typeof data.error === "string") return data.error;
    if (data.error && typeof data.error === "object") {
      const obj = data.error as { message?: string; code?: string };
      if (obj.code === LOG_LIMIT_REACHED_CODE) return LOG_LIMIT_REACHED_CODE;
      return obj.message ?? JSON.stringify(data.error);
    }
  } catch {
    if (text && text.trim().length > 0) return text.trim().slice(0, 200);
  }
  return fallback;
}

/** Invalidate cached GET requests. Call after mutations (create/update/delete logs). */
export function invalidateApiCache(prefix: string): void {
  invalidateByPrefix(prefix);
}

/** Invalidate logs and items caches (use after any log mutation). */
export function invalidateLogsAndItemsCache(): void {
  invalidateByPrefix("/logs");
  invalidateByPrefix("/items");
}

export interface ApiFetchOptions extends RequestInit {
  timeout?: number;
  /** When true, do not redirect to /login on 401 (e.g. for session restore or logout). */
  skipAuthRedirect?: boolean;
}

async function fetchInternal<T>(
  path: string,
  options?: ApiFetchOptions
): Promise<T> {
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS;
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
      const message = parseErrorResponse(text, "Session expired. Please sign in again.");
      if (!skipAuthRedirect) {
        localStorage.removeItem("logeverything_token");
        localStorage.removeItem("logeverything_user");
        dispatchLogout();
        window.location.href = "/login";
      }
      throw new Error(message);
    }

    if (!res.ok) {
      const message = parseErrorResponse(
        text,
        res.status === 500 ? "Something went wrong. Please try again." : res.statusText || "Request failed"
      );
      throw new Error(message);
    }

    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === "AbortError") throw new Error("Request took too long. Please try again.");
      throw err;
    }
    throw new Error("Network error. Check your connection and try again.");
  }
}

/**
 * Fetch public API (no auth). Use for read-only public endpoints (e.g. /users/:id).
 * Does not send credentials or redirect on 401.
 */
export async function apiFetchPublic<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "omit",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    clearTimeout(timeoutId);
    const text = await res.text();
    if (!res.ok) {
      const message = parseErrorResponse(text, res.status === 404 ? "Not found" : "Request failed");
      throw new Error(message);
    }
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === "AbortError") throw new Error("Request took too long. Please try again.");
      throw err;
    }
    throw new Error("Network error. Check your connection and try again.");
  }
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
    const msg = parseErrorResponse(text, "Download failed");
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename =
    disposition?.match(/filename="([^"]+)"/)?.[1] ?? "download";
  return { blob, filename };
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
  const ttlMs = options?.ttlMs ?? 2 * 60 * 1000;
  const { ttlMs: _ttl, ...fetchOpts } = options ?? {};
  const data = await fetchInternal<T>(path, fetchOpts);
  setCached(method, path, data, ttlMs);
  return data;
}
