import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ColorScheme = "light" | "dark";

interface ThemeContextValue {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  resolvedColorScheme: ColorScheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "logeverything-theme";

function getInitialScheme(): ColorScheme {
  if (typeof document === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY) as ColorScheme | null;
  if (stored === "light" || stored === "dark") return stored;
  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(getInitialScheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", colorScheme);
    document.documentElement.classList.toggle("dark", colorScheme === "dark");
    localStorage.setItem(STORAGE_KEY, colorScheme);
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
