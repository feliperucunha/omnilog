import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Capacitor } from "@capacitor/core";
import * as storage from "@/lib/storage";

type ColorScheme = "light" | "dark";

interface ThemeContextValue {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  resolvedColorScheme: ColorScheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "geeklogs-theme";

function getDefaultScheme(): ColorScheme {
  if (typeof document === "undefined") return "dark";
  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(getDefaultScheme);

  /** Load theme from persistent storage (works on Android/Capacitor). */
  useEffect(() => {
    let cancelled = false;
    storage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored === "light" || stored === "dark") setColorSchemeState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", colorScheme);
    document.documentElement.classList.toggle("dark", colorScheme === "dark");
    void storage.setItem(STORAGE_KEY, colorScheme);
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) link.href = colorScheme === "dark" ? "/logo-dark.png" : "/logo.png";
  }, [colorScheme]);

  /** Match system status bar to app chrome on native (edge-to-edge / contrast). */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    void (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        if (cancelled) return;
        await StatusBar.setStyle({
          style: colorScheme === "dark" ? Style.Dark : Style.Light,
        });
        await StatusBar.setBackgroundColor({
          color: colorScheme === "dark" ? "#0b1220" : "#f8fafc",
        });
      } catch {
        /* simulator / permission */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [colorScheme]);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
  }, []);

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
      resolvedColorScheme: colorScheme,
    }),
    [colorScheme, setColorScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
