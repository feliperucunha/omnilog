import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Capacitor } from "@capacitor/core";
import { APP_VERSION, isAppVersionOlder } from "@geeklogs/shared";
import { getApiBase } from "@/lib/api";

interface AppVersionContextValue {
  showVersionModal: boolean;
  setShowVersionModal: (show: boolean) => void;
  isNative: boolean;
  requiredVersion: string | null;
}

const AppVersionContext = createContext<AppVersionContextValue | null>(null);

export function AppVersionProvider({ children }: { children: ReactNode }) {
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [requiredVersion, setRequiredVersion] = useState<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const applyHealthPayload = useCallback(
    (data: { version?: string; ignoreClientVersionCheck?: boolean }) => {
      if (data.ignoreClientVersionCheck === true) {
        setShowVersionModal(false);
        setRequiredVersion(null);
        return;
      }
      const serverVersion = data.version?.trim();
      if (!serverVersion) return;
      if (isAppVersionOlder(APP_VERSION, serverVersion)) {
        setRequiredVersion(serverVersion);
        setShowVersionModal(true);
      } else {
        setShowVersionModal(false);
        setRequiredVersion(null);
      }
    },
    []
  );

  const checkVersion = useCallback(async () => {
    if (!isNative) return;
    try {
      const res = await fetch(`${getApiBase()}/health`, { credentials: "omit" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        version?: string;
        ignoreClientVersionCheck?: boolean;
      };
      applyHealthPayload(data);
    } catch {
      /* ignore; 401 APP_VERSION_MISMATCH will open the gate */
    }
  }, [isNative, applyHealthPayload]);

  useEffect(() => {
    if (!isNative) return;

    const handleMismatch = (event: Event) => {
      const detail = (event as CustomEvent<{ requiredVersion?: string }>).detail;
      if (detail?.requiredVersion) {
        setRequiredVersion(detail.requiredVersion);
      }
      setShowVersionModal(true);
      void checkVersion();
    };

    const handleCheckRequest = () => {
      void checkVersion();
    };

    window.addEventListener("app:version-mismatch", handleMismatch);
    window.addEventListener("app:check-version", handleCheckRequest);
    void checkVersion();

    let resumeHandle: { remove: () => Promise<void> } | undefined;
    let cancelled = false;

    void (async () => {
      const { App } = await import("@capacitor/app");
      const h = await App.addListener("resume", () => {
        void checkVersion();
      });
      if (cancelled) {
        await h.remove();
        return;
      }
      resumeHandle = h;
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("app:version-mismatch", handleMismatch);
      window.removeEventListener("app:check-version", handleCheckRequest);
      void resumeHandle?.remove();
    };
  }, [isNative, checkVersion]);

  return (
    <AppVersionContext.Provider
      value={{ showVersionModal, setShowVersionModal, isNative, requiredVersion }}
    >
      {children}
    </AppVersionContext.Provider>
  );
}

export function useAppVersion(): AppVersionContextValue | null {
  return useContext(AppVersionContext);
}
