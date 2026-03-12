import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { APP_VERSION } from "@dogument/shared";
import { getApiBase } from "@/lib/api";

function isNativePlatform(): boolean {
  const w = typeof window !== "undefined" ? (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }) : null;
  return Boolean(w?.Capacitor?.isNativePlatform?.());
}

interface AppVersionContextValue {
  showVersionModal: boolean;
  setShowVersionModal: (show: boolean) => void;
  isMobile: boolean;
}

const AppVersionContext = createContext<AppVersionContextValue | null>(null);

export function AppVersionProvider({ children }: { children: ReactNode }) {
  const [showVersionModal, setShowVersionModal] = useState(false);
  const isMobile = isNativePlatform();

  const checkVersion = useCallback(async () => {
    if (!isMobile) return;
    try {
      const res = await fetch(`${getApiBase()}/health`, { credentials: "omit" });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (data.version != null && data.version !== APP_VERSION) {
        setShowVersionModal(true);
      }
    } catch {
      /* ignore; will show on first 401 if mismatch */
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    const handleMismatch = () => setShowVersionModal(true);
    window.addEventListener("app:version-mismatch", handleMismatch);
    void checkVersion();
    return () => window.removeEventListener("app:version-mismatch", handleMismatch);
  }, [isMobile, checkVersion]);

  return (
    <AppVersionContext.Provider
      value={{ showVersionModal, setShowVersionModal, isMobile }}
    >
      {children}
    </AppVersionContext.Provider>
  );
}

export function useAppVersion(): AppVersionContextValue | null {
  return useContext(AppVersionContext);
}
