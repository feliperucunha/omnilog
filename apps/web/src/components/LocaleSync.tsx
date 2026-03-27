import { useEffect } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";

/** When /me loads or updates, apply saved locale from the server (cross-device sync). */
export function LocaleSync() {
  const { me } = useMe();
  const { setLocale } = useLocale();

  useEffect(() => {
    if (!me?.user?.id || !me.locale) return;
    if (me.locale === "en" || me.locale === "pt-BR" || me.locale === "es") {
      setLocale(me.locale);
    }
  }, [me?.user?.id, me?.locale, setLocale]);

  return null;
}
