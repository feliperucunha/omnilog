import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardGameProviderSelector } from "@/components/BoardGameProviderSelector";
import { useLocale, LOCALE_OPTIONS, type Locale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useVisibleMediaTypes } from "@/contexts/VisibleMediaTypesContext";
import { useMe } from "@/contexts/MeContext";
import { apiFetch, invalidateApiCache } from "@/lib/api";
import { showErrorToast } from "@/lib/errorToast";
import { FORCE_ONBOARDING_UI } from "@/lib/onboardingDev";
import { MEDIA_TYPES, type BoardGameProvider, type MediaType } from "@geeklogs/shared";
import { MediaCategoryDragList } from "@/components/MediaCategoryDragList";
import { cn } from "@/lib/utils";
import { trackProductEvent } from "@/lib/productAnalytics";

export type OnboardingFormProps = {
  /** Full-page shell vs compact block inside a dialog. */
  layout?: "page" | "embed";
  /** When true, completing does not navigate away (e.g. dev modal); calls onPreviewDismiss instead. */
  previewMode?: boolean;
  onPreviewDismiss?: () => void;
};

type WizardStep = "language" | "theme" | "categories" | "boardgames";

export function OnboardingForm({ layout = "page", previewMode, onPreviewDismiss }: OnboardingFormProps) {
  const { t, locale, setLocale } = useLocale();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { colorScheme, setColorScheme } = useTheme();
  const themeForDefaults = colorScheme === "light" ? "light" : "dark";
  const { refetch: refetchVisibleTypes } = useVisibleMediaTypes();
  const { refetch: refetchMe, me } = useMe();
  const [orderedTypes, setOrderedTypes] = useState<MediaType[]>(() => [...MEDIA_TYPES]);
  const [selectedTypes, setSelectedTypes] = useState<Set<MediaType>>(() => new Set(MEDIA_TYPES));
  const [theme, setTheme] = useState<"light" | "dark">(colorScheme);
  const [boardGameProvider, setBoardGameProvider] = useState<BoardGameProvider>("bgg");
  const [draftLocale, setDraftLocale] = useState<Locale>(locale);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setDraftLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (!previewMode || !me?.visibleMediaTypes?.length) return;
    const raw = me.visibleMediaTypes as MediaType[];
    const valid = raw.filter((x): x is MediaType => (MEDIA_TYPES as readonly string[]).includes(x));
    if (valid.length === 0) return;
    const rest = MEDIA_TYPES.filter((x) => !valid.includes(x));
    setOrderedTypes([...valid, ...rest]);
    setSelectedTypes(new Set(valid));
  }, [previewMode, me?.visibleMediaTypes]);

  const stepSequence = useMemo((): WizardStep[] => {
    const seq: WizardStep[] = ["language", "theme", "categories"];
    if (selectedTypes.has("boardgames")) seq.push("boardgames");
    return seq;
  }, [selectedTypes]);

  useEffect(() => {
    setStepIndex((idx) => Math.min(idx, Math.max(0, stepSequence.length - 1)));
  }, [stepSequence.length]);

  const currentStep = stepSequence[stepIndex] ?? "language";
  const isLastStep = stepIndex >= stepSequence.length - 1;

  const typesPayload = orderedTypes.filter((x) => selectedTypes.has(x));

  const navigateAfterDone = useCallback(() => {
    if (previewMode) {
      onPreviewDismiss?.();
      if (!onPreviewDismiss) navigate("/", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [previewMode, onPreviewDismiss, navigate]);

  const submitOnboarding = useCallback(
    async (opts: {
      theme: "light" | "dark";
      types: MediaType[];
      locale: Locale;
      boardGameProvider?: BoardGameProvider;
      analyticsPath: "custom" | "defaults" | "configure_later";
    }) => {
      if (!user) return;
      const body: {
        theme: "light" | "dark";
        types: MediaType[];
        locale: Locale;
        boardGameProvider?: BoardGameProvider;
      } = {
        theme: opts.theme,
        types: opts.types,
        locale: opts.locale,
      };
      const hasBg = opts.types.includes("boardgames");
      if (hasBg) {
        body.boardGameProvider = opts.boardGameProvider ?? "bgg";
      }
      setLoading(true);
      try {
        await apiFetch("/settings/onboarding", {
          method: "PUT",
          body: JSON.stringify(body),
        });
        setColorScheme(opts.theme);
        setLocale(opts.locale);
        setUser({ ...user, onboarded: true });
        trackProductEvent("onboarding_completed", { path: opts.analyticsPath });
        await refetchVisibleTypes();
        await refetchMe();
        invalidateApiCache("/search");
        navigateAfterDone();
      } catch (err) {
        showErrorToast(t, "E008", { originalError: err });
      } finally {
        setLoading(false);
      }
    },
    [user, setColorScheme, setLocale, setUser, refetchVisibleTypes, refetchMe, navigateAfterDone, t]
  );

  const handleComplete = () => {
    if (!user || typesPayload.length === 0) return;
    void submitOnboarding({
      theme,
      types: typesPayload,
      locale: draftLocale,
      boardGameProvider: selectedTypes.has("boardgames") ? boardGameProvider : undefined,
      analyticsPath: "custom",
    });
  };

  const handleConfigureLater = () => {
    if (!user) return;
    void submitOnboarding({
      theme: themeForDefaults,
      types: [...MEDIA_TYPES],
      locale: draftLocale,
      boardGameProvider: "bgg",
      analyticsPath: "configure_later",
    });
  };

  const canAdvanceFromCategories = typesPayload.length > 0;

  const handlePrimary = () => {
    if (loading) return;
    if (isLastStep) {
      handleComplete();
      return;
    }
    if (currentStep === "categories" && !canAdvanceFromCategories) return;
    setStepIndex((i) => Math.min(i + 1, stepSequence.length - 1));
  };

  const handleBack = () => {
    if (loading || stepIndex <= 0) return;
    setStepIndex((i) => i - 1);
  };

  const primaryLabel = loading
    ? t("onboarding.continuing")
    : isLastStep
      ? t("onboarding.enterApp")
      : t("onboarding.next");

  const primaryDisabled =
    loading || (isLastStep && typesPayload.length === 0) || (!isLastStep && currentStep === "categories" && !canAdvanceFromCategories);

  const pickLocale = (next: Locale) => {
    setDraftLocale(next);
    setLocale(next);
  };

  const pickTheme = (next: "light" | "dark") => {
    setTheme(next);
    setColorScheme(next);
  };

  const handleToggleType = (type: MediaType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const stepContent = (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex min-h-0 flex-col gap-4"
      >
        {currentStep === "language" ? (
          <>
            <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--color-lightest)]">
              {t("onboarding.stepLanguageTitle")}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {LOCALE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={loading}
                  onClick={() => pickLocale(opt.value)}
                  className={cn(
                    "rounded-xl border px-4 py-3.5 text-sm font-medium transition-colors max-md:min-h-[48px]",
                    draftLocale === opt.value
                      ? "border-[var(--color-mid)] bg-[var(--color-mid)]/20 text-[var(--color-lightest)]"
                      : "border-[var(--color-surface-border)]/60 bg-[var(--color-darkest)]/30 text-[var(--color-light)] hover:border-[var(--color-mid)]/50 hover:bg-[var(--color-darkest)]/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {currentStep === "theme" ? (
          <>
            <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--color-lightest)]">
              {t("onboarding.stepThemeTitle")}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => pickTheme("light")}
                className={cn(
                  "flex-1 rounded-xl border px-4 py-3.5 text-sm font-medium transition-colors max-md:min-h-[48px]",
                  theme === "light"
                    ? "border-[var(--color-mid)] bg-[var(--color-mid)]/20 text-[var(--color-lightest)]"
                    : "border-[var(--color-surface-border)]/60 bg-[var(--color-darkest)]/30 text-[var(--color-light)] hover:border-[var(--color-mid)]/50"
                )}
              >
                {t("theme.light")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => pickTheme("dark")}
                className={cn(
                  "flex-1 rounded-xl border px-4 py-3.5 text-sm font-medium transition-colors max-md:min-h-[48px]",
                  theme === "dark"
                    ? "border-[var(--color-mid)] bg-[var(--color-mid)]/20 text-[var(--color-lightest)]"
                    : "border-[var(--color-surface-border)]/60 bg-[var(--color-darkest)]/30 text-[var(--color-light)] hover:border-[var(--color-mid)]/50"
                )}
              >
                {t("theme.dark")}
              </button>
            </div>
          </>
        ) : null}

        {currentStep === "categories" ? (
          <>
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--color-lightest)]">
                {t("onboarding.stepCategoriesTitle")}
              </h2>
              <p className="text-xs text-[var(--color-light)]">{t("onboarding.stepCategoriesHint")}</p>
            </div>
            <MediaCategoryDragList
              order={orderedTypes}
              onReorder={setOrderedTypes}
              selected={selectedTypes}
              onToggle={handleToggleType}
              disabled={loading}
              isPending={loading}
              pendingLabel={t("common.loading")}
              labelForType={(type) => t(`nav.${type}`)}
              gripAriaLabel={t("settings.dragToReorder")}
              listAriaLabel={t("onboarding.mediaTypesLabel")}
            />
          </>
        ) : null}

        {currentStep === "boardgames" ? (
          <>
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--color-lightest)]">
                {t("onboarding.stepBoardGamesTitle")}
              </h2>
              <p className="text-xs text-[var(--color-light)]">{t("onboarding.stepBoardGamesHint")}</p>
            </div>
            <BoardGameProviderSelector
              value={boardGameProvider}
              onValueChange={setBoardGameProvider}
              disabled={loading}
            />
          </>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );

  const progressDots = (
    <div className="flex justify-center gap-1.5 px-2">
      {stepSequence.map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 w-8 max-w-[22%] rounded-full transition-colors",
            i <= stepIndex ? "bg-[var(--color-mid)]" : "bg-[var(--color-mid)]/20"
          )}
          aria-hidden
        />
      ))}
    </div>
  );

  const cardMaxHeight =
    layout === "embed" ? "max-h-[min(85dvh,720px)]" : "max-h-[min(92dvh,720px)]";

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={cn(
        "flex w-full max-w-md min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-surface-border)]/70 bg-[var(--color-dark)] shadow-[var(--shadow-md)]",
        cardMaxHeight,
        layout === "embed" && "max-w-full min-h-0 flex-1"
      )}
    >
      <div className="shrink-0 space-y-3 px-6 pb-2 pt-6">
        <p className="text-center text-sm font-medium text-[var(--color-lightest)]">{t("onboarding.title")}</p>
        {progressDots}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-6 py-1">
        {stepContent}
      </div>

      <div className="shrink-0 space-y-3 border-t border-[var(--color-surface-border)]/50 bg-[var(--color-dark)] px-6 pb-6 pt-4">
        <Button
          type="button"
          className="relative z-10 h-11 w-full rounded-xl text-[15px] font-medium"
          disabled={primaryDisabled}
          onClick={() => void handlePrimary()}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              {primaryLabel}
            </span>
          ) : (
            primaryLabel
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="relative z-10 h-10 w-full text-sm font-normal text-[var(--color-light)] hover:text-[var(--color-lightest)]"
          disabled={loading}
          onClick={() => void handleConfigureLater()}
        >
          {t("onboarding.configureLaterInSettings")}
        </Button>
        {stepIndex > 0 ? (
          <button
            type="button"
            disabled={loading}
            onClick={handleBack}
            className="relative z-10 w-full text-center text-sm text-[var(--color-light)] underline-offset-4 hover:text-[var(--color-lightest)] hover:underline disabled:opacity-50"
          >
            {t("onboarding.back")}
          </button>
        ) : null}
      </div>
    </motion.div>
  );

  if (layout === "page") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-darkest)] p-6">
        <h1 className="sr-only">{t("onboarding.a11yWizardTitle")}</h1>
        {card}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      {card}
    </div>
  );
}

export function Onboarding() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const previewByUrl = searchParams.get("preview") === "1";

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowPreview = (FORCE_ONBOARDING_UI || previewByUrl) && user.onboarded === true;
  if (user.onboarded === true && !allowPreview) {
    return <Navigate to="/" replace />;
  }

  return <OnboardingForm layout="page" previewMode={allowPreview} />;
}
