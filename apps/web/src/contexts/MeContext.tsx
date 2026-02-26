import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

export interface MeResponse {
  user: { id: string; email: string; onboarded: boolean };
  theme: "light" | "dark";
  locale: "en" | "pt-BR" | "es";
  visibleMediaTypes: string[];
  boardGameProvider: "bgg" | "ludopedia";
  tier: "free" | "pro";
  logCount: number;
  apiKeys: { tmdb: boolean; rawg: boolean; bgg: boolean; ludopedia: boolean; comicvine: boolean };
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
      const data = await apiFetch<MeResponse>("/me");
      setMe(data);
    } catch {
      setMe(null);
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
