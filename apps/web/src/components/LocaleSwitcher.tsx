import { useLocale, LOCALE_OPTIONS, type Locale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

/** Renders locale options as dropdown menu items (use inside a DropdownMenuContent). */
export function LocaleSwitcherItems() {
  const { locale, setLocale } = useLocale();
  const { token } = useAuth();

  const handleSelect = (newLocale: Locale) => {
    setLocale(newLocale);
    if (token) {
      apiFetch("/settings/locale", {
        method: "PUT",
        body: JSON.stringify({ locale: newLocale }),
      }).catch(() => {});
    }
  };

  return (
    <>
      {LOCALE_OPTIONS.map((opt) => (
        <DropdownMenuItem
          key={opt.value}
          onClick={() => handleSelect(opt.value)}
          className={locale === opt.value ? "bg-[var(--color-mid)]/30" : ""}
        >
          {opt.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}
