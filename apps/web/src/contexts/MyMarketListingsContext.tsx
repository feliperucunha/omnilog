import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetchSWR, invalidateApiCache } from "@/lib/api";
import type { MyMarketListedLogIdsResponse } from "@geeklogs/shared";

type MyMarketListingsContextValue = {
  listedLogIds: readonly string[];
  ready: boolean;
  isListed: (logId: string) => boolean;
  markListed: (logId: string) => void;
  markUnlisted: (logId: string) => void;
  refetch: () => Promise<void>;
};

const MyMarketListingsContext = createContext<MyMarketListingsContextValue | null>(null);

export function MyMarketListingsProvider({ children }: { children: ReactNode }) {
  const { token, initializing } = useAuth();
  const [listedLogIds, setListedLogIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const refetch = useCallback(async () => {
    if (!token) {
      setListedLogIds([]);
      setReady(true);
      return;
    }
    try {
      const { data } = await apiFetchSWR<MyMarketListedLogIdsResponse>("/market/my/log-ids", {
        ttlMs: 60_000,
        skipAuthRedirect: true,
      });
      setListedLogIds(data.data);
    } catch {
      setListedLogIds([]);
    } finally {
      setReady(true);
    }
  }, [token]);

  useEffect(() => {
    if (initializing) return;
    if (!token) {
      setListedLogIds([]);
      setReady(true);
      return;
    }
    setReady(false);
    void refetch();
  }, [token, initializing, refetch]);

  const markListed = useCallback((logId: string) => {
    setListedLogIds((prev) => (prev.includes(logId) ? prev : [...prev, logId]));
    invalidateApiCache("/market/my/log-ids");
  }, []);

  const markUnlisted = useCallback((logId: string) => {
    setListedLogIds((prev) => prev.filter((id) => id !== logId));
    invalidateApiCache("/market/my/log-ids");
  }, []);

  const isListed = useCallback(
    (logId: string) => listedLogIds.includes(logId),
    [listedLogIds]
  );

  const value = useMemo(
    () => ({ listedLogIds, ready, isListed, markListed, markUnlisted, refetch }),
    [listedLogIds, ready, isListed, markListed, markUnlisted, refetch]
  );

  return (
    <MyMarketListingsContext.Provider value={value}>{children}</MyMarketListingsContext.Provider>
  );
}

export function useMyMarketListings(): MyMarketListingsContextValue {
  const ctx = useContext(MyMarketListingsContext);
  if (!ctx) {
    throw new Error("useMyMarketListings must be used within MyMarketListingsProvider");
  }
  return ctx;
}
