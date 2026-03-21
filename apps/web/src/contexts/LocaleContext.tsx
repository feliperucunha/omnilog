import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "@/locales/en.json";
import ptBR from "@/locales/pt-BR.json";
import es from "@/locales/es.json";
import * as storage from "@/lib/storage";

export type Locale = "en" | "pt-BR" | "es";

const messages: Record<Locale, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  "pt-BR": ptBR as Record<string, unknown>,
  es: es as Record<string, unknown>,
};

const STORAGE_KEY = "geeklogs-locale";
const VALID_LOCALES: Locale[] = ["en", "pt-BR", "es"];

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(str: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value),
    str
  );
}

export type TFunction = (key: string, params?: Record<string, string>) => string;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  /** Load locale from persistent storage (works on Android/Capacitor). */
  useEffect(() => {
    let cancelled = false;
    storage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored && VALID_LOCALES.includes(stored as Locale)) setLocaleState(stored as Locale);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "pt-BR" ? "pt-BR" : locale;
    void storage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback<TFunction>(
    (key, params) => {
      const str = getNested(messages[locale], key);
      const fallback = getNested(messages.en as Record<string, unknown>, key);
      const value = str ?? fallback ?? key;
      return params ? interpolate(value, params) : value;
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "es", label: "Español" },
];
