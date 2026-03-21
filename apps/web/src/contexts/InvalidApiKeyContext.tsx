import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useMe } from "@/contexts/MeContext";
import { isDisableApiKeyRequirements } from "@/lib/featureFlags";

type InvalidApiKeyContextValue = {
  invalidProviders: string[];
  addInvalidProvider: (provider: string) => void;
  clearInvalidKeys: () => void;
};

const InvalidApiKeyContext = createContext<InvalidApiKeyContextValue | null>(null);

export function InvalidApiKeyProvider({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  const [invalidProviders, setInvalidProviders] = useState<string[]>([]);

  const addInvalidProvider = useCallback((provider: string) => {
    setInvalidProviders((prev) =>
      prev.includes(provider) ? prev : [...prev, provider]
    );
  }, []);

  const clearInvalidKeys = useCallback(() => {
    setInvalidProviders([]);
  }, []);

  useEffect(() => {
    if (isDisableApiKeyRequirements(me)) setInvalidProviders([]);
  }, [me]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ provider: string }>) => {
      if (isDisableApiKeyRequirements(me)) return;
      if (e.detail?.provider) addInvalidProvider(e.detail.provider);
    };
    window.addEventListener("api:invalid-key", handler as EventListener);
    return () =>
      window.removeEventListener("api:invalid-key", handler as EventListener);
  }, [addInvalidProvider, me]);

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
