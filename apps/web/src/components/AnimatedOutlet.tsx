import { Suspense, lazy, useEffect, useState, type ComponentType } from "react";
import { useOutlet, useLocation } from "react-router-dom";
import { routeOutletClassName } from "@/lib/motionPolicy";
import { useAuth } from "@/contexts/AuthContext";
import { Dashboard } from "@/pages/Dashboard";
import { cn } from "@/lib/utils";

const CHUNK_RELOAD_ONCE_KEY = "geeklogs_chunk_reload_once";

const isChunkLoadError = (error: unknown): boolean => {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";
  const lower = message.toLowerCase();
  return (
    lower.includes("failed to fetch dynamically imported module") ||
    lower.includes("importing a module script failed") ||
    lower.includes("loading chunk")
  );
};

const lazyWithChunkRecovery = <T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>
) =>
  lazy(async () => {
    try {
      const mod = await importer();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(CHUNK_RELOAD_ONCE_KEY);
      }
      return mod;
    } catch (error) {
      if (
        typeof window !== "undefined" &&
        isChunkLoadError(error) &&
        sessionStorage.getItem(CHUNK_RELOAD_ONCE_KEY) !== "1"
      ) {
        sessionStorage.setItem(CHUNK_RELOAD_ONCE_KEY, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw error;
    }
  });

const Search = lazyWithChunkRecovery(() => import("@/pages/Search").then((m) => ({ default: m.Search })));
const Statistics = lazyWithChunkRecovery(() =>
  import("@/pages/Statistics").then((m) => ({ default: m.Statistics }))
);

const KEEP_ALIVE_CLASS = `${routeOutletClassName} flex min-w-0 w-full shrink-0 flex-col`;
/** Fill the scrollport (Search). Statistics/Dashboard must grow with content so widgets are not clipped. */
const KEEP_ALIVE_FILL_CLASS = `${KEEP_ALIVE_CLASS} min-h-0 flex-1`;

function KeptPane({
  active,
  fill,
  children,
}: {
  active: boolean;
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      hidden={!active}
      className={cn(fill ? KEEP_ALIVE_FILL_CLASS : KEEP_ALIVE_CLASS, !active && "hidden")}
      aria-hidden={!active}
    >
      <Suspense
        fallback={
          <div className="min-h-[28vh] animate-pulse rounded-xl bg-[var(--color-mid)]/10" aria-hidden />
        }
      >
        {children}
      </Suspense>
    </div>
  );
}

/**
 * Keep Search / Dashboard / Statistics mounted after first visit so returning to a tab
 * does not refetch browse rails or drop in-memory page state.
 */
export function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const { token } = useAuth();

  const isSearch = location.pathname === "/search";
  const isDashboard = location.pathname === "/dashboard";
  const isStatistics = location.pathname === "/statistics";
  const isKept = isSearch || isDashboard || isStatistics;
  const showGuardOutlet = (isDashboard || isStatistics) && !token;

  const [seenSearch, setSeenSearch] = useState(isSearch);
  const [seenDashboard, setSeenDashboard] = useState(isDashboard);
  const [seenStatistics, setSeenStatistics] = useState(isStatistics);

  useEffect(() => {
    if (isSearch) setSeenSearch(true);
    if (isDashboard && token) setSeenDashboard(true);
    if (isStatistics && token) setSeenStatistics(true);
  }, [isSearch, isDashboard, isStatistics, token]);

  useEffect(() => {
    if (!token) {
      setSeenDashboard(false);
      setSeenStatistics(false);
    }
  }, [token]);

  return (
    <>
      {seenSearch ? (
        <KeptPane active={isSearch} fill>
          <Search />
        </KeptPane>
      ) : null}
      {seenDashboard && token ? (
        <KeptPane active={isDashboard}>
          <Dashboard />
        </KeptPane>
      ) : null}
      {seenStatistics && token ? (
        <KeptPane active={isStatistics}>
          <Statistics />
        </KeptPane>
      ) : null}
      {isKept && !showGuardOutlet ? null : <div className={KEEP_ALIVE_CLASS}>{outlet}</div>}
    </>
  );
}
