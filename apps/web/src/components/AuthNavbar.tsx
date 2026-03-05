import { Link } from "react-router-dom";
import { useLocale } from "@/contexts/LocaleContext";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LOCALE_OPTIONS, type Locale } from "@/contexts/LocaleContext";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  "pt-BR": "PT",
  es: "ES",
};

export function AuthNavbar() {
  const { t, locale, setLocale } = useLocale();

  return (
    <header
      className={cn(
        "flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-[var(--color-mid)]/30 bg-[var(--color-dark)] px-4"
      )}
    >
      <Link
        to="/"
        className="flex min-w-0 items-center focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)] rounded"
        aria-label={t("nav.dashboard")}
      >
        <Logo alt="" className="h-9 w-auto flex-shrink-0" />
        <span className="-ml-3 text-lg font-bold text-(--btn-gradient-end) dark:text-(--btn-gradient-start) sm:-ml-4 sm:text-xl">
          OMNILOG
        </span>
      </Link>
      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        <ThemeSwitcher />
        <div className="flex items-center gap-1 rounded-md border border-[var(--color-mid)]/30 p-0.5">
          <ToggleGroup
            type="single"
            value={locale}
            onValueChange={(v) => v && setLocale(v as Locale)}
            className="gap-0"
            aria-label={t("settings.language")}
          >
            {LOCALE_OPTIONS.map((opt) => (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                className="h-8 px-2 text-xs data-[state=on]:bg-[var(--color-mid)]/50"
                aria-label={opt.label}
              >
                {LOCALE_SHORT_LABELS[opt.value]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </header>
  );
}
