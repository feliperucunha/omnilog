import { motion } from "framer-motion";
import { Heart, Coffee, Github } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const paperShadow = { boxShadow: "var(--shadow-sm)" };

const DONATION_LINKS = [
  {
    key: "kofi",
    envKey: "VITE_DONATION_KOFI_URL",
    icon: Heart,
    labelKey: "about.donateKofi",
  },
  {
    key: "buymeacoffee",
    envKey: "VITE_DONATION_BUYMEACOFFEE_URL",
    icon: Coffee,
    labelKey: "about.donateBuyMeACoffee",
  },
  {
    key: "github",
    envKey: "VITE_DONATION_GITHUB_SPONSORS_URL",
    icon: Github,
    labelKey: "about.donateGitHub",
  },
] as const;

export function About() {
  const { t } = useLocale();

  const donationButtons = DONATION_LINKS.filter((link) => {
    const url = import.meta.env[link.envKey] as string | undefined;
    return url != null && String(url).trim() !== "";
  }).map((link) => ({
    ...link,
    url: String(import.meta.env[link.envKey]).trim(),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex flex-col gap-8 max-w-2xl"
    >
      <h1 className="text-2xl font-bold text-[var(--color-lightest)]">
        {t("about.title")}
      </h1>

      <Card
        className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6"
        style={paperShadow}
      >
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-lightest)]">
          {t("about.projectTitle")}
        </h2>
        <p className="whitespace-pre-wrap text-[var(--color-light)]">
          {t("about.projectBody")}
        </p>
      </Card>

      <Card
        className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6"
        style={paperShadow}
      >
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-lightest)]">
          {t("about.aboutMeTitle")}
        </h2>
        <p className="whitespace-pre-wrap text-[var(--color-light)]">
          {t("about.aboutMeBody")}
        </p>
      </Card>

      <Card
        className="border-[var(--color-dark)] bg-[var(--color-dark)] p-6"
        style={paperShadow}
      >
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-lightest)]">
          {t("about.donationTitle")}
        </h2>
        <p className="mb-4 text-[var(--color-light)]">
          {t("about.donationIntro")}
        </p>
        {donationButtons.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {donationButtons.map((link) => {
              const Icon = link.icon;
              return (
                <Button
                  key={link.key}
                  asChild
                  className="bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    <Icon size={18} />
                    {t(link.labelKey)}
                  </a>
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-mid)] italic">
            {t("about.donationNotConfigured")}
          </p>
        )}
      </Card>
    </motion.div>
  );
}
