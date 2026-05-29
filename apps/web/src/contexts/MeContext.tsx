import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetchSWR, ApiError, invalidateApiCache } from "@/lib/api";
import type { ProfileVisibility } from "@geeklogs/shared";

export interface MeResponse {
  user: { id: string; username?: string; email: string; onboarded: boolean };
  theme: "light" | "dark";
  locale: "en" | "pt-BR" | "es";
  /** Monthly activity recap email (default on). */
  recapEmailsEnabled?: boolean;
  visibleMediaTypes: string[];
  profileVisibility?: ProfileVisibility;
  boardGameProvider: "bgg" | "ludopedia";
  tier: "free" | "beta" | "pro" | "admin";
  subscriptionEndsAt: string | null;
  /** True when the user is still Pro but Stripe is set to cancel at period end. */
  subscriptionCancelAtPeriodEnd?: boolean;
  /** Current Stripe subscription cadence. Used to default the interval toggle on /tiers. */
  subscriptionInterval?: "monthly" | "yearly" | null;
  daysRemaining: number | null; // Pro subscription days left (null if not pro or no end date)
  /** Where the current Pro subscription is billed (if applicable). */
  billingProvider?: "stripe" | "google_play" | null;
  /** Google Play base product id; use with Play Store subscription management URL. */
  googlePlayProductId?: string;
  country?: string; // ISO 3166-1 alpha-2 e.g. BR for pricing
  /** Last ISO 4217 currency used when saving a purchase amount (default for spend fields). */
  defaultPurchaseCurrency?: string;
  logCount: number;
  apiKeys: { tmdb: boolean; rawg: boolean; bgg: boolean; ludopedia: boolean; comicvine: boolean };
  /** App-wide flags from server (e.g. admin-toggled UX). */
  featureFlags?: { disableApiKeyRequirements: boolean };
  /** ISO time when the user may start the next board-game collection import (24h cooldown); null if allowed now. */
  boardGameCollectionImportNextAt?: string | null;
  announcements?: {
    betaBanner?: {
      enabled: boolean;
      message: string;
    };
  };
  onboardingSpotlightsDismissed?: string[];
}

interface MeContextValue {
  me: MeResponse | null;
  refetch: () => Promise<void>;
  loading: boolean;
}

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  const { token, initializing } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const wasLoadingRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetchSWR<MeResponse>("/me", {
        ttlMs: 30_000,
        skipAuthRedirect: true,
      });
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
    if (initializing) return;
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    refetch();
  }, [token, initializing, refetch]);

  /** Bust client GET cache for search so recommendations/search responses match latest /me feature flags. */
  useEffect(() => {
    if (!token) {
      wasLoadingRef.current = false;
      return;
    }
    if (wasLoadingRef.current && !loading) {
      invalidateApiCache("/search");
    }
    wasLoadingRef.current = loading;
  }, [token, loading]);

  const value: MeContextValue = { me, refetch, loading };

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used within MeProvider");
  return ctx;
}
