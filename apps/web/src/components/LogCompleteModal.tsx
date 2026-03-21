import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { ItemImage } from "@/components/ItemImage";
import { useLocale } from "@/contexts/LocaleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Logo } from "@/components/Logo";
import { getHeroImageUrl } from "@/lib/getHeroImageUrl";
import { overlayVariants, modalContentVariants } from "@/lib/animations";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { showErrorToast } from "@/lib/errorToast";

/**
 * Real-device WebView can report isNativePlatform() later than the emulator, and animated
 * layers cause black rectangles. We treat as native if Capacitor exists and platform is
 * android/ios (fallback), and re-check after mount so we don't use motion on device.
 */
function useIsNative(): boolean {
  const [isNative, setIsNative] = useState(() => {
    if (typeof window === "undefined") return false;
    const w = window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    };
    if (!w?.Capacitor) return false;
    if (w.Capacitor.isNativePlatform?.()) return true;
    return w.Capacitor.getPlatform?.() === "android" || w.Capacitor.getPlatform?.() === "ios";
  });
  useEffect(() => {
    if (isNative) return;
    const w = window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    };
    const check = () => {
      if (!w?.Capacitor) return false;
      if (w.Capacitor.isNativePlatform?.()) return true;
      return w.Capacitor.getPlatform?.() === "android" || w.Capacitor.getPlatform?.() === "ios";
    };
    const t = setTimeout(() => {
      if (check()) setIsNative(true);
    }, 50);
    return () => clearTimeout(t);
  }, [isNative]);
  return isNative;
}

function statusColor(status: string | null | undefined): string {
  if (!status) return "bg-[var(--color-mid)]/40 text-[var(--color-light)]";
  if ((COMPLETED_STATUSES as readonly string[]).includes(status))
    return "bg-emerald-500/20 text-emerald-400 border border-emerald-400/30";
  if ((IN_PROGRESS_STATUSES as readonly string[]).includes(status))
    return "bg-amber-500/20 text-amber-400 border border-amber-400/30";
  return "bg-red-500/20 text-red-400 border border-red-400/30";
}

/** Inline status styles for share card (hex only so capture lib doesn't hit oklab). */
function statusColorStyle(status: string | null | undefined): React.CSSProperties {
  if (!status)
    return { backgroundColor: "rgba(128,128,128,0.4)", color: "#a3a3a3", border: "1px solid rgba(128,128,128,0.5)" };
  if ((COMPLETED_STATUSES as readonly string[]).includes(status))
    return { backgroundColor: "rgba(52,211,153,0.2)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" };
  if ((IN_PROGRESS_STATUSES as readonly string[]).includes(status))
    return { backgroundColor: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" };
  return { backgroundColor: "rgba(248,113,113,0.2)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" };
}

interface LogCompleteModalProps {
  state: LogCompleteState;
  onClose: () => void;
}

/** Dark theme: avoid pure black (#000) for OLED – use dark grays so the card doesn’t blend and to reduce smearing. */
const NATIVE_DARK = {
  cardBg: "#1c1c1c",
  text: "#f0f0f0",
  textMuted: "#a3a3a3",
  border: "#2e2e2e",
  overlay: "rgba(12,12,12,0.65)",
} as const;
const NATIVE_LIGHT = { cardBg: "#ffffff", text: "#0f172a", textMuted: "#64748b", border: "#e2e8f0", overlay: "rgba(255,255,255,0.82)" } as const;

export function LogCompleteModal({ state, onClose }: LogCompleteModalProps) {
  const { t } = useLocale();
  const theme = useTheme();
  const isNative = useIsNative();
  const nativeColors = theme.colorScheme === "light" ? NATIVE_LIGHT : NATIVE_DARK;
  const { image, title, grade, status, review, own, matchesPlayed, mediaType } = state;
  const showBoardGameMeta = mediaType === "boardgames";
  const stars = grade != null ? gradeToStars(grade) : 0;
  const statusLabel = status ? getStatusLabel(t, status, state.mediaType) : t("logComplete.logged");
  const heroImageUrl = getHeroImageUrl(image) ?? image;
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [shareInProgress, setShareInProgress] = useState(false);
  const [cachedHeroDataUrl, setCachedHeroDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!heroImageUrl || !isNative) {
      setCachedHeroDataUrl(null);
      return;
    }
    let cancelled = false;
    fetch(heroImageUrl, { mode: "cors" })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error("Fetch failed"))))
      .then((blob) => {
        if (cancelled) return Promise.reject(new Error("cancelled"));
        return new Promise<string | null>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      })
      .then((dataUrl) => {
        if (!cancelled && dataUrl) setCachedHeroDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setCachedHeroDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [heroImageUrl, isNative]);

  const isLight = theme.colorScheme === "light";
  const overlayClass =
    isLight
      ? "fixed inset-0 z-50 flex min-h-[100dvh] min-h-dvh-fallback items-center justify-center bg-white/90 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] md:bg-transparent md:p-6"
      : "fixed inset-0 z-50 flex min-h-[100dvh] min-h-dvh-fallback items-center justify-center bg-black/90 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] md:bg-transparent md:p-6";
  const cardClass =
    "relative flex max-h-full w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--color-dark)] shadow-[0_24px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] md:rounded-3xl";
  /** On native: real-device Android WebView clips the top of flex-centered content when it overflows. Use scrollable overlay + centered card so the full modal can be seen by scrolling. */
  const overlayClassNative =
    isLight
      ? "fixed inset-0 z-50 overflow-y-auto bg-white/90 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] min-h-[100dvh] min-h-[100vh]"
      : "fixed inset-0 z-50 overflow-y-auto bg-black/90 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] min-h-[100dvh] min-h-[100vh]";
  const cardClassNative =
    "relative flex w-full max-w-[400px] max-h-[85dvh] flex-col overflow-hidden rounded-2xl border md:rounded-3xl my-auto mx-4 flex-shrink-0";

  const closeButton = (
    <div className="absolute right-2 top-2 z-10 md:right-4 md:top-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full bg-black/75 text-white shadow-lg ring-1 ring-white/20 hover:bg-black/90 hover:text-white hover:ring-white/30 md:h-10 md:w-10"
        onClick={onClose}
        aria-label={t("common.close")}
      >
        <X className="h-5 w-5" />
      </Button>
    </div>
  );

  /** Plain button on native to avoid Radix/CVA compositing layers that can render as black on real devices. */
  const closeButtonNative = (
    <button
      type="button"
      onClick={onClose}
      aria-label={t("common.close")}
      className="h-9 w-9 rounded-full bg-black/80 text-white md:h-10 md:w-10 flex items-center justify-center border-0 shrink-0"
      style={{ transform: "none", willChange: "auto" }}
    >
      <X className="h-5 w-5" />
    </button>
  );

  const handleShare = async (e?: React.MouseEvent): Promise<void> => {
    e?.stopPropagation();
    if (shareInProgress) return;
    const el = shareCardRef.current;
    if (!el) {
      showErrorToast(t, "E015");
      return;
    }
    setShareInProgress(true);
    const dialogTitle = t("logComplete.loggedWith", { app: t("app.name") });
    const fileName = "log-complete-share.png";
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: nativeColors.cardBg,
        style: { transform: "none" },
      });
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      if (!base64 || base64.length < 100) {
        throw new Error("Image capture produced no data");
      }

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });

      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: dialogTitle,
        });
        return;
      }

      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const path = fileName;
      await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Cache,
      });
      const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path });
      await Share.share({
        files: [uri],
        dialogTitle,
        text: " ",
      });
    } catch (err) {
      showErrorToast(t, "E015", { originalError: err });
    } finally {
      setShareInProgress(false);
    }
  };

  /** Share button: only on native (Android/iOS). Shows spinner while image is being prepared. */
  const shareButtonNative = (
    <button
      type="button"
      onClick={(e) => handleShare(e)}
      disabled={shareInProgress}
      aria-label={t("common.share")}
      aria-busy={shareInProgress}
      className="h-9 w-9 rounded-full bg-black/80 text-white md:h-10 md:w-10 flex items-center justify-center border-0 shrink-0 disabled:opacity-60"
      style={{ transform: "none", willChange: "auto" }}
    >
      {shareInProgress ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      ) : (
        <Share2 className="h-5 w-5" />
      )}
    </button>
  );

  const topButtonsNative = (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-2 md:right-4 md:top-4">
      {shareButtonNative}
      {closeButtonNative}
    </div>
  );

  const imageSection = (
    <div className="relative flex-shrink-0 overflow-hidden rounded-t-2xl md:rounded-t-3xl">
      <div className="relative h-[40vh] w-full min-h-[160px] md:h-auto md:min-h-0 md:aspect-[2/3]">
        <ItemImage
          src={heroImageUrl}
          className="absolute inset-0 h-full w-full"
          imgClassName="object-cover object-center"
          fitContent={false}
          loading="eager"
          referrerPolicy="no-referrer"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--color-dark) 0%, transparent 40%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );

  const imageSectionNative = (
    <div className="relative flex-shrink-0 overflow-hidden rounded-t-2xl md:rounded-t-3xl" style={{ transform: "none", willChange: "auto" }}>
      <div className="relative h-[40vh] w-full min-h-[160px] md:h-auto md:min-h-0 md:aspect-[2/3]">
        <ItemImage
          src={heroImageUrl}
          className="absolute inset-0 h-full w-full"
          imgClassName="object-cover object-center"
          fitContent={false}
          loading="eager"
          referrerPolicy="no-referrer"
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, var(--color-dark) 0%, transparent 40%, transparent 100%)",
            transform: "none",
            willChange: "auto",
          }}
        />
      </div>
    </div>
  );

  /** Modal card content. */
  const contentBlock = (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-5"
      style={isNative ? { transform: "none", willChange: "auto" } : undefined}
    >
      <span
        className={`mb-2 inline-flex w-fit rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider md:mb-3 md:px-3 md:py-1 md:text-xs ${statusColor(status)}`}
        id="log-complete-status"
      >
        {statusLabel}
      </span>
      <h1
        id="log-complete-title"
        className="mb-2 line-clamp-2 text-lg font-bold leading-tight text-[var(--color-lightest)] md:mb-4 md:line-clamp-3 md:text-[1.75rem]"
      >
        {title}
      </h1>
      {grade != null && (
        <div className="mb-2 flex items-center gap-1 md:mb-3">
          <StarRating value={stars} readOnly size="lg" />
        </div>
      )}
      {showBoardGameMeta && (own != null || (matchesPlayed != null && matchesPlayed > 0)) && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-light)] md:mb-3">
          {own != null && (
            <span>{t("itemReviewForm.own")}: {own ? t("common.yes") : t("common.no")}</span>
          )}
          {matchesPlayed != null && matchesPlayed > 0 && (
            <span>{t("itemReviewForm.matchesPlayed")}: {matchesPlayed}</span>
          )}
        </div>
      )}
      {review != null && review.trim() !== "" && (
        <p className="mb-3 line-clamp-3 text-[11px] leading-snug text-[var(--color-light)] whitespace-pre-wrap md:mb-4 md:line-clamp-4 md:text-[0.8125rem] md:leading-relaxed">
          {review.trim()}
        </p>
      )}

      <div className="mt-auto flex shrink-0 items-center gap-1.5 pt-3 border-t border-[var(--color-mid)]/30 md:gap-2 md:pt-4">
        <Logo alt="" className="h-7 w-auto shrink-0 opacity-90 md:h-8" aria-hidden />
        <span className="text-xs font-medium text-[var(--color-light)] md:text-sm">
          {t("logComplete.loggedWith", { app: t("app.name") })}
        </span>
      </div>
    </div>
  );

  const cardContent = (
    <>
      {isNative ? topButtonsNative : closeButton}
      {isNative ? imageSectionNative : imageSection}
      {contentBlock}
    </>
  );

  /** Share scene: matches modal (blurred hero bg + overlay + centered card). Wrapper off-screen; scene has fixed size and position relative so html-to-image captures it. Card is smaller so blurred background is visible. */
  const shareSceneWidth = 300;
  const shareSceneHeight = 533; // same proportion as 360:640
  const shareCardWidth = 252;
  const shareCardMaxHeight = 380;
  /** Hero height in share card so the text block has room (full 2:3 would use ~378px and leave almost no space). */
  const shareHeroHeight = 230;
  const shareCard = (
    <div
      style={{
        position: "absolute",
        left: -9999,
        top: 0,
        width: shareSceneWidth,
        height: shareSceneHeight,
        pointerEvents: "none",
      }}
      aria-hidden
    >
      <div
        ref={shareCardRef}
        data-share-scene
        style={{
          position: "relative",
          width: shareSceneWidth,
          height: shareSceneHeight,
          overflow: "hidden",
        }}
      >
        {/* Blurred hero background (same as modal; img so capture picks it up) */}
        {cachedHeroDataUrl && (
          <img
            src={cachedHeroDataUrl}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              filter: isLight ? "blur(4px)" : "blur(10px)",
              WebkitFilter: isLight ? "blur(4px)" : "blur(10px)",
              transform: "scale(1.25)",
            }}
          />
        )}
        {!cachedHeroDataUrl && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(135deg, ${nativeColors.textMuted}33 0%, ${nativeColors.cardBg} 50%, ${nativeColors.textMuted}22 100%)`,
            }}
            aria-hidden
          />
        )}
        {/* Overlay tint (same as modal) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: nativeColors.overlay,
          }}
          aria-hidden
        />
        {/* Card centered in scene (position + transform so it stays centered when captured) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            padding: 20,
          }}
        >
          <div
            style={{
              position: "relative",
              width: shareCardWidth,
              maxWidth: shareCardWidth,
              maxHeight: shareCardMaxHeight,
              overflow: "hidden",
              borderRadius: 20,
              border: `1px solid ${nativeColors.border}`,
              backgroundColor: nativeColors.cardBg,
              color: nativeColors.text,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Hero: fixed height so content (title, stars, footer) is visible */}
            <div style={{ position: "relative", width: "100%", height: shareHeroHeight, flexShrink: 0, overflow: "hidden" }}>
              {cachedHeroDataUrl ? (
                <img
                  src={cachedHeroDataUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: `linear-gradient(135deg, ${nativeColors.textMuted}33 0%, ${nativeColors.cardBg} 50%, ${nativeColors.textMuted}22 100%)`,
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(to top, ${nativeColors.cardBg} 0%, transparent 40%)`,
                }}
              />
            </div>
            {/* Content: same as modal, inline colors only */}
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                minHeight: 0,
                overflowY: "auto",
                padding: "8px 12px 12px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  marginBottom: 6,
                  borderRadius: 9999,
                  padding: "3px 8px",
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  width: "fit-content",
                  ...statusColorStyle(status),
                }}
              >
                {statusLabel}
              </span>
              <h1
                style={{
                  marginBottom: 6,
                  fontSize: "1rem",
                  fontWeight: 700,
                  lineHeight: 1.25,
                  color: nativeColors.text,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {title}
              </h1>
              {grade != null && (
                <div style={{ marginBottom: 6, color: "#fbbf24", fontSize: "1.1rem", letterSpacing: "0.05em" }}>
                  {"★".repeat(Math.round(stars))}{"☆".repeat(5 - Math.round(stars))}
                </div>
              )}
              {showBoardGameMeta && (own != null || (matchesPlayed != null && matchesPlayed > 0)) && (
                <div style={{ marginBottom: 6, fontSize: 11, color: nativeColors.textMuted }}>
                  {own != null && (
                    <span>{t("itemReviewForm.own")}: {own ? t("common.yes") : t("common.no")}</span>
                  )}
                  {matchesPlayed != null && matchesPlayed > 0 && (
                    <span style={{ marginLeft: 10 }}>{t("itemReviewForm.matchesPlayed")}: {matchesPlayed}</span>
                  )}
                </div>
              )}
              {review != null && review.trim() !== "" && (
                <p
                  style={{
                    marginBottom: 10,
                    fontSize: 10,
                    lineHeight: 1.4,
                    color: nativeColors.textMuted,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {review.trim()}
                </p>
              )}
              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 10,
                  borderTop: `1px solid ${nativeColors.textMuted}4D`,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Logo alt="" className="h-6 w-auto shrink-0 opacity-90" aria-hidden style={{ display: "block" }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: nativeColors.textMuted }}>
                  {t("logComplete.loggedWith", { app: t("app.name") })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /** Android/iOS only: share button and native card layout. Share image = DOM capture of share card (matches modal). */
  if (isNative) {
    return (
      <div
        className={overlayClassNative}
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-complete-title"
        onClick={onClose}
      >
        {shareCard}
        {/* Blurred hero background (same as web). */}
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: heroImageUrl ? `url(${heroImageUrl})` : undefined,
            backgroundSize: "cover",
            filter: isLight ? "blur(4px)" : "blur(10px)",
            WebkitFilter: isLight ? "blur(4px)" : "blur(10px)",
            transform: "scale(1.25)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: nativeColors.overlay }}
          aria-hidden
        />
        {/* Wrapper allows vertical centering when card fits; when card is taller than viewport, overlay scrolls so full content (close button, image, description) is reachable. */}
        <div className="relative min-h-full flex items-center justify-center py-6 px-4">
          <article
            className={cardClassNative}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: nativeColors.cardBg,
              color: nativeColors.text,
              borderColor: nativeColors.border,
              ["--color-lightest" as string]: nativeColors.text,
              ["--color-light" as string]: nativeColors.textMuted,
              ["--color-mid" as string]: nativeColors.textMuted,
              transform: "none",
              willChange: "auto",
            }}
          >
            {cardContent}
          </article>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-complete-title"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={overlayVariants}
      onClick={onClose}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: heroImageUrl ? `url(${heroImageUrl})` : undefined,
          backgroundSize: "cover",
          filter: isLight ? "blur(4px)" : "blur(10px)",
          WebkitFilter: isLight ? "blur(4px)" : "blur(10px)",
          transform: "scale(1.25)",
        }}
        aria-hidden
      />
      <div
        className={isLight ? "pointer-events-none absolute inset-0 bg-white/70 md:bg-white/55" : "pointer-events-none absolute inset-0 bg-black/70 md:bg-black/55"}
        aria-hidden
      />
      <motion.article
        className={cardClass}
        variants={modalContentVariants}
        onClick={(e) => e.stopPropagation()}
      >
        {cardContent}
      </motion.article>
    </motion.div>
  );
}
