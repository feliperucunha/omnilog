export type UpstreamProvider =
  | "tmdb"
  | "bgg"
  | "jikan"
  | "kitsu"
  | "rawg"
  | "openlibrary"
  | "comicvine"
  | "default";

const TIMEOUT_MS: Record<UpstreamProvider, number> = {
  tmdb: 8_000,
  bgg: 12_000,
  jikan: 8_000,
  kitsu: 10_000,
  rawg: 6_000,
  openlibrary: 10_000,
  comicvine: 10_000,
  default: 10_000,
};

export type UpstreamFetchInit = RequestInit & {
  provider?: UpstreamProvider;
  /** Retry once on 5xx or network failure (GET only). */
  retry?: boolean;
};

export async function upstreamFetch(
  input: RequestInfo | URL,
  init?: UpstreamFetchInit
): Promise<Response> {
  const provider = init?.provider ?? "default";
  const retry = init?.retry ?? false;
  const timeoutMs = TIMEOUT_MS[provider];
  const { provider: _p, retry: _r, ...fetchInit } = init ?? {};

  const attempt = async (): Promise<Response> => {
    return fetch(input, {
      ...fetchInit,
      signal: fetchInit.signal ?? AbortSignal.timeout(timeoutMs),
    });
  };

  try {
    const res = await attempt();
    if (retry && res.status >= 500) {
      return attempt();
    }
    return res;
  } catch (err) {
    /** Timeouts are unlikely to recover within a second retry and make errors feel stuck. */
    const timedOut =
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    if (retry && !timedOut) return attempt();
    throw err;
  }
}
