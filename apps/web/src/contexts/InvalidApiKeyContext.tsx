import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { skipApiKeyMissingUi } from "@/lib/featureFlags";

type InvalidApiKeyContextValue = {
  invalidProviders: string[];
  addInvalidProvider: (provider: string) => void;
  clearInvalidKeys: () => void;
};

const InvalidApiKeyContext = createContext<InvalidApiKeyContextValue | null>(null);

export function InvalidApiKeyProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { me, loading: meLoading } = useMe();
  const [invalidProviders, setInvalidProviders] = useState<string[]>([]);
  const skipInvalidKeyUi = skipApiKeyMissingUi(me, { token: !!token, meLoading });

  const addInvalidProvider = useCallback((provider: string) => {
    setInvalidProviders((prev) =>
      prev.includes(provider) ? prev : [...prev, provider]
    );
  }, []);

  const clearInvalidKeys = useCallback(() => {
    setInvalidProviders([]);
  }, []);

  useEffect(() => {
    if (skipInvalidKeyUi) setInvalidProviders([]);
  }, [skipInvalidKeyUi]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ provider: string }>) => {
      if (skipApiKeyMissingUi(me, { token: !!token, meLoading })) return;
      if (e.detail?.provider) addInvalidProvider(e.detail.provider);
    };
    window.addEventListener("api:invalid-key", handler as EventListener);
    return () =>
      window.removeEventListener("api:invalid-key", handler as EventListener);
  }, [addInvalidProvider, me, meLoading, token]);

  return (
    <InvalidApiKeyContext.Provider
      value={{ invalidProviders, addInvalidProvider, clearInvalidKeys }}
    >
      {children}
    </InvalidApiKeyContext.Provider>
  );
}

export function useInvalidApiKey(): InvalidApiKeyContextValue {
  const ctx = useContext(InvalidApiKeyContext);
  if (!ctx) {
    throw new Error("useInvalidApiKey must be used within InvalidApiKeyProvider");
  }
  return ctx;
}
