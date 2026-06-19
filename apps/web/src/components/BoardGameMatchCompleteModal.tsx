import { useEffect, useRef, useState } from "react";
import { motion, useIsPresent } from "framer-motion";
import { Calendar, Clock, Loader2, Share2, Trophy, X } from "lucide-react";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { ItemImage } from "@/components/ItemImage";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Logo, getLogoSrc } from "@/components/Logo";
import { getHeroImageUrl, cssBackgroundImageUrl } from "@/lib/getHeroImageUrl";
import { isBggBoardGameImageContext } from "@/lib/boardGameImageFit";
import {
  logCompleteAndroidHeroImgClass,
  logCompleteHeroFrameStyle,
  logCompleteHeroWrapperClass,
  logCompletePrioritizeTextSpace,
  logCompleteUsesContainBackdrop,
  resolveLogCompleteHeroLayout,
  type ImageNaturalSize,
} from "@/lib/logCompleteHeroLayout";
import { overlayVariants, modalContentVariants } from "@/lib/animations";
import { DEFAULT_BOARD_GAME_SESSION_DURATION_HOURS, type BoardGameSessionDurationHours } from "@geeklogs/shared";
import { showErrorToast } from "@/lib/errorToast";
import { triggerImpact } from "@/lib/capacitorHaptics";
import { useAndroidOverlayBack } from "@/hooks/useAndroidOverlayBack";
import { isCapacitorAndroid } from "@/lib/androidOverlayBack";
import type { BoardGameMatchCompleteState } from "@/lib/boardGameMatchComplete";
import { boardGameSessionDurationLabel } from "@/lib/boardGameSessionDuration";

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

const USE_NATIVE_LAYOUT_ON_WEB = false;
const SHARE_EXPORT_SCENE_WIDTH_PX = 1080;
const SHARE_CAPTURE_PIXEL_RATIO = 2;

const NATIVE_DARK = {
  cardBg: "#1c1c1c",
  text: "#f0f0f0",
  textMuted: "#a3a3a3",
  border: "#2e2e2e",
  overlay: "rgba(12,12,12,0.65)",
} as const;
const NATIVE_LIGHT = {
  cardBg: "#ffffff",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  overlay: "rgba(255,255,255,0.82)",
} as const;

interface BoardGameMatchCompleteModalProps {
  state: BoardGameMatchCompleteState;
  onClose: () => void;
}

export function BoardGameMatchCompleteModal({ state, onClose }: BoardGameMatchCompleteModalProps) {
  const overlayPresent = useIsPresent();
  useAndroidOverlayBack(overlayPresent, onClose);
  const { t, locale } = useLocale();
  const { me } = useMe();
  const theme = useTheme();
  const isNative = useIsNative();
  const nativeUi = isNative || USE_NATIVE_LAYOUT_ON_WEB;
  const androidWebView = isCapacitorAndroid();
  const isLight = theme.colorScheme === "light";
  const nativeColors = isLight ? NATIVE_LIGHT : NATIVE_DARK;

  const { image, title, grade, matchesPlayed, match, mediaType = "boardgames" } = state;
  const stars = grade != null ? gradeToStars(grade) : null;
  const durationHours = (match.durationHours ?? DEFAULT_BOARD_GAME_SESSION_DURATION_HOURS) as BoardGameSessionDurationHours;
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [shareInProgress, setShareInProgress] = useState(false);
  const [heroNaturalSize, setHeroNaturalSize] = useState<ImageNaturalSize | null>(null);
  const [cachedHeroDataUrl, setCachedHeroDataUrl] = useState<string | null>(null);

  const heroImageUrl = getHeroImageUrl(image) ?? image;
  const assumeLandscapeBoardGame = isBggBoardGameImageContext(
    mediaType,
    heroImageUrl,
    null,
    me?.boardGameProvider ?? null
  );
  const androidHeroLayout = androidWebView && nativeUi;
  const heroLayout = resolveLogCompleteHeroLayout(heroNaturalSize, assumeLandscapeBoardGame);
  const useContainBackdrop = logCompleteUsesContainBackdrop(heroLayout, androidHeroLayout);
  const prioritizeText = nativeUi && logCompletePrioritizeTextSpace("", title);

  const isPlayedToday = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const formatPlayed = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  };

  const playedDateLabel = isPlayedToday(match.playedAt)
    ? t("boardGameMatches.today")
    : formatPlayed(match.playedAt);

  useEffect(() => {
    if (!heroImageUrl) {
      setCachedHeroDataUrl(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        setCachedHeroDataUrl(canvas.toDataURL("image/png"));
      } catch {
        setCachedHeroDataUrl(heroImageUrl);
      }
    };
    img.onerror = () => {
      if (!cancelled) setCachedHeroDataUrl(heroImageUrl);
    };
    img.src = heroImageUrl;
    return () => {
      cancelled = true;
    };
  }, [heroImageUrl]);

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      aria-label={t("common.close")}
      className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border-0 bg-black/70 text-white md:right-4 md:top-4 md:h-10 md:w-10"
    >
      <X className="h-5 w-5" />
    </button>
  );

  const closeButtonNative = (
    <button
      type="button"
      onClick={onClose}
      aria-label={t("common.close")}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-black/80 text-white md:h-10 md:w-10"
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
    const dialogTitle = t("boardGameMatchComplete.shareTitle", { title });
    const fileName = "board-game-match-share.png";
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
        await navigator.share({ files: [file], title: dialogTitle });
        triggerImpact("light");
        return;
      }

      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const path = fileName;
      await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path });
      await Share.share({ files: [uri], dialogTitle, text: " " });
      triggerImpact("light");
    } catch (err) {
      showErrorToast(t, "E015", { originalError: err });
    } finally {
      setShareInProgress(false);
    }
  };

  const shareButtonNative = (
    <button
      type="button"
      onClick={(e) => void handleShare(e)}
      disabled={shareInProgress}
      aria-label={t("common.share")}
      aria-busy={shareInProgress}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-black/80 text-white disabled:opacity-60 md:h-10 md:w-10"
      style={{ transform: "none", willChange: "auto" }}
    >
      {shareInProgress ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Share2 className="h-5 w-5" />}
    </button>
  );

  const topButtonsNative = (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-2 md:right-4 md:top-4">
      {shareButtonNative}
      {closeButtonNative}
    </div>
  );

  const heroWrapperClass = logCompleteHeroWrapperClass({
    layout: heroLayout,
    androidWebView: androidHeroLayout,
    compactForText: prioritizeText,
  });
  const heroFrameStyle = logCompleteHeroFrameStyle({
    natural: heroNaturalSize,
    layout: heroLayout,
    androidWebView: androidHeroLayout,
    compactForText: prioritizeText,
  });

  const heroImage = (
    <ItemImage
      src={heroImageUrl}
      className="absolute inset-0 h-full w-full"
      mediaType={mediaType}
      activeBoardGameProvider={me?.boardGameProvider ?? null}
      containBackdrop={useContainBackdrop}
      imgClassName={androidHeroLayout ? logCompleteAndroidHeroImgClass(heroLayout) : undefined}
      fitContent={false}
      loading="eager"
      referrerPolicy="no-referrer"
      onImageNaturalDimensions={(width, height) => setHeroNaturalSize({ width, height })}
    />
  );

  const imageSection = (
    <div className="relative flex-shrink-0 overflow-hidden rounded-t-2xl md:rounded-t-3xl">
      <div className={heroWrapperClass} style={heroFrameStyle ?? undefined}>
        {heroImage}
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background: "linear-gradient(to top, var(--color-dark) 0%, transparent 40%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );

  const matchDetailsBlock = (
    <ul className="m-0 mb-3 flex list-none flex-col gap-1.5 p-0">
      {match.players.map((p, i) => (
        <li
          key={i}
          className={
            p.winner
              ? "flex items-center justify-between gap-2 rounded-lg border border-amber-400/35 bg-gradient-to-r from-amber-500/10 to-transparent px-2.5 py-1.5"
              : "flex items-center justify-between gap-2 rounded-lg border border-[var(--color-mid)]/15 bg-[var(--color-mid)]/5 px-2.5 py-1.5"
          }
        >
          <span className="min-w-0 truncate text-xs font-medium text-[var(--color-lightest)]">{p.name}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {p.score != null && (
              <span className="text-[11px] tabular-nums text-[var(--color-light)]">
                {p.score} {t("boardGameMatches.points")}
              </span>
            )}
            {p.winner && <Trophy className="h-3.5 w-3.5 text-amber-400" aria-hidden />}
          </div>
        </li>
      ))}
    </ul>
  );

  const sessionMetaRow = (
    <div className="mb-2 flex items-center justify-between gap-2 md:mb-3">
      <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium text-[var(--color-light)] md:gap-1.5 md:text-xs">
        <Calendar className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{playedDateLabel}</span>
      </span>
      {matchesPlayed != null && (
        <span className="shrink-0 rounded-full bg-[var(--color-mid)]/25 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-lightest)] ring-1 ring-[var(--color-mid)]/20 md:px-2.5 md:text-[10px]">
          {t("itemReviewForm.matchesPlayed")}: {matchesPlayed}
        </span>
      )}
      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-[var(--color-light)] md:gap-1.5 md:text-xs">
        <Clock className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        {boardGameSessionDurationLabel(durationHours, t)}
      </span>
    </div>
  );

  const contentBlock = (
    <div
      className={
        nativeUi
          ? "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 pb-4 pt-3 [-webkit-overflow-scrolling:touch] md:px-6 md:pb-6 md:pt-5"
          : "flex flex-col px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-5"
      }
      style={nativeUi ? { transform: "none", willChange: "auto" } : undefined}
    >
      {sessionMetaRow}
      <div
        id="board-game-match-complete-title"
        role="heading"
        aria-level={1}
        className={
          nativeUi
            ? "mb-2 min-w-0 break-words text-lg font-bold leading-snug text-[var(--color-lightest)] [overflow-wrap:anywhere] line-clamp-3"
            : "mb-2 min-w-0 break-words text-lg font-bold leading-tight text-[var(--color-lightest)] md:mb-3 md:text-[1.75rem]"
        }
      >
        {title}
      </div>
      {grade != null && stars != null && (
        <div className="mb-2 flex items-center gap-1 md:mb-3">
          <StarRating value={stars} readOnly size="lg" showGradeText={false} />
        </div>
      )}
      {matchDetailsBlock}
      <div className={nativeUi ? "mt-auto flex w-full shrink-0 flex-nowrap items-center gap-1.5 border-t border-[var(--color-mid)]/30 pt-3 md:gap-2 md:pt-4" : "flex w-full shrink-0 flex-nowrap items-center gap-1.5 border-t border-[var(--color-mid)]/30 pt-3 md:gap-2 md:pt-4"}>
        <Logo alt="" className="h-7 w-auto shrink-0 opacity-90 md:h-8" aria-hidden />
        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-[var(--color-light)] md:text-sm">
          {t("boardGameMatchComplete.loggedWith", { app: t("app.name") })}
        </span>
      </div>
    </div>
  );

  const cardContent = (
    <>
      {nativeUi ? topButtonsNative : closeButton}
      {imageSection}
      {contentBlock}
    </>
  );

  const shareSceneW = SHARE_EXPORT_SCENE_WIDTH_PX;
  const shareSceneH = Math.round(shareSceneW * 1.35);
  const shareCardW = Math.round(shareSceneW * 0.88);
  const shareHeroH = Math.round(shareCardW * 0.42);
  const sharePad = Math.round(shareSceneW * 0.04);

  const shareCard = (
    <div
      style={{ position: "absolute", left: -9999, top: 0, width: shareSceneW, height: shareSceneH, pointerEvents: "none" }}
      aria-hidden
    >
      <div ref={shareCardRef} style={{ position: "relative", width: shareSceneW, height: shareSceneH, overflow: "hidden" }}>
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
              filter: isLight ? "blur(4px)" : "blur(10px)",
              transform: "scale(1.25)",
            }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, backgroundColor: nativeColors.overlay }} aria-hidden />
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", padding: sharePad }}>
          <div
            style={{
              width: shareCardW,
              maxHeight: shareSceneH - sharePad * 2,
              overflow: "hidden",
              borderRadius: 20,
              border: `1px solid ${nativeColors.border}`,
              backgroundColor: nativeColors.cardBg,
              color: nativeColors.text,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ position: "relative", width: "100%", height: shareHeroH, flexShrink: 0, overflow: "hidden" }}>
              {cachedHeroDataUrl ? (
                <img src={cachedHeroDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: nativeColors.border }} />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to top, #1c1c1c 0%, transparent 50%)",
                }}
              />
            </div>
            <div style={{ padding: sharePad, flex: 1, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                  fontSize: 10,
                  color: nativeColors.textMuted,
                }}
              >
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {playedDateLabel}
                </span>
                {matchesPlayed != null && (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "3px 8px",
                      borderRadius: 999,
                      backgroundColor: `${nativeColors.textMuted}22`,
                      border: `1px solid ${nativeColors.border}`,
                      color: nativeColors.text,
                    }}
                  >
                    {t("itemReviewForm.matchesPlayed")}: {matchesPlayed}
                  </span>
                )}
                <span style={{ flexShrink: 0 }}>{boardGameSessionDurationLabel(durationHours, t)}</span>
              </div>
              <h1 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, lineHeight: 1.25, color: nativeColors.text }}>
                {title}
              </h1>
              {grade != null && stars != null && (
                <div style={{ marginBottom: 8, color: "#fbbf24", fontSize: 16 }}>
                  {"★".repeat(Math.round(stars)) + "☆".repeat(5 - Math.round(stars))}
                </div>
              )}
              {match.players.slice(0, 6).map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    marginBottom: 3,
                    color: p.winner ? "#fbbf24" : nativeColors.textMuted,
                  }}
                >
                  <span>{p.name}</span>
                  <span>{p.score != null ? `${p.score} ${t("boardGameMatches.points")}` : ""}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                padding: `${sharePad * 0.6}px ${sharePad}px`,
                borderTop: `1px solid ${nativeColors.border}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <img src={getLogoSrc(theme.colorScheme)} alt="" style={{ height: 18, width: "auto", opacity: 0.9 }} />
              <span style={{ fontSize: 10, color: nativeColors.textMuted }}>
                {t("boardGameMatchComplete.loggedWith", { app: t("app.name") })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const overlayClassNative =
    "fixed inset-0 z-[200] flex flex-col overflow-hidden bg-black/40";
  const cardClassNative =
    "relative flex max-h-[min(92dvh,760px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl md:max-w-lg md:rounded-3xl";

  if (nativeUi) {
    return (
      <div
        className={overlayClassNative}
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-game-match-complete-title"
        onClick={onClose}
      >
        {shareCard}
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: heroImageUrl ? cssBackgroundImageUrl(heroImageUrl) : undefined,
            backgroundSize: "cover",
            ...(androidWebView
              ? { filter: "none", WebkitFilter: "none", transform: "none" }
              : {
                  filter: isLight ? "blur(4px)" : "blur(10px)",
                  WebkitFilter: isLight ? "blur(4px)" : "blur(10px)",
                  transform: "scale(1.25)",
                }),
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: nativeColors.overlay }} aria-hidden />
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
              ["--color-dark" as string]: nativeColors.cardBg,
              ["--color-darkest" as string]: nativeColors.cardBg,
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
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-game-match-complete-title"
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
      <div className="pointer-events-none absolute inset-0 bg-[var(--color-darkest)]/70" aria-hidden />
      <motion.article
        className="relative z-10 my-auto flex w-full max-w-md flex-col rounded-2xl border border-[var(--color-mid)]/30 bg-[var(--color-dark)] shadow-2xl md:max-w-lg md:rounded-3xl"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={modalContentVariants}
        onClick={(e) => e.stopPropagation()}
      >
        {cardContent}
      </motion.article>
    </motion.div>
  );
}
