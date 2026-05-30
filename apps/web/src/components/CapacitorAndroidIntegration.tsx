import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { consumeAndroidOverlayBack } from "@/lib/androidOverlayBack";
import { appUrlToInternalPath } from "@/lib/deepLink";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { warmDashboardAndStatisticsCaches } from "@/lib/logsPageCache";
import { useMe } from "@/contexts/MeContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { tierHasProFeatures } from "@/lib/userTier";

/**
 * Native shell integration: Android back, deep links, resume refresh, external links, keyboard resize.
 * iOS: back is a no-op; other listeners run where supported.
 */
export function CapacitorAndroidIntegration() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    document.documentElement.classList.add("capacitor-native");
    return () => document.documentElement.classList.remove("capacitor-native");
  }, []);

  const navigate = useNavigate();
  const { refetch: refetchMe, me } = useMe();
  const { visibleTypes } = useVisibleMediaTypes();
  const isPro = tierHasProFeatures(me?.tier);

  /** iOS: programmatic resize mode (Android uses `Keyboard.resizeOnFullScreen` in capacitor.config). */
  useEffect(() => {
    if (Capacitor.getPlatform() !== "ios") return;
    void (async () => {
      const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
      await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
    })();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    let cancelled = false;
    let handle: { remove: () => Promise<void> } | undefined;

    void (async () => {
      const { App } = await import("@capacitor/app");
      const h = await App.addListener("backButton", ({ canGoBack }) => {
        if (consumeAndroidOverlayBack()) {
          return;
        }
        if (canGoBack) {
          navigate(-1);
          return;
        }
        void App.exitApp();
      });
      if (cancelled) {
        await h.remove();
        return;
      }
      handle = h;
    })();

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let handle: { remove: () => Promise<void> } | undefined;

    void (async () => {
      const { App } = await import("@capacitor/app");
      const h = await App.addListener("appUrlOpen", ({ url }) => {
        if (!url) return;
        const path = appUrlToInternalPath(url);
        if (path) {
          navigate(path);
        }
      });
      if (cancelled) {
        await h.remove();
        return;
      }
      handle = h;
    })();

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let handle: { remove: () => Promise<void> } | undefined;

    void (async () => {
      const { App } = await import("@capacitor/app");
      const h = await App.addListener("resume", () => {
        void refetchMe();
        if (visibleTypes.length > 0) {
          warmDashboardAndStatisticsCaches(visibleTypes, -new Date().getTimezoneOffset(), isPro);
        }
      });
      if (cancelled) {
        await h.remove();
        return;
      }
      handle = h;
    })();

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [refetchMe, visibleTypes, isPro]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const webOrigin = import.meta.env.VITE_APP_WEB_ORIGIN as string | undefined;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("//")) {
        e.preventDefault();
        void openExternalUrl(`https:${href}`);
        return;
      }
      if (href.startsWith("/") && !href.startsWith("//")) return;

      let u: URL;
      try {
        u = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (u.protocol === "mailto:" || u.protocol === "tel:") return;

      const sameDocument =
        u.origin === window.location.origin ||
        (window.location.protocol === "file:" && href.startsWith("#"));

      if (sameDocument && u.pathname.startsWith(window.location.pathname) && href.includes("#")) {
        return;
      }

      if (webOrigin) {
        try {
          const expected = new URL(webOrigin);
          if (u.protocol === "https:" && u.host === expected.host) {
            e.preventDefault();
            navigate(`${u.pathname}${u.search}${u.hash}`);
            return;
          }
        } catch {
          /* ignore */
        }
      }

      if (u.origin === window.location.origin) return;

      e.preventDefault();
      void openExternalUrl(href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [navigate]);

  return null;
}
