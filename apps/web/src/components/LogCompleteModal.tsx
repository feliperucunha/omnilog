import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { ItemImage } from "@/components/ItemImage";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Logo, getLogoSrc } from "@/components/Logo";
import { getHeroImageUrl, cssBackgroundImageUrl } from "@/lib/getHeroImageUrl";
import { isBggBoardGameImageContext } from "@/lib/boardGameImageFit";
import { overlayVariants, modalContentVariants } from "@/lib/animations";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { showErrorToast } from "@/lib/errorToast";
import { cn } from "@/lib/utils";

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

/**
 * When true, the browser uses the same completed-log modal as Capacitor (scrollable overlay,
 * plain close/share controls, no framer-motion on the shell). Set to `false` to restore the web-only layout.
 */
const USE_NATIVE_LOG_COMPLETE_LAYOUT_ON_WEB = false;

/** Share scene lays out at this width (CSS px) so type and images rasterize sharp; avoid huge `pixelRatio` on a tiny DOM (blur/filter + foreignObject degrade). */
const SHARE_EXPORT_SCENE_WIDTH_PX = 1080;
/** Extra multiplier for the final PNG (scene width × this ≈ output width, e.g. 1080×2 = 2160). */
const SHARE_CAPTURE_PIXEL_RATIO = 2;

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
  const { me } = useMe();
  const theme = useTheme();
  const isCapacitorNative = useIsNative();
  const nativeUi = USE_NATIVE_LOG_COMPLETE_LAYOUT_ON_WEB || isCapacitorNative;
  const nativeColors = theme.colorScheme === "light" ? NATIVE_LIGHT : NATIVE_DARK;
  const { image, title, grade, status, review, own, wantToBuy, matchesPlayed, mediaType } = state;
  const showCollectionOwnershipMeta =
    mediaType === "boardgames" || mediaType === "games";
  const showBoardGameMatchesMeta = mediaType === "boardgames";
  const stars = grade != null ? gradeToStars(grade) : 0;
  const statusLabel = status ? getStatusLabel(t, status, state.mediaType) : t("logComplete.logged");
  const heroImageUrl = getHeroImageUrl(image) ?? image;
  const bggBoardFraming = isBggBoardGameImageContext(
    mediaType,
    heroImageUrl,
    null,
    me?.boardGameProvider ?? null
  );
  /** BGG box art is landscape; a shorter card + hero keeps the modal from feeling overly tall on web and native. */
  const bggShorterCard = bggBoardFraming;
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [shareInProgress, setShareInProgress] = useState(false);
  const [cachedHeroDataUrl, setCachedHeroDataUrl] = useState<string | null>(null);
  /** Share PNG layout: smaller footer + shorter hero on narrow viewports (phone / WebView). */
  const [compactShareLayout, setCompactShareLayout] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setCompactShareLayout(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!heroImageUrl || !nativeUi) {
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
  }, [heroImageUrl, nativeUi]);

  const isLight = theme.colorScheme === "light";
  const overlayClass =
    isLight
      ? "fixed inset-0 z-50 flex min-h-[100dvh] min-h-dvh-fallback items-center justify-center bg-white/90 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] md:bg-transparent md:p-6"
      : "fixed inset-0 z-50 flex min-h-[100dvh] min-h-dvh-fallback items-center justify-center bg-black/90 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] md:bg-transparent md:p-6";
  const cardClass =
    "relative flex max-h-full w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--color-dark)] shadow-[0_24px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] md:rounded-3xl";
  /**
   * Native: fill the viewport without document-level scroll; the card body scrolls internally.
   * (Older overflow-y-auto on the overlay caused double-scroll and clipped flex layout on phones.)
   */
  const overlayClassNative =
    isLight
      ? "fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden overscroll-y-contain bg-white/90 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] h-[100dvh] max-h-[100dvh]"
      : "fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden overscroll-y-contain bg-black/90 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] h-[100dvh] max-h-[100dvh]";
  const cardClassNative =
    "relative flex min-h-0 max-h-full w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border md:rounded-3xl mx-4 flex-shrink-0";

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
        pixelRatio: SHARE_CAPTURE_PIXEL_RATIO,
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

  const heroWebWrapperClass = cn(
    "relative w-full md:h-auto md:min-h-0",
    bggShorterCard
      ? "h-[36vh] min-h-[136px] md:aspect-[7/8] md:max-h-[min(40vh,360px)]"
      : "h-[60vh] min-h-[190px] md:aspect-[2/3]"
  );

  const imageSection = (
    <div className="relative flex-shrink-0 overflow-hidden rounded-t-2xl md:rounded-t-3xl">
      <div className={heroWebWrapperClass}>
        <ItemImage
          src={heroImageUrl}
          className="absolute inset-0 h-full w-full"
          mediaType={mediaType}
          activeBoardGameProvider={me?.boardGameProvider ?? null}
          fitContent={false}
          loading="eager"
          referrerPolicy="no-referrer"
        />
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background:
              "linear-gradient(to top, var(--color-dark) 0%, transparent 40%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );

  const heroNativeWrapperClass = cn(
    "relative w-full md:h-auto md:min-h-0",
    bggShorterCard
      ? "h-[32vh] min-h-[124px] max-h-[40dvh] md:max-h-[min(38vh,340px)] md:aspect-[7/8]"
      : "h-[48vh] min-h-[156px] max-h-[56dvh] md:max-h-none md:aspect-[2/3]"
  );

  const imageSectionNative = (
    <div className="relative flex-shrink-0 overflow-hidden rounded-t-2xl md:rounded-t-3xl" style={{ transform: "none", willChange: "auto" }}>
      <div className={heroNativeWrapperClass}>
        <ItemImage
          src={heroImageUrl}
          className="absolute inset-0 h-full w-full"
          mediaType={mediaType}
          activeBoardGameProvider={me?.boardGameProvider ?? null}
          fitContent={false}
          loading="eager"
          referrerPolicy="no-referrer"
        />
        <div
          className="absolute inset-0 z-[2]"
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
      style={nativeUi ? { transform: "none", willChange: "auto" } : undefined}
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
      {showCollectionOwnershipMeta &&
        (own != null ||
          wantToBuy != null ||
          (showBoardGameMatchesMeta && matchesPlayed != null && matchesPlayed > 0)) && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-light)] md:mb-3">
          {own != null && (
            <span>{t("itemReviewForm.own")}: {own ? t("common.yes") : t("common.no")}</span>
          )}
          {wantToBuy != null && (
            <span>{t("itemReviewForm.wantToBuy")}: {wantToBuy ? t("common.yes") : t("common.no")}</span>
          )}
          {showBoardGameMatchesMeta && matchesPlayed != null && matchesPlayed > 0 && (
            <span>{t("itemReviewForm.matchesPlayed")}: {matchesPlayed}</span>
          )}
        </div>
      )}
      {review != null && review.trim() !== "" && (
        <p className="mb-3 line-clamp-3 text-[11px] leading-snug text-[var(--color-light)] whitespace-pre-wrap md:mb-4 md:line-clamp-4 md:text-[0.8125rem] md:leading-relaxed">
          {review.trim()}
        </p>
      )}

      <div className="mt-auto flex w-full shrink-0 flex-nowrap items-center gap-1.5 border-t border-[var(--color-mid)]/30 pt-3 md:gap-2 md:pt-4">
        <Logo alt="" className="h-7 w-auto shrink-0 opacity-90 md:h-8" aria-hidden />
        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-[var(--color-light)] [overflow-wrap:normal] [word-break:normal] md:text-sm">
          {t("logComplete.loggedWith", { app: t("app.name") })}
        </span>
      </div>
    </div>
  );

  const cardContent = (
    <>
      {nativeUi ? topButtonsNative : closeButton}
      {nativeUi ? imageSectionNative : imageSection}
      {contentBlock}
    </>
  );

  /**
   * Share scene: same proportions as the small native reference (320×760 / 348×808) but scaled to
   * SHARE_EXPORT_SCENE_WIDTH_PX so html-to-image captures a large layout + moderate pixelRatio (sharp text,
   * stable filters). Footer uses a plain <img> logo — `Logo`’s mix-blend-lighten often disappears in capture.
   * BGG: shorter hero matches modal (7/8 vs 2/3 → scale hero by 16/21); scene and card max shrink by the same delta.
   */
  const shareBase = (() => {
    const compact = { sceneH: 760, cardW: 288, cardMaxH: 604, heroH: 348, refSceneW: 320 };
    const wide = { sceneH: 808, cardW: 308, cardMaxH: 652, heroH: 382, refSceneW: 348 };
    if (!bggShorterCard) {
      return compactShareLayout ? compact : wide;
    }
    const bggHeroScale = 16 / 21; // (8/7) / (3/2): modal BGG aspect 7/8 vs default 2/3
    const pick = compactShareLayout ? compact : wide;
    const heroH = Math.max(1, Math.round(pick.heroH * bggHeroScale));
    const delta = pick.heroH - heroH;
    return {
      ...pick,
      heroH,
      sceneH: pick.sceneH - delta,
      cardMaxH: pick.cardMaxH - delta,
    };
  })();
  const shareLayoutScale = SHARE_EXPORT_SCENE_WIDTH_PX / shareBase.refSceneW;
  const sz = (n: number) => Math.max(1, Math.round(n * shareLayoutScale));
  const shareSceneWidth = SHARE_EXPORT_SCENE_WIDTH_PX;
  const shareSceneHeight = sz(shareBase.sceneH);
  const shareCardWidth = sz(shareBase.cardW);
  const shareCardMaxHeight = sz(shareBase.cardMaxH);
  const shareHeroHeight = sz(shareBase.heroH);
  const shareOuterPad = sz(20);
  const shareCardRadius = sz(20);
  const shareBlurBgLight = Math.min(48, sz(4));
  const shareBlurBgDark = Math.min(56, sz(10));
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
              filter: isLight ? `blur(${shareBlurBgLight}px)` : `blur(${shareBlurBgDark}px)`,
              WebkitFilter: isLight ? `blur(${shareBlurBgLight}px)` : `blur(${shareBlurBgDark}px)`,
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
            padding: shareOuterPad,
          }}
        >
          <div
            style={{
              position: "relative",
              width: shareCardWidth,
              maxWidth: shareCardWidth,
              maxHeight: shareCardMaxHeight,
              overflow: "hidden",
              borderRadius: shareCardRadius,
              border: `1px solid ${nativeColors.border}`,
              backgroundColor: nativeColors.cardBg,
              color: nativeColors.text,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Hero: fixed height; title/review scroll above pinned footer */}
            <div style={{ position: "relative", width: "100%", height: shareHeroHeight, flexShrink: 0, overflow: "hidden" }}>
              {cachedHeroDataUrl ? (
                bggBoardFraming ? (
                  <>
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
                        transform: "scale(1.12)",
                        filter: isLight ? `blur(${Math.min(shareHeroHeight * 0.05, 28)}px)` : `blur(${Math.min(shareHeroHeight * 0.06, 36)}px)`,
                        WebkitFilter: isLight ? `blur(${Math.min(shareHeroHeight * 0.05, 28)}px)` : `blur(${Math.min(shareHeroHeight * 0.06, 36)}px)`,
                        opacity: 0.68,
                        display: "block",
                      }}
                    />
                    <img
                      src={cachedHeroDataUrl}
                      alt=""
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 1,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        objectPosition: "center",
                        display: "block",
                      }}
                    />
                  </>
                ) : (
                  <img
                    src={cachedHeroDataUrl}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center",
                      display: "block",
                    }}
                  />
                )
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
                  zIndex: 2,
                  background: `linear-gradient(to top, ${nativeColors.cardBg} 0%, transparent 40%)`,
                }}
              />
            </div>
            {/* Scrollable body only — footer below is full card width so branding never wraps in a narrow column. */}
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                padding: `${sz(8)}px ${sz(12)}px ${sz(6)}px`,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  marginBottom: sz(6),
                  borderRadius: 9999,
                  padding: `${sz(3)}px ${sz(8)}px`,
                  fontSize: sz(9),
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
                  marginBottom: sz(6),
                  fontSize: sz(16),
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
                <div style={{ marginBottom: sz(6), color: "#fbbf24", fontSize: sz(18), letterSpacing: "0.05em" }}>
                  {"★".repeat(Math.round(stars))}{"☆".repeat(5 - Math.round(stars))}
                </div>
              )}
              {showCollectionOwnershipMeta &&
                (own != null ||
                  wantToBuy != null ||
                  (showBoardGameMatchesMeta && matchesPlayed != null && matchesPlayed > 0)) && (
                <div style={{ marginBottom: sz(6), fontSize: sz(11), color: nativeColors.textMuted }}>
                  {own != null && (
                    <span>{t("itemReviewForm.own")}: {own ? t("common.yes") : t("common.no")}</span>
                  )}
                  {wantToBuy != null && (
                    <span style={{ marginLeft: 10 }}>
                      {t("itemReviewForm.wantToBuy")}: {wantToBuy ? t("common.yes") : t("common.no")}
                    </span>
                  )}
                  {showBoardGameMatchesMeta && matchesPlayed != null && matchesPlayed > 0 && (
                    <span style={{ marginLeft: 10 }}>{t("itemReviewForm.matchesPlayed")}: {matchesPlayed}</span>
                  )}
                </div>
              )}
              {review != null && review.trim() !== "" && (
                <p
                  style={{
                    marginBottom: sz(4),
                    fontSize: sz(10),
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
            </div>
            <div
              style={{
                flexShrink: 0,
                flexGrow: 0,
                width: "100%",
                boxSizing: "border-box",
                padding: compactShareLayout
                  ? `${sz(8)}px ${sz(12)}px ${sz(10)}px`
                  : `${sz(10)}px ${sz(12)}px ${sz(12)}px`,
                borderTop: `1px solid ${nativeColors.textMuted}4D`,
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "flex-start",
                columnGap: compactShareLayout ? sz(6) : sz(8),
                rowGap: sz(4),
              }}
            >
              <img
                src={getLogoSrc(theme.colorScheme)}
                alt=""
                aria-hidden
                style={{
                  display: "block",
                  height: compactShareLayout ? sz(14) : sz(20),
                  width: "auto",
                  flexShrink: 0,
                  objectFit: "contain",
                  opacity: 0.9,
                }}
              />
              <span
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  fontSize: compactShareLayout ? sz(9) : sz(11),
                  fontWeight: 500,
                  lineHeight: 1.35,
                  color: nativeColors.textMuted,
                  whiteSpace: "normal",
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
                }}
              >
                {t("logComplete.loggedWith", { app: t("app.name") })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /** Capacitor + optional web: share button and native card layout. Share image = DOM capture of share card (matches modal). */
  if (nativeUi) {
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
            backgroundImage: heroImageUrl ? cssBackgroundImageUrl(heroImageUrl) : undefined,
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
        {/* flex-1 min-h-0 bounds card height so inner contentBlock can scroll; no overlay scroll. */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-4">
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
          backgroundImage: heroImageUrl ? cssBackgroundImageUrl(heroImageUrl) : undefined,
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
