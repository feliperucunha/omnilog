import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AuthNavbar } from "@/components/AuthNavbar";
import { MobileAppInstallBanner } from "@/components/MobileAppInstallBanner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

const MEDIA_KEYS = [
  "nav.movies",
  "nav.tv",
  "nav.games",
  "nav.boardgames",
  "nav.books",
  "nav.anime",
  "nav.manga",
  "nav.comics",
] as const;

function setMetaContent(selector: string, content: string, attr = "content") {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, content);
}

function LandingMediaCarousel({
  labels,
  ariaLabel,
  reduceMotion,
}: {
  labels: string[];
  ariaLabel: string;
  reduceMotion: boolean | null;
}) {
  const groupClassName =
    "m-0 flex list-none items-center gap-10 p-0 pr-10 sm:gap-14 sm:pr-14";
  const itemClassName =
    "whitespace-nowrap text-2xl font-semibold tracking-tight text-[var(--color-lightest)] sm:text-3xl";

  return (
    <div className="landing-media-marquee -mx-5 overflow-hidden pt-2 sm:-mx-8" aria-label={ariaLabel}>
      <div
        className={cn(
          "landing-media-marquee-track flex w-max items-center",
          reduceMotion && "landing-media-marquee-track--static"
        )}
      >
        <ul className={groupClassName}>
          {labels.map((label) => (
            <li key={label} className={itemClassName}>
              {label}
            </li>
          ))}
        </ul>
        <ul className={groupClassName} aria-hidden>
          {labels.map((label) => (
            <li key={`loop-${label}`} className={itemClassName}>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LandingHeroVisual({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <div className="landing-hero-mesh absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-darkest)] via-[var(--color-darkest)]/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-darkest)] via-[var(--color-darkest)]/40 to-transparent max-md:via-[var(--color-darkest)]/70" />
      <div className="absolute -right-[8%] top-[12%] bottom-0 hidden w-[58%] md:block lg:w-[52%]">
        <div className="landing-hero-float absolute top-[6%] bottom-0 left-[8%] right-[18%]">
          <div className="h-full overflow-hidden rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-dark)]/80 shadow-[var(--shadow-lg)] backdrop-blur-sm rotate-[-4deg]">
            <img
              src="/app-home.jpeg"
              alt=""
              className="h-full w-full object-cover object-top"
              decoding="async"
            />
          </div>
        </div>
        <div className="landing-hero-float-delayed absolute top-[14%] bottom-0 left-[28%] right-[4%]">
          <div className="h-full overflow-hidden rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-dark)]/90 shadow-[var(--shadow-lg)] backdrop-blur-sm rotate-[3deg]">
            <img
              src="/app-statistics.jpeg"
              alt=""
              className="h-full w-full object-cover object-top"
              decoding="async"
            />
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 top-[4%] h-[38%] md:hidden">
        <div className="landing-hero-float absolute inset-y-0 left-[6%] right-[22%]">
          <div className="h-full overflow-hidden rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-dark)]/80 shadow-[var(--shadow-lg)] backdrop-blur-sm rotate-[-4deg]">
            <img
              src="/app-home.jpeg"
              alt=""
              className="h-full w-full object-cover object-top"
              decoding="async"
            />
          </div>
        </div>
        <div className="landing-hero-float-delayed absolute inset-y-[8%] left-[24%] right-[6%]">
          <div className="h-full overflow-hidden rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-dark)]/90 shadow-[var(--shadow-lg)] backdrop-blur-sm rotate-[3deg]">
            <img
              src="/app-statistics.jpeg"
              alt=""
              className="h-full w-full object-cover object-top"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  const { t, locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const mediaLabels = MEDIA_KEYS.map((key) => t(key));

  useEffect(() => {
    const title = t("landing.docTitle");
    const description = t("landing.docDescription");
    const prevTitle = document.title;
    document.title = title;
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: t("app.name"),
      applicationCategory: "EntertainmentApplication",
      operatingSystem: "Web",
      description,
      url: typeof window !== "undefined" ? window.location.origin : "https://geeklogs.com.br",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      inLanguage: locale,
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "landing-jsonld";
    script.text = JSON.stringify(jsonLd);
    document.getElementById("landing-jsonld")?.remove();
    document.head.appendChild(script);

    return () => {
      document.title = prevTitle;
      document.getElementById("landing-jsonld")?.remove();
    };
  }, [t, locale]);

  const fadeUp = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-darkest)] text-[var(--color-lightest)]">
      <AuthNavbar />
      <MobileAppInstallBanner variant="inline" />
      <main className="flex min-h-0 flex-1 flex-col">
        <section className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col justify-end overflow-hidden">
          <LandingHeroVisual />
          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 pb-14 pt-28 sm:px-8 sm:pb-20 md:pt-32 lg:pb-24">
            <motion.div
              className="flex max-w-xl flex-col gap-5"
              {...fadeUp}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-3">
                <Logo alt="" className="h-12 w-auto sm:h-14" />
                <h1 className="brand-title text-4xl font-bold tracking-tight text-[var(--btn-gradient-end)] dark:text-[var(--btn-gradient-start)] sm:text-5xl md:text-6xl">
                  {t("app.name")}
                </h1>
              </div>
              <p className="text-xl font-medium leading-snug text-[var(--color-lightest)] sm:text-2xl md:text-[1.75rem] md:leading-snug">
                {t("landing.headline")}
              </p>
              <p className="max-w-md text-base leading-relaxed text-[var(--color-light)] sm:text-lg">
                {t("landing.support")}
              </p>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="min-h-12 w-full px-8 text-base sm:w-auto">
                  <Link to="/register">{t("nav.register")}</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="min-h-12 w-full px-8 text-base sm:w-auto"
                >
                  <Link to="/login">{t("nav.logIn")}</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="relative border-t border-[var(--color-mid)]/20 bg-[var(--color-dark)]">
          <div className="landing-section-glow pointer-events-none absolute inset-0" aria-hidden />
          <motion.div
            className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-16 sm:px-8 sm:py-20"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-[var(--color-lightest)] sm:text-3xl">
              {t("landing.libraryTitle")}
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-[var(--color-light)] sm:text-lg">
              {t("landing.libraryBody")}
            </p>
            <LandingMediaCarousel
              labels={mediaLabels}
              ariaLabel={t("landing.libraryTitle")}
              reduceMotion={reduceMotion}
            />
          </motion.div>
        </section>

        <section className="border-t border-[var(--color-mid)]/20 bg-[var(--color-darkest)]">
          <motion.div
            className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-16 sm:px-8 sm:py-20 md:flex-row md:items-end md:justify-between md:gap-12"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex max-w-xl flex-col gap-4">
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-lightest)] sm:text-3xl">
                {t("landing.statsTitle")}
              </h2>
              <p className="text-base leading-relaxed text-[var(--color-light)] sm:text-lg">
                {t("landing.statsBody")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="min-h-12 w-full px-8 text-base sm:w-auto">
                <Link to="/register">{t("landing.ctaPrimary")}</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="min-h-12 w-full px-6 text-base text-[var(--color-light)] sm:w-auto"
              >
                <Link to="/tiers">{t("nav.plans")}</Link>
              </Button>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-mid)]/25 bg-[var(--color-dark)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-sm text-[var(--color-light)]">{t("landing.footerTagline")}</p>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--color-light)]"
            aria-label={t("landing.footerNav")}
          >
            <Link to="/about" className="hover:text-[var(--color-lightest)]">
              {t("nav.about")}
            </Link>
            <Link to="/faq" className="hover:text-[var(--color-lightest)]">
              {t("about.linkFaq")}
            </Link>
            <Link to="/tiers" className="hover:text-[var(--color-lightest)]">
              {t("nav.plans")}
            </Link>
            <Link to="/privacy" className="hover:text-[var(--color-lightest)]">
              {t("about.linkPrivacy")}
            </Link>
            <Link to="/terms" className="hover:text-[var(--color-lightest)]">
              {t("about.linkTerms")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
