import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";

export interface MeResponse {
  user: { id: string; username?: string; email: string; onboarded: boolean };
  theme: "light" | "dark";
  locale: "en" | "pt-BR" | "es";
  visibleMediaTypes: string[];
  boardGameProvider: "bgg" | "ludopedia";
  tier: "free" | "pro" | "admin";
  subscriptionEndsAt: string | null;
  daysRemaining: number | null; // Pro subscription days left (null if not pro or no end date)
  country?: string; // ISO 3166-1 alpha-2 e.g. BR for pricing
  logCount: number;
  apiKeys: { tmdb: boolean; rawg: boolean; bgg: boolean; ludopedia: boolean; comicvine: boolean };
  /** App-wide flags from server (e.g. admin-toggled UX). */
  featureFlags?: { disableApiKeyRequirements: boolean };
}

interface MeContextValue {
  me: MeResponse | null;
  refetch: () => Promise<void>;
  loading: boolean;
}

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<MeResponse>("/me", { skipAuthRedirect: true });
      setMe(data);
    } catch (e) {
      setMe(null);
      // Only clear session on 401 (expired/invalid). Timeout or network error should not log the user out.
      if (e instanceof ApiError && e.statusCode === 401) {
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    refetch();
  }, [token, refetch]);

  const value: MeContextValue = { me, refetch, loading };

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used within MeProvider");
  return ctx;
}
