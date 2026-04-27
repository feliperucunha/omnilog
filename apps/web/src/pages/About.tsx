import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Heart, Github } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/StarRating";
import { apiFetch } from "@/lib/api";
import * as storage from "@/lib/storage";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { paperShadow } from "@/lib/paperShadow";

const FEEDBACK_COOLDOWN_KEY = "geeklogs_feedback_cooldown";
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const DEFAULT_KOFI_URL = "https://ko-fi.com/felipecunha23777";

const DONATION_LINKS = [
  {
    key: "kofi",
    envKey: "VITE_DONATION_KOFI_URL",
    icon: Heart,
    labelKey: "about.donateKofi",
  },
  {
    key: "github",
    envKey: "VITE_DONATION_GITHUB_SPONSORS_URL",
    icon: Github,
    labelKey: "about.donateGitHub",
  },
] as const;

const TEAM_MEMBERS = [
  { roleKey: "about.teamRoleCEO", nameKey: "about.teamNameCEO", image: "/ceo.jpeg" },
  { roleKey: "about.teamRoleDeveloper", nameKey: "about.teamNameDeveloper", image: "/dev.jpeg" },
  { roleKey: "about.teamRoleDesigner", nameKey: "about.teamNameDesigner", image: "/designer.jpeg" },
  { roleKey: "about.teamRoleQA", nameKey: "about.teamNameQA", image: "/qa.jpeg" },
] as const;

type DonationLinkConfig = (typeof DONATION_LINKS)[number];

type TeamMember = (typeof TEAM_MEMBERS)[number];

function resolveDonationUrl(link: DonationLinkConfig): string | null {
  const raw = import.meta.env[link.envKey] as string | undefined;
  const trimmed = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "";
  if (link.key === "kofi") return trimmed || DEFAULT_KOFI_URL;
  return trimmed || null;
}

function TeamMemberCard({ member, t }: { member: TeamMember; t: (key: string) => string }) {
  return (
    <Card
      className="h-full overflow-hidden border-[var(--color-surface-border)] bg-[var(--color-dark)] p-0 flex flex-col"
      style={paperShadow}
    >
      <img
        src={member.image}
        alt={t(member.nameKey)}
        className="aspect-square w-full object-cover rounded-t-lg"
      />
      <div className="flex flex-1 flex-col justify-center p-4 text-center sm:p-5">
        <p className="text-base font-semibold text-[var(--color-lightest)] sm:text-lg">{t(member.nameKey)}</p>
        <p className="mt-0.5 text-sm text-[var(--color-light)]">{t(member.roleKey)}</p>
      </div>
    </Card>
  );
}

export function About() {
  const { t } = useLocale();
  const { token } = useAuth();
  const { setPageTitle } = usePageTitle() ?? {};
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    setPageTitle?.(t("about.title"));
    return () => setPageTitle?.(null);
  }, [t, setPageTitle]);
  const [rating, setRating] = useState<number>(5);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    storage.getItem(FEEDBACK_COOLDOWN_KEY).then((raw) => {
      if (cancelled) return;
      const n = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n > Date.now()) setCooldownEndsAt(n);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cooldownEndsAt == null) return;
    const update = () => {
      const left = Math.max(0, Math.ceil((cooldownEndsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        void storage.removeItem(FEEDBACK_COOLDOWN_KEY);
        setCooldownEndsAt(null);
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [cooldownEndsAt]);

  const inCooldown = cooldownEndsAt != null && secondsLeft > 0;

  const handleFeedbackClick = useCallback(() => {
    if (!token || inCooldown) return;
    setExpanded((e) => !e);
  }, [token, inCooldown]);

  const handleSubmitFeedback = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!token || submitting) return;
      setSubmitting(true);
      try {
        await apiFetch<{ ok: boolean }>("/feedback", {
          method: "POST",
          body: JSON.stringify({ rating, comments: comments.trim() || undefined }),
        });
        const until = Date.now() + COOLDOWN_MS;
        void storage.setItem(FEEDBACK_COOLDOWN_KEY, String(until));
        setCooldownEndsAt(until);
        setExpanded(false);
        setComments("");
        toast.success(t("about.feedbackSuccess"));
      } catch (err) {
        showErrorToast(t, "E024", { originalError: err });
      } finally {
        setSubmitting(false);
      }
    },
    [token, submitting, rating, comments, t]
  );

  const donationButtons = DONATION_LINKS.map((link) => {
    const url = resolveDonationUrl(link);
    return url ? { ...link, url } : null;
  }).filter((entry): entry is DonationLinkConfig & { url: string } => entry != null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex flex-col gap-8 w-full"
    >
      <section className="w-full">
        <Card className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 sm:p-6" style={paperShadow}>
          <h2 className="mb-3 min-w-0 text-lg font-semibold text-[var(--color-lightest)]">
            <OverflowMarquee>{t("about.helpLegalTitle")}</OverflowMarquee>
          </h2>
          <ul className="flex flex-col gap-2 text-sm text-[var(--color-light)] sm:flex-row sm:flex-wrap sm:gap-x-6">
            <li>
              <Link to="/faq" className="text-[var(--color-mid)] underline-offset-2 hover:underline">
                {t("about.linkFaq")}
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="text-[var(--color-mid)] underline-offset-2 hover:underline">
                {t("about.linkPrivacy")}
              </Link>
            </li>
            <li>
              <Link to="/terms" className="text-[var(--color-mid)] underline-offset-2 hover:underline">
                {t("about.linkTerms")}
              </Link>
            </li>
          </ul>
        </Card>
      </section>

      {/* Team: horizontal snap carousel on small screens to save vertical space */}
      <section className="w-full" aria-labelledby="about-team-heading">
        <h2
          id="about-team-heading"
          className="mb-3 min-w-0 text-base font-semibold text-[var(--color-lightest)] sm:mb-4 sm:text-lg"
        >
          <OverflowMarquee>{t("about.teamTitle")}</OverflowMarquee>
        </h2>
        <div
          className="md:hidden scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden scroll-smooth scroll-pl-4 scroll-pr-4 px-4 pb-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [touch-action:pan-x]"
          role="list"
          aria-label={t("about.teamTitle")}
        >
          {TEAM_MEMBERS.map((member) => (
            <div
              key={member.roleKey}
              role="listitem"
              className="w-[min(78vw,17.5rem)] shrink-0 snap-center"
            >
              <TeamMemberCard member={member} t={t} />
            </div>
          ))}
        </div>
        <div className="hidden gap-4 sm:gap-6 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {TEAM_MEMBERS.map((member) => (
            <TeamMemberCard key={member.roleKey} member={member} t={t} />
          ))}
        </div>
      </section>

      {/* About the project + Support the project side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card
          className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 sm:p-6 flex flex-col"
          style={paperShadow}
        >
          <h2 className="mb-3 min-w-0 text-lg font-semibold text-[var(--color-lightest)]">
            <OverflowMarquee>{t("about.projectTitle")}</OverflowMarquee>
          </h2>
          <p className="whitespace-pre-wrap text-[var(--color-light)] flex-1 text-sm sm:text-base">
            {t("about.projectBody")}
          </p>
          <p className="mt-3 text-sm text-[var(--color-mid)]">
            {t("about.projectHostingNote")}
          </p>
        </Card>
        <Card
          className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 sm:p-6 flex flex-col"
          style={paperShadow}
        >
          <h2 className="mb-3 min-w-0 text-lg font-semibold text-[var(--color-lightest)]">
            <OverflowMarquee>{t("about.donationTitle")}</OverflowMarquee>
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
          <div className="mt-6 pt-4 border-t border-[var(--color-mid)]/20">
            <h3 className="mb-2 min-w-0 text-sm font-semibold text-[var(--color-lightest)]">
              <OverflowMarquee>{t("about.donatePixTitle")}</OverflowMarquee>
            </h3>
            <p className="mb-3 text-sm text-[var(--color-light)]">
              {t("about.donatePixIntro")}
            </p>
            <img
              src="/qrcode.png"
              alt={t("about.donatePixAlt")}
              className="h-48 w-48 rounded-lg border border-[var(--color-mid)]/30 object-contain bg-[var(--color-darkest)]"
            />
            <p className="mt-3 text-sm text-[var(--color-light)]">
              {t("about.donatePixKeyLabel")}{" "}
              <span className="font-mono text-[var(--color-lightest)]">felipecunha04@icloud.com</span>
            </p>
          </div>
        </Card>
      </div>

      {/* Feedback */}
      <Card
        role={token && !inCooldown ? "button" : undefined}
        tabIndex={token && !inCooldown ? 0 : undefined}
        onKeyDown={
          token && !inCooldown
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpanded((x) => !x);
                }
              }
            : undefined
        }
        onClick={handleFeedbackClick}
        className={`border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4 sm:p-6 flex flex-col relative ${
          token && !inCooldown ? "cursor-pointer hover:bg-[var(--color-mid)]/10 transition-colors" : ""
        } ${inCooldown ? "pointer-events-none cursor-not-allowed opacity-90" : ""}`}
        style={paperShadow}
      >
        {inCooldown && (
          <div className="absolute top-3 right-3 rounded-full bg-[var(--color-mid)]/30 px-2.5 py-1 text-xs font-medium text-[var(--color-lightest)]">
            {t("about.feedbackCooldownShort", { time: formatCooldown(secondsLeft) })}
          </div>
        )}
        <h2 className="mb-3 min-w-0 pr-24 text-lg font-semibold text-[var(--color-lightest)]">
          <OverflowMarquee>{t("about.feedbackTitle")}</OverflowMarquee>
        </h2>
        <p className="mb-3 text-[var(--color-light)] text-sm sm:text-base">
          {t("about.feedbackIntro")}
        </p>
        {!token && (
          <p className="text-sm text-[var(--color-mid)] italic">
            {t("about.feedbackLoginRequired")}
          </p>
        )}
        <AnimatePresence>
          {expanded && token && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <form onSubmit={handleSubmitFeedback} className="pt-2 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div>
                  <label id="feedback-rating-label" className="block text-sm font-medium text-[var(--color-light)] mb-1">
                    {t("about.feedbackRatingLabel")}
                  </label>
                  <div className="w-full min-w-0 overflow-x-auto [scrollbar-width:none] sm:overflow-visible">
                    <StarRating
                      value={rating}
                      onChange={(g) => {
                        if (g != null) setRating(g);
                      }}
                      size="md"
                      aria-required
                      allowClear={false}
                      className="w-max min-w-0 max-w-full"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="feedback-comments" className="block text-sm font-medium text-[var(--color-light)] mb-1">
                    {t("about.feedbackCommentsPlaceholder")}
                  </label>
                  <textarea
                    id="feedback-comments"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder={t("about.feedbackCommentsPlaceholder")}
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-md border border-[var(--color-mid)]/50 bg-[var(--color-darkest)] px-3 py-2 text-sm text-[var(--color-lightest)] placeholder:text-[var(--color-mid)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] resize-y"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="btn-gradient">
                  {submitting ? t("about.feedbackSending") : t("about.feedbackSend")}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
