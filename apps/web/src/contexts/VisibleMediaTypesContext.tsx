import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { MEDIA_TYPES, type MediaType } from "@geeklogs/shared";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { tierHasProFeatures } from "@/lib/userTier";
import {
  registerLogsPageCacheContext,
  warmDashboardAndStatisticsCaches,
} from "@/lib/logsPageCache";

const STORAGE_KEY = (userId: string) => `geeklogs.visibleMediaTypes.v1:${userId}`;

function readCachedVisibleTypes(userId: string): MediaType[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const out = parsed.filter(
      (t): t is MediaType => typeof t === "string" && MEDIA_TYPES.includes(t as MediaType)
    );
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function writeCachedVisibleTypes(userId: string, types: MediaType[]): void {
  try {
    localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(types));
  } catch {
    // ignore quota / private mode
  }
}

interface VisibleMediaTypesContextValue {
  visibleTypes: MediaType[];
  /** False only for logged-in users before we have server list or a cached order — avoids category strip jumping from default order. */
  visibleTypesOrderReady: boolean;
  refetch: () => Promise<void>;
  loading: boolean;
}

const VisibleMediaTypesContext = createContext<VisibleMediaTypesContextValue | null>(null);

export function VisibleMediaTypesProvider({ children }: { children: ReactNode }) {
  const { token, user: authUser } = useAuth();
  const { me, refetch, loading } = useMe();

  const { visibleTypes, visibleTypesOrderReady } = useMemo(() => {
    if (!token) {
      return { visibleTypes: [...MEDIA_TYPES] as MediaType[], visibleTypesOrderReady: true };
    }
    if (me?.visibleMediaTypes?.length) {
      const filtered = (me.visibleMediaTypes as MediaType[]).filter((t) => MEDIA_TYPES.includes(t));
      const types = filtered.length > 0 ? filtered : ([...MEDIA_TYPES] as MediaType[]);
      return { visibleTypes: types, visibleTypesOrderReady: true };
    }
    const userId = me?.user?.id ?? authUser?.id;
    if (userId) {
      const cached = readCachedVisibleTypes(userId);
      if (cached) {
        return { visibleTypes: cached, visibleTypesOrderReady: true };
      }
    }
    return {
      visibleTypes: [...MEDIA_TYPES] as MediaType[],
      visibleTypesOrderReady: false,
    };
  }, [token, me?.user?.id, me?.visibleMediaTypes, authUser?.id]);

  useEffect(() => {
    if (!token || !me?.user?.id || !me.visibleMediaTypes?.length) return;
    const filtered = (me.visibleMediaTypes as MediaType[]).filter((t) => MEDIA_TYPES.includes(t));
    if (filtered.length === 0) return;
    writeCachedVisibleTypes(me.user.id, filtered);
  }, [token, me?.user?.id, me?.visibleMediaTypes]);

  useEffect(() => {
    if (!visibleTypesOrderReady || visibleTypes.length === 0) return;
    const tz = -new Date().getTimezoneOffset();
    const isPro = tierHasProFeatures(me?.tier);
    registerLogsPageCacheContext({ mediaTypes: visibleTypes, tzOffsetMinutes: tz, isPro });
    warmDashboardAndStatisticsCaches(visibleTypes, tz, isPro);
  }, [visibleTypes, visibleTypesOrderReady, me?.tier]);

  const value = useMemo(
    () => ({
      visibleTypes,
      visibleTypesOrderReady,
      refetch,
      loading,
    }),
    [visibleTypes, visibleTypesOrderReady, refetch, loading]
  );

  return (
    <VisibleMediaTypesContext.Provider value={value}>{children}</VisibleMediaTypesContext.Provider>
  );
}

export function useVisibleMediaTypes(): VisibleMediaTypesContextValue {
  const ctx = useContext(VisibleMediaTypesContext);
  if (!ctx) throw new Error("useVisibleMediaTypes must be used within VisibleMediaTypesProvider");
  return ctx;
}
