import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User } from "lucide-react";
import type { Log, MediaType } from "@geeklogs/shared";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { apiFetchSWR, getCachedEntry, HEAVY_PAGE_TTL_MS } from "@/lib/api";
import { buildFeedPath, FOLLOWS_PATH, loadWithSWR } from "@/lib/logsPageCache";
import { isCompletedStatus } from "@/lib/logStatusColors";
import { getLogCardDisplay } from "@/lib/logDisplay";
import { itemDetailPath } from "@/lib/itemRoutes";

type FeedEntry = {
  log: Log;
  user: { id: string; username: string | null };
};

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function timeAgo(createdAt: string, t: (key: string, vars?: Record<string, string>) => string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  if (diff < 60_000) return t("social.timeAgoJustNow");
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return t("social.timeAgoMinutes", { count: String(mins) });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("social.timeAgoHours", { count: String(hrs) });
  return t("social.timeAgoDays", { count: String(Math.floor(hrs / 24)) });
}

/** Friend feed used on Activity. The library keeps its own copy on desktop. */
export function FriendActivity() {
  const { t } = useLocale();
  const { token } = useAuth();
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendId, setFriendId] = useState("all");
  const [friends, setFriends] = useState<Array<{ id: string; username: string | null }>>([]);

  const load = useCallback(() => {
    if (!token) {
      setFeed([]);
      setLoading(false);
      return;
    }
    const path = friendId === "all" ? buildFeedPath() : buildFeedPath(friendId);
    const cached = getCachedEntry<{ data: FeedEntry[] }>("GET", path);
    if (cached) {
      setFeed(cached.data.data ?? []);
      setLoading(false);
    }
    void apiFetchSWR<{ data: FeedEntry[] }>(path, { ttlMs: HEAVY_PAGE_TTL_MS })
      .then(({ data }) => setFeed(data.data ?? []))
      .catch(() => {
        if (!cached) setFeed([]);
      })
      .finally(() => setLoading(false));
  }, [friendId, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    void loadWithSWR<{ data: Array<{ id: string; username: string | null }> }>(FOLLOWS_PATH, (res) => {
      setFriends(res.data ?? []);
    });
  }, [token]);

  const weekCount = feed.filter((entry) => Date.now() - new Date(entry.log.createdAt).getTime() < ONE_WEEK_MS).length;

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={t("discover.friends")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--color-lightest)]">{t("discover.friends")}</h2>
        <span className="rounded-full border border-[var(--color-surface-border)] px-2 py-0.5 text-xs text-[var(--color-light)]">
          {t("social.newEntriesLastWeek", { count: String(weekCount) })}
        </span>
      </div>
      {friends.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            aria-pressed={friendId === "all"}
            onClick={() => setFriendId("all")}
            className="shrink-0 rounded-full border border-[var(--color-surface-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-lightest)]"
          >
            {t("social.filterAll")}
          </button>
          {friends.map((friend) => (
            <button
              key={friend.id}
              type="button"
              aria-pressed={friendId === friend.id}
              onClick={() => setFriendId(friend.id)}
              className="shrink-0 rounded-full border border-[var(--color-surface-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-lightest)]"
            >
              {friend.username ?? friend.id}
            </button>
          ))}
        </div>
      )}
      {loading && feed.length === 0 ? (
        <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4">
          <p className="text-sm text-[var(--color-light)]">{t("common.loading")}</p>
        </Card>
      ) : feed.length === 0 ? (
        <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4">
          <p className="text-sm text-[var(--color-light)]">{t("social.emptyFeed")}</p>
        </Card>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {feed.map(({ log, user }) => {
            const display = getLogCardDisplay(log);
            const verb =
              display.grade != null
                ? t("social.ratedEntry")
                : isCompletedStatus(log.status)
                  ? t("social.finishedEntry")
                  : t("social.loggedEntry");
            const profile = `/${user.username ?? user.id}?category=${log.mediaType as MediaType}`;
            return (
              <li key={log.id}>
                <div className="flex items-center gap-2 rounded-[14px] border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-3">
                  <Link
                    to={profile}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--btn-gradient-start)_18%,transparent)] text-[var(--btn-gradient-start)]"
                    aria-label={user.username ?? t("social.userWithoutUsername")}
                  >
                    <User className="size-4" aria-hidden />
                  </Link>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--color-lightest)]">
                      <Link to={profile} className="font-semibold text-[var(--btn-gradient-start)] no-underline">
                        @{user.username ?? t("social.userWithoutUsername")}
                      </Link>{" "}
                      {verb}{" "}
                      <Link
                        to={itemDetailPath(log.mediaType, log.externalId)}
                        className="font-semibold text-[var(--color-lightest)] no-underline"
                      >
                        {log.title}
                      </Link>
                    </p>
                    <p className="text-xs text-[var(--color-light)]">
                      {t(`nav.${log.mediaType}`)} · {timeAgo(log.createdAt, t)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
