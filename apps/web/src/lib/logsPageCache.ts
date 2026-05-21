import {
  MEDIA_TYPES,
  SPEND_TRACKED_MEDIA_TYPES,
  type Log,
  type MediaType,
} from "@geeklogs/shared";
import {
  apiFetchSWR,
  getCachedEntry,
  HEAVY_PAGE_TTL_MS,
  LOGS_CACHE_WARM_EVENT,
} from "@/lib/api";
import { updateCachedEntriesMatching } from "@/lib/cache.js";

const LOGS_PAGE_SIZE = 24;
const DEFAULT_SORT = "dateDesc";
const MAX_FRIEND_FEED_PREFETCH = 50;

export const FOLLOWS_PATH = "/follows";
export const MILESTONES_PATH = "/me/milestones/progress";

let registeredMediaTypes: MediaType[] = [...MEDIA_TYPES];
let registeredFollowedUserIds: string[] = [];
let registeredTzOffset = -new Date().getTimezoneOffset();
let registeredIsPro = false;
let warmListenerInstalled = false;

export function registerFollowedUserIds(userIds: string[]): void {
  registeredFollowedUserIds = userIds;
}

export function registerLogsPageCacheContext(options: {
  mediaTypes: MediaType[];
  tzOffsetMinutes?: number;
  isPro?: boolean;
}): void {
  registeredMediaTypes = options.mediaTypes.length > 0 ? options.mediaTypes : [...MEDIA_TYPES];
  if (options.tzOffsetMinutes != null) registeredTzOffset = options.tzOffsetMinutes;
  if (options.isPro != null) registeredIsPro = options.isPro;
}

function mediaQuery(mediaType: MediaType | "all"): string {
  return mediaType === "all" ? "" : `&mediaType=${encodeURIComponent(mediaType)}`;
}

export type LogsListFilters = {
  mediaType: MediaType;
  sort?: string;
  status?: string;
  q?: string;
  own?: boolean;
  wantToBuy?: boolean;
  genre?: string;
  limit?: number;
  cursor?: string;
};

export function buildLogsListPath(filters: LogsListFilters): string {
  const params = new URLSearchParams({
    mediaType: filters.mediaType,
    sort: filters.sort ?? DEFAULT_SORT,
    limit: String(filters.limit ?? LOGS_PAGE_SIZE),
  });
  if (filters.status) params.set("status", filters.status);
  if (filters.own) params.set("own", "true");
  if (filters.wantToBuy) params.set("wantToBuy", "true");
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.genre?.trim()) params.set("genre", filters.genre.trim());
  if (filters.cursor) params.set("cursor", filters.cursor);
  return `/logs?${params.toString()}`;
}

export function buildLogsListPathFromSearchParams(
  mediaType: MediaType,
  searchParams: URLSearchParams
): string {
  return buildLogsListPath({
    mediaType,
    sort: searchParams.get("sort") ?? DEFAULT_SORT,
    status: searchParams.get("status") ?? "",
    q: searchParams.get("q") ?? "",
    own: searchParams.get("own") === "true",
    wantToBuy: searchParams.get("wantToBuy") === "true",
    genre: searchParams.get("genre") ?? "",
  });
}

export function readCachedLogsListResponse(
  path: string
): { raw: Log[] | { data: Log[]; nextCursor: string | null }; list: Log[]; cursor: string | null } | null {
  const entry = getCachedEntry<Log[] | { data: Log[]; nextCursor: string | null }>("GET", path);
  if (!entry) return null;
  const raw = entry.data;
  const list = Array.isArray(raw) ? raw : (raw.data ?? []);
  const cursor = Array.isArray(raw) ? null : (raw.nextCursor ?? null);
  return { raw, list, cursor };
}

type LogsListCachePayload = Log[] | { data: Log[]; nextCursor?: string | null };

function patchLogsListPayload(raw: LogsListCachePayload, log: Log): LogsListCachePayload | undefined {
  const id = log.id;
  if (Array.isArray(raw)) {
    if (!raw.some((l) => l.id === id)) return undefined;
    return raw.map((l) => (l.id === id ? log : l));
  }
  if (raw.data?.some((l) => l.id === id)) {
    return { ...raw, data: raw.data.map((l) => (l.id === id ? log : l)) };
  }
  return undefined;
}

export function upsertLogInClientCaches(log: Log): void {
  updateCachedEntriesMatching(
    "GET /logs?",
    (data) => patchLogsListPayload(data as LogsListCachePayload, log),
    HEAVY_PAGE_TTL_MS
  );
}

export function buildLogsListPathFromFilters(
  mediaType: MediaType,
  filters: {
    sort?: string;
    status?: string;
    search?: string;
    collection?: "" | "owned" | "wantToBuy";
    genre?: string;
  },
  showCollectionOwnership: boolean
): string {
  return buildLogsListPath({
    mediaType,
    sort: filters.sort ?? DEFAULT_SORT,
    status: filters.status ?? "",
    q: filters.search ?? "",
    own: showCollectionOwnership && filters.collection === "owned",
    wantToBuy: showCollectionOwnership && filters.collection === "wantToBuy",
    genre: filters.genre ?? "",
  });
}

export function buildDefaultLogsListPath(mediaType: MediaType): string {
  return buildLogsListPath({ mediaType });
}

export function buildStatusCountsPath(mediaType: MediaType): string {
  return `/logs/status-counts?mediaType=${encodeURIComponent(mediaType)}`;
}

export function buildFeedPath(userId?: string): string {
  return userId ? `/logs/feed?userId=${encodeURIComponent(userId)}` : "/logs/feed";
}

function prefetchGet(path: string): void {
  void apiFetchSWR(path, { ttlMs: HEAVY_PAGE_TTL_MS });
}

export function warmFriendFeedCaches(userIds: string[]): void {
  for (const id of userIds.slice(0, MAX_FRIEND_FEED_PREFETCH)) {
    prefetchGet(buildFeedPath(id));
  }
}

export function prefetchDashboardCategoryView(
  mediaType: MediaType,
  searchParams: URLSearchParams
): void {
  prefetchGet(buildLogsListPathFromSearchParams(mediaType, searchParams));
  prefetchGet(buildStatusCountsPath(mediaType));
}

function warmStatisticsForFilter(filter: MediaType | "all", tz: number, isPro: boolean): void {
  const mq = mediaQuery(filter);
  prefetchGet(`/logs/stats?group=summary&timezoneOffsetMinutes=${tz}${mq}`);
  prefetchGet(`/logs/stats?group=category&timezoneOffsetMinutes=${tz}${mq}`);
  prefetchGet(`/logs/stats?group=genre&timezoneOffsetMinutes=${tz}${mq}`);
  if (isPro) {
    prefetchGet(`/logs?limit=5&sort=dateDesc${mq}`);
  } else {
    prefetchGet(
      `/logs?limit=5&sort=dateDesc&forStatistics=1&timezoneOffsetMinutes=${tz}${mq}`
    );
  }
  if (filter === "games" || filter === "all") {
    prefetchGet(`/logs/stats?group=gamePlatforms&timezoneOffsetMinutes=${tz}${mq}`);
  }
  if (filter === "all" || (SPEND_TRACKED_MEDIA_TYPES as readonly string[]).includes(filter)) {
    prefetchGet(
      `/logs/stats?group=purchaseSpending&period=month&timezoneOffsetMinutes=${tz}${mq}`
    );
  }
  if (isPro) {
    prefetchGet(`/logs/stats?group=completedByMonth&timezoneOffsetMinutes=${tz}${mq}`);
    prefetchGet(`/logs/stats?group=categoryByMonth&timezoneOffsetMinutes=${tz}${mq}`);
  }
}

export function warmDashboardLogsCaches(
  mediaTypes: MediaType[] = registeredMediaTypes,
  followedUserIds?: string[]
): void {
  prefetchGet("/logs/counts");
  prefetchGet(FOLLOWS_PATH);
  prefetchGet(MILESTONES_PATH);
  prefetchGet(buildFeedPath());
  if (followedUserIds?.length) warmFriendFeedCaches(followedUserIds);

  for (const mt of mediaTypes) {
    prefetchGet(buildDefaultLogsListPath(mt));
    prefetchGet(buildStatusCountsPath(mt));
  }
}

export function warmStatisticsCaches(
  mediaTypes: MediaType[] = registeredMediaTypes,
  tzOffsetMinutes: number = registeredTzOffset,
  isPro: boolean = registeredIsPro
): void {
  warmStatisticsForFilter("all", tzOffsetMinutes, isPro);
  for (const mt of mediaTypes) {
    warmStatisticsForFilter(mt, tzOffsetMinutes, isPro);
  }
}

export function warmDashboardAndStatisticsCaches(
  mediaTypes: MediaType[] = registeredMediaTypes,
  tzOffsetMinutes: number = registeredTzOffset,
  isPro: boolean = registeredIsPro,
  followedUserIds?: string[]
): void {
  warmDashboardLogsCaches(mediaTypes, followedUserIds);
  warmStatisticsCaches(mediaTypes, tzOffsetMinutes, isPro);
}

export async function loadWithSWR<T>(
  path: string,
  apply: (data: T) => void,
  options?: {
    setLoading?: (loading: boolean) => void;
    onError?: () => void;
    /** When false, do not show loading if cache is empty (keeps prior UI). */
    showLoadingOnMiss?: boolean;
  }
): Promise<void> {
  const cached = getCachedEntry<T>("GET", path);
  if (cached) {
    apply(cached.data);
    options?.setLoading?.(false);
  } else if (options?.showLoadingOnMiss !== false) {
    options?.setLoading?.(true);
  }

  try {
    const { data, fromCache } = await apiFetchSWR<T>(path, {
      ttlMs: HEAVY_PAGE_TTL_MS,
      onUpdate: (fresh) => apply(fresh as T),
    });
    if (!fromCache) apply(data);
  } catch {
    if (!cached) options?.onError?.();
  } finally {
    options?.setLoading?.(false);
  }
}

export function installLogsPageCacheListeners(): void {
  if (warmListenerInstalled || typeof window === "undefined") return;
  warmListenerInstalled = true;

  const onWarm = () => {
    warmDashboardAndStatisticsCaches(
      registeredMediaTypes,
      registeredTzOffset,
      registeredIsPro,
      registeredFollowedUserIds
    );
  };

  window.addEventListener(LOGS_CACHE_WARM_EVENT, onWarm);
}
