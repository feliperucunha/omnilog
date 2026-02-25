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

const TEAM_MEMBERS = [
  { roleKey: "about.teamRoleCEO", nameKey: "about.teamNameCEO" },
  { roleKey: "about.teamRoleDeveloper", nameKey: "about.teamNameDeveloper" },
  { roleKey: "about.teamRoleDesigner", nameKey: "about.teamNameDesigner" },
] as const;

function TeamCardPlaceholder() {
  return (
    <div
      className="w-full aspect-square bg-[var(--color-mid)] rounded-t-lg flex items-center justify-center text-[var(--color-dark)] text-4xl"
      aria-hidden
    >
      ?
    </div>
  );
}

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
      className="flex flex-col gap-8 w-full"
    >
      <h1 className="text-xl font-bold text-[var(--color-lightest)] sm:text-2xl">
        {t("about.title")}
      </h1>

      {/* Team */}
      <section className="w-full">
        <h2 className="mb-3 sm:mb-4 text-base font-semibold text-[var(--color-lightest)] sm:text-lg">
          {t("about.teamTitle")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {TEAM_MEMBERS.map((member) => (
            <Card
              key={member.roleKey}
              className="overflow-hidden border-[var(--color-dark)] bg-[var(--color-dark)] p-0 flex flex-col"
              style={paperShadow}
            >
              <TeamCardPlaceholder />
              <div className="p-4 text-center sm:p-5">
                <p className="font-semibold text-[var(--color-lightest)] text-base sm:text-lg">
                  {t(member.nameKey)}
                </p>
                <p className="text-sm text-[var(--color-light)] mt-0.5">
                  {t(member.roleKey)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* About the project + Support the project side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card
          className="border-[var(--color-dark)] bg-[var(--color-dark)] p-4 sm:p-6 flex flex-col"
          style={paperShadow}
        >
          <h2 className="mb-3 text-lg font-semibold text-[var(--color-lightest)]">
            {t("about.projectTitle")}
          </h2>
          <p className="whitespace-pre-wrap text-[var(--color-light)] flex-1 text-sm sm:text-base">
            {t("about.projectBody")}
          </p>
        </Card>
        <Card
          className="border-[var(--color-dark)] bg-[var(--color-dark)] p-4 sm:p-6 flex flex-col"
          style={paperShadow}
        >
          <h2 className="mb-3 text-lg font-semibold text-[var(--color-lightest)]">
            {t("about.donationTitle")}
          </h2>
          <p className="mb-4 text-[var(--color-light)] flex-1 text-sm sm:text-base">
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
      </div>
    </motion.div>
  );
}
