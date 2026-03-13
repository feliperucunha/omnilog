import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { LogCompleteModal } from "@/components/LogCompleteModal";
import * as storage from "@/lib/storage";

export const SHOW_COMPLETE_MODAL_STORAGE_KEY = "dogument-showCompleteModal";

export function getShowCompleteModal(): boolean {
  const stored = storage.getItemSync(SHOW_COMPLETE_MODAL_STORAGE_KEY);
  return stored !== "false";
}

interface LogCompleteContextValue {
  showLogComplete: (state: LogCompleteState) => void;
  closeLogComplete: () => void;
}

const LogCompleteContext = createContext<LogCompleteContextValue | null>(null);

export function useLogComplete(): LogCompleteContextValue {
  const ctx = useContext(LogCompleteContext);
  if (!ctx) throw new Error("useLogComplete must be used within LogCompleteProvider");
  return ctx;
}

export function LogCompleteProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LogCompleteState | null>(null);

  /** Preload so getItemSync returns correct value (Android/Capacitor). */
  useEffect(() => {
    void storage.getItem(SHOW_COMPLETE_MODAL_STORAGE_KEY);
  }, []);

  const showLogComplete = useCallback((s: LogCompleteState) => {
    if (!getShowCompleteModal()) return;
    setState(s);
  }, []);
  const closeLogComplete = useCallback(() => setState(null), []);

  return (
    <LogCompleteContext.Provider value={{ showLogComplete, closeLogComplete }}>
      {children}
      {state != null && (
        <LogCompleteModal state={state} onClose={closeLogComplete} />
      )}
    </LogCompleteContext.Provider>
  );
}
