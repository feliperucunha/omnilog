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
import {
  readDismissedUpdateVersion,
  writeDismissedUpdateVersion,
} from "@/lib/updatePromptStorage";

interface AppVersionContextValue {
  showVersionModal: boolean;
  setShowVersionModal: (show: boolean) => void;
  isNative: boolean;
  latestVersion: string | null;
  dismissUpdatePrompt: () => void;
}

const AppVersionContext = createContext<AppVersionContextValue | null>(null);

export function AppVersionProvider({ children }: { children: ReactNode }) {
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const applyHealthPayload = useCallback((data: { version?: string }) => {
    const serverVersion = data.version?.trim();
    if (!serverVersion) return;
    if (!isAppVersionOlder(APP_VERSION, serverVersion)) {
      setLatestVersion(null);
      setShowVersionModal(false);
      return;
    }
    setLatestVersion(serverVersion);
    const dismissed = readDismissedUpdateVersion();
    if (dismissed === serverVersion) {
      setShowVersionModal(false);
      return;
    }
    setShowVersionModal(true);
  }, []);

  const checkVersion = useCallback(async () => {
    if (!isNative) return;
    try {
      const res = await fetch(`${getApiBase()}/health`, { credentials: "omit" });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      applyHealthPayload(data);
    } catch {
      /* optional prompt only */
    }
  }, [isNative, applyHealthPayload]);

  const dismissUpdatePrompt = useCallback(() => {
    if (latestVersion) writeDismissedUpdateVersion(latestVersion);
    setShowVersionModal(false);
  }, [latestVersion]);

  useEffect(() => {
    if (!isNative) return;

    const handleCheckRequest = () => {
      void checkVersion();
    };

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
      window.removeEventListener("app:check-version", handleCheckRequest);
      void resumeHandle?.remove();
    };
  }, [isNative, checkVersion]);

  return (
    <AppVersionContext.Provider
      value={{
        showVersionModal,
        setShowVersionModal,
        isNative,
        latestVersion,
        dismissUpdatePrompt,
      }}
    >
      {children}
    </AppVersionContext.Provider>
  );
}

export function useAppVersion(): AppVersionContextValue | null {
  return useContext(AppVersionContext);
}
