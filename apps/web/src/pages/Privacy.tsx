import { useEffect, useMemo } from "react";
import { useSupportEmail } from "@/hooks/useSupportEmail";
import { motion } from "framer-motion";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";

const PRIVACY_SECTION_KEYS = [
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
  "S9",
  "S10",
] as const;

export function Privacy() {
  const { t, locale } = useLocale();
  const { setPageTitle } = usePageTitle() ?? {};
  const supportEmail = useSupportEmail();
  const params = useMemo(() => ({ email: supportEmail }), [supportEmail]);

  useEffect(() => {
    setPageTitle?.(t("legal.privacyTitle"));
    return () => setPageTitle?.(null);
  }, [t, setPageTitle]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-2xl space-y-8 text-sm leading-relaxed text-[var(--color-light)]"
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--color-lightest)]">{t("legal.privacyTitle")}</h1>
        <p className="text-xs text-[var(--color-light)]">{t("legal.privacyLastUpdated", params)}</p>
      </header>

      {locale !== "en" && t("legal.privacyLocaleNote", params).trim() !== "" && (
        <p className="whitespace-pre-wrap rounded-lg border border-[var(--color-mid)]/40 bg-[var(--color-darkest)]/40 p-3 text-xs text-[var(--color-light)]">
          {t("legal.privacyLocaleNote", params)}
        </p>
      )}

      {PRIVACY_SECTION_KEYS.map((id) => (
        <section key={id} className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--color-lightest)]">
            {t(`legal.privacy${id}Title`)}
          </h2>
          <p className="whitespace-pre-wrap">{t(`legal.privacy${id}Body`, params)}</p>
        </section>
      ))}
    </motion.article>
  );
}
