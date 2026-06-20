export type LogCompleteHeroLayout = "portrait" | "square" | "landscape";

export type ImageNaturalSize = { width: number; height: number };

const PORTRAIT_MAX_RATIO = 0.88;
const LANDSCAPE_MIN_RATIO = 1.12;

export function classifyImageAspectRatio(width: number, height: number): LogCompleteHeroLayout {
  if (width <= 0 || height <= 0) return "portrait";
  const ratio = width / height;
  if (ratio >= LANDSCAPE_MIN_RATIO) return "landscape";
  if (ratio <= PORTRAIT_MAX_RATIO) return "portrait";
  return "square";
}

export function resolveLogCompleteHeroLayout(
  natural: ImageNaturalSize | null,
  assumeLandscapeBoardGame: boolean
): LogCompleteHeroLayout {
  if (natural) return classifyImageAspectRatio(natural.width, natural.height);
  return assumeLandscapeBoardGame ? "landscape" : "portrait";
}

/** Blurred letterbox fill for square/landscape in fixed frames (web). Disabled on Android — cover + intrinsic aspect instead. */
export function logCompleteUsesContainBackdrop(
  layout: LogCompleteHeroLayout,
  androidWebView = false
): boolean {
  if (androidWebView) return false;
  return layout === "square" || layout === "landscape";
}

export type LogCompleteHeroFrameStyle = {
  width: string;
  minHeight: string;
  /** Full-width portrait slot height (no aspect-ratio shrink → no side letterbox). */
  height?: string;
  maxHeight?: string;
  aspectRatio?: string;
};

/** Android hero image fit: portrait/square fill the frame; landscape stays contained. */
export function logCompleteAndroidHeroImgClass(layout: LogCompleteHeroLayout): string {
  return layout === "landscape" ? "object-contain object-center" : "object-cover object-center";
}

/** Android hero vertical budget: portrait tallest, square mid, landscape shortest. */
export function androidHeroVerticalBounds(
  layout: LogCompleteHeroLayout,
  compactForText?: boolean
): { maxHeight: string; minHeight: string } {
  switch (layout) {
    case "square":
      return compactForText
        ? { maxHeight: "min(42dvh, 380px)", minHeight: "min(28dvh, 240px)" }
        : { maxHeight: "min(52dvh, 460px)", minHeight: "min(34dvh, 300px)" };
    case "landscape":
      return compactForText
        ? { maxHeight: "min(30dvh, 260px)", minHeight: "min(18dvh, 140px)" }
        : { maxHeight: "min(36dvh, 300px)", minHeight: "min(22dvh, 180px)" };
    default:
      return compactForText
        ? { maxHeight: "min(48dvh, 440px)", minHeight: "min(36dvh, 320px)" }
        : { maxHeight: "min(62dvh, 560px)", minHeight: "min(42dvh, 380px)" };
  }
}

function androidHeroPresetAspectRatio(layout: LogCompleteHeroLayout): string {
  switch (layout) {
    case "square":
      return "1 / 1";
    case "landscape":
      return "4 / 3";
    default:
      return "2 / 3";
  }
}

/** Android hero frame: intrinsic aspect when measured, else portrait/square/landscape preset. */
export function logCompleteHeroFrameStyle(opts: {
  natural: ImageNaturalSize | null;
  layout: LogCompleteHeroLayout;
  androidWebView: boolean;
  compactForText?: boolean;
}): LogCompleteHeroFrameStyle | undefined {
  const { natural, layout, androidWebView, compactForText } = opts;
  if (!androidWebView) return undefined;
  const bounds = androidHeroVerticalBounds(layout, compactForText);
  if (layout === "portrait") {
    return {
      width: "100%",
      height: bounds.maxHeight,
      minHeight: bounds.minHeight,
    };
  }
  const aspectRatio = hasMeasuredNatural(natural)
    ? `${natural.width} / ${natural.height}`
    : androidHeroPresetAspectRatio(layout);
  return {
    width: "100%",
    aspectRatio,
    maxHeight: bounds.maxHeight,
    minHeight: bounds.minHeight,
  };
}

function hasMeasuredNatural(natural: ImageNaturalSize | null | undefined): natural is ImageNaturalSize {
  return natural != null && natural.width > 0 && natural.height > 0;
}

export function logCompletePrioritizeTextSpace(
  review: string | null | undefined,
  title: string
): boolean {
  const reviewLen = (review ?? "").trim().length;
  const titleLen = title.trim().length;
  return reviewLen > 80 || titleLen > 48;
}

export function logCompleteHeroWrapperClass(opts: {
  layout: LogCompleteHeroLayout;
  androidWebView: boolean;
  /** Shrink hero so the scrollable text block gets more room (native long copy). */
  compactForText?: boolean;
}): string {
  const { layout, androidWebView, compactForText } = opts;
  const base = "relative w-full md:h-auto md:min-h-0";

  if (androidWebView) {
    return cnJoin(base, "w-full");
  }

  switch (layout) {
    case "square":
      return cnJoin(
        base,
        compactForText
          ? "aspect-square min-h-[140px] max-h-[min(34vh,300px)] md:max-h-[min(32vh,280px)]"
          : "aspect-square min-h-[160px] max-h-[min(42vh,380px)] md:max-h-[min(40vh,360px)]"
      );
    case "landscape":
      return cnJoin(
        base,
        compactForText
          ? "h-[28vh] min-h-[112px] max-h-[min(32vh,280px)] md:aspect-[4/3] md:max-h-[min(30vh,260px)]"
          : "h-[34vh] min-h-[128px] max-h-[min(38vh,340px)] md:aspect-[4/3] md:max-h-[min(36vh,320px)]"
      );
    default:
      return cnJoin(
        base,
        compactForText
          ? "h-[48vh] min-h-[168px] max-h-[min(50vh,420px)] md:aspect-[2/3] md:max-h-[min(52vh,440px)]"
          : "h-[60vh] min-h-[190px] md:aspect-[2/3] md:max-h-none"
      );
  }
}

function cnJoin(...parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Share PNG hero height scale vs portrait baseline (2/3 slot). */
export function logCompleteShareHeroScale(layout: LogCompleteHeroLayout): number {
  switch (layout) {
    case "square":
      return 5 / 6;
    case "landscape":
      return 8 / 10;
    default:
      return 1;
  }
}

export type LogCompleteShareTextLimits = {
  titleLineClamp: number;
  reviewLineClamp: number;
};

/**
 * Share PNG line clamps (html-to-image cannot scroll). Mirrors modal generosity but caps
 * so copy stays inside the card.
 */
export function logCompleteShareTextLimits(
  review: string | null | undefined,
  title: string
): LogCompleteShareTextLimits {
  const reviewLen = (review ?? "").trim().length;
  const titleLen = title.trim().length;
  const longCopy = logCompletePrioritizeTextSpace(review, title);

  let titleLineClamp = titleLen > 56 ? 3 : 4;

  let reviewLineClamp = 0;
  if (reviewLen > 0) {
    if (reviewLen <= 60) reviewLineClamp = 5;
    else if (reviewLen <= 120) reviewLineClamp = 6;
    else if (reviewLen <= 200) reviewLineClamp = 8;
    else if (reviewLen <= 320) reviewLineClamp = 10;
    else reviewLineClamp = 12;
  }

  if (longCopy) {
    titleLineClamp = Math.min(titleLineClamp, 3);
    reviewLineClamp = Math.min(reviewLineClamp + 2, 12);
  } else {
    reviewLineClamp = Math.min(reviewLineClamp, 8);
  }

  return { titleLineClamp, reviewLineClamp };
}

/** Extra hero height reclaimed for text on share cards when copy is long. */
export function logCompleteShareHeroShrinkForText(
  heroH: number,
  prioritizeText: boolean,
  layout: LogCompleteHeroLayout = "portrait"
): number {
  if (!prioritizeText || heroH <= 0) return 0;
  if (layout === "portrait") return Math.max(16, Math.round(heroH * 0.1));
  return Math.max(24, Math.round(heroH * 0.18));
}

export type LogCompleteShareLayoutMetrics = {
  sceneH: number;
  cardW: number;
  cardMaxH: number;
  heroH: number;
  refSceneW: number;
};

const SHARE_CARD = {
  compact: { cardW: 288, refSceneW: 320 },
  wide: { cardW: 308, refSceneW: 348 },
} as const;

/** Min space below hero for status, title, review clamps, and footer. */
const SHARE_BODY_RESERVE = 212;

const SHARE_HERO_MAX: Record<
  "compact" | "wide",
  Record<LogCompleteHeroLayout, number>
> = {
  compact: { portrait: 456, square: 288, landscape: 248 },
  wide: { portrait: 492, square: 308, landscape: 268 },
};

function shareHeroHeightForLayout(
  cardW: number,
  layout: LogCompleteHeroLayout,
  natural: ImageNaturalSize | null | undefined
): number {
  if (layout === "square") return cardW;
  if (hasMeasuredNatural(natural)) {
    return Math.round(cardW * (natural.height / natural.width));
  }
  if (layout === "landscape") return Math.round(cardW * (3 / 4));
  return Math.round(cardW * (3 / 2));
}

function buildShareLayoutMetrics(
  opts: {
    heroLayout: LogCompleteHeroLayout;
    compactShareLayout: boolean;
    prioritizeText: boolean;
    natural?: ImageNaturalSize | null;
  },
  bodyReserve: number
): LogCompleteShareLayoutMetrics {
  const key = opts.compactShareLayout ? "compact" : "wide";
  const { cardW, refSceneW } = SHARE_CARD[key];
  const maxH = SHARE_HERO_MAX[key][opts.heroLayout];
  let heroH = Math.min(maxH, shareHeroHeightForLayout(cardW, opts.heroLayout, opts.natural));
  heroH = Math.max(1, heroH);
  const textShrink = logCompleteShareHeroShrinkForText(heroH, opts.prioritizeText, opts.heroLayout);
  heroH = Math.max(1, heroH - textShrink);
  const cardMaxH = heroH + bodyReserve;
  const sceneH = cardMaxH + 96;
  return { cardW, refSceneW, heroH, cardMaxH, sceneH };
}

export function buildLogCompleteShareLayout(opts: {
  heroLayout: LogCompleteHeroLayout;
  compactShareLayout: boolean;
  prioritizeText: boolean;
  natural?: ImageNaturalSize | null;
}): LogCompleteShareLayoutMetrics {
  return buildShareLayoutMetrics(opts, SHARE_BODY_RESERVE);
}

/** Share PNG for board game match banner — same phone card proportions as log complete. */
export function buildBoardGameMatchShareLayout(opts: {
  heroLayout: LogCompleteHeroLayout;
  compactShareLayout: boolean;
  prioritizeText: boolean;
  natural?: ImageNaturalSize | null;
  playerCount: number;
  hasGrade: boolean;
}): LogCompleteShareLayoutMetrics {
  const players = Math.min(Math.max(1, opts.playerCount), 8);
  const bodyReserve = 140 + (opts.hasGrade ? 26 : 0) + players * 38;
  return buildShareLayoutMetrics(opts, bodyReserve);
}

/** Share PNG hero fit — same as Android modal (fill portrait/square, contain landscape). */
export function logCompleteShareHeroObjectFit(
  layout: LogCompleteHeroLayout
): "contain" | "cover" {
  return layout === "landscape" ? "contain" : "cover";
}
