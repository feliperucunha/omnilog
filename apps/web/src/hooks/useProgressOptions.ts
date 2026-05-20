import { useEffect, useRef, useState } from "react";
import type { MediaType } from "@geeklogs/shared";
import { apiFetchCached } from "@/lib/api";
import { getCachedEntry } from "@/lib/cache";

export type ProgressOptions = {
  seasons?: number[];
  episodesBySeason?: Record<string, number[]>;
  episodes?: number[];
  chapters?: number[];
  volumes?: number[];
};

const PROGRESS_OPTIONS_TTL_MS = 5 * 60 * 1000;
const inflight = new Map<string, Promise<ProgressOptions>>();

function progressOptionsPath(mediaType: MediaType, externalId: string): string {
  return `/items/${mediaType}/${encodeURIComponent(externalId)}/progress-options`;
}

function readCachedProgressOptions(mediaType: MediaType, externalId: string): ProgressOptions | null {
  const entry = getCachedEntry<ProgressOptions>("GET", progressOptionsPath(mediaType, externalId));
  return entry?.data ?? null;
}

export function useProgressOptions(
  mediaType: MediaType,
  externalId: string | null | undefined,
  enabled: boolean
): { progressOptions: ProgressOptions | null; progressOptionsLoading: boolean } {
  const [progressOptions, setProgressOptions] = useState<ProgressOptions | null>(() => {
    if (!enabled || !externalId) return null;
    return readCachedProgressOptions(mediaType, externalId);
  });
  const [progressOptionsLoading, setProgressOptionsLoading] = useState(() => {
    if (!enabled || !externalId) return false;
    return readCachedProgressOptions(mediaType, externalId) === null;
  });
  const hasDisplayedDataRef = useRef(progressOptions !== null);

  useEffect(() => {
    if (!enabled || !externalId) {
      hasDisplayedDataRef.current = false;
      setProgressOptions(null);
      setProgressOptionsLoading(false);
      return;
    }

    const path = progressOptionsPath(mediaType, externalId);
    const cacheKey = `GET ${path}`;
    const cached = readCachedProgressOptions(mediaType, externalId);

    if (cached) {
      hasDisplayedDataRef.current = true;
      setProgressOptions(cached);
      setProgressOptionsLoading(false);
    } else if (!hasDisplayedDataRef.current) {
      setProgressOptionsLoading(true);
    }

    let request = inflight.get(cacheKey);
    if (!request) {
      request = apiFetchCached<ProgressOptions>(path, { ttlMs: PROGRESS_OPTIONS_TTL_MS }).finally(() => {
        inflight.delete(cacheKey);
      });
      inflight.set(cacheKey, request);
    }

    let cancelled = false;
    request
      .then((data) => {
        if (cancelled) return;
        hasDisplayedDataRef.current = true;
        setProgressOptions(data);
        setProgressOptionsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        if (!hasDisplayedDataRef.current) {
          setProgressOptions(null);
        }
        setProgressOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, mediaType, externalId]);

  return { progressOptions, progressOptionsLoading };
}
