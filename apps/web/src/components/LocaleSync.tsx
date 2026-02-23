import { useEffect, useRef } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";

/** When user is logged in, apply their saved locale from /me. */
export function LocaleSync() {
  const { me } = useMe();
  const { setLocale } = useLocale();
  const applied = useRef(false);

  useEffect(() => {
    if (!me?.locale) {
      applied.current = false;
      return;
    }
    if (applied.current) return;
    applied.current = true;
    if (me.locale === "en" || me.locale === "pt-BR" || me.locale === "es") {
      setLocale(me.locale);
    }
  }, [me?.locale, setLocale]);

  return null;
}
