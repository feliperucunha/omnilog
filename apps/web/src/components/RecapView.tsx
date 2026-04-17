import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, Share2, X } from "lucide-react";
import type { Log } from "@geeklogs/shared";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { ItemImage } from "@/components/ItemImage";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Logo, getLogoSrc } from "@/components/Logo";
import { getHeroImageUrl, coerceImageUrlString } from "@/lib/getHeroImageUrl";
import { showErrorToast } from "@/lib/errorToast";
import { triggerImpact } from "@/lib/capacitorHaptics";
import { cn } from "@/lib/utils";
import { useAndroidOverlayBack } from "@/hooks/useAndroidOverlayBack";

const SHARE_CAPTURE_PIXEL_RATIO = 2;

/**
 * Off-screen share card: inner bounds passed to `computePack` (below header padding).
 * Taller than wide so native shares read as a phone-style portrait story, not ~square.
 */
/** 1080 card width minus horizontal `p-8` (32+32). */
const SHARE_PACK_INNER_WIDTH_PX = 1016;
const SHARE_PACK_INNER_HEIGHT_PX = 2320;

/** width / height when unknown (portrait-ish poster). */
const DEFAULT_ASPECT = 2 / 3;
const GRID_GAP_PX = 6;
const DECODE_TIMEOUT_MS = 22_000;

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

const NATIVE_DARK = {
  cardBg: "#1c1c1c",
  text: "#f0f0f0",
  textMuted: "#a3a3a3",
  border: "#2e2e2e",
} as const;
const NATIVE_LIGHT = {
  cardBg: "#ffffff",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
} as const;

/** Greedy row wrap: each row width ≤ maxRowW; indices refer to positions in `aspects`. */
function buildRows(aspects: number[], H: number, gap: number, maxRowW: number): number[][] {
  const rows: number[][] = [];
  let cur: number[] = [];
  let curW = 0;
  for (let i = 0; i < aspects.length; i++) {
    const wi = H * aspects[i]!;
    if (cur.length > 0 && curW + gap + wi > maxRowW + 1e-6) {
      rows.push(cur);
      cur = [];
      curW = 0;
    }
    if (cur.length > 0) curW += gap;
    cur.push(i);
    curW += wi;
  }
  if (cur.length > 0) rows.push(cur);
  return rows;
}

function rowsBoundingSize(rows: number[][], aspects: number[], H: number, gap: number): { w: number; h: number } {
  if (rows.length === 0) return { w: 0, h: 0 };
  let maxW = 0;
  for (const row of rows) {
    let rw = 0;
    for (let j = 0; j < row.length; j++) {
      rw += H * aspects[row[j]!]!;
      if (j < row.length - 1) rw += gap;
    }
    maxW = Math.max(maxW, rw);
  }
  const h = rows.length * H + (rows.length - 1) * gap;
  return { w: maxW, h };
}

function maxTileHeightForPack(aspects: number[], availW: number, availH: number, gap: number): number {
  if (aspects.length === 0 || availW < 8 || availH < 8) return 48;
  let lo = 24;
  let hi = Math.min(1600, Math.floor(availH * 2), Math.floor(availW * 4));
  let best = lo;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const rows = buildRows(aspects, mid, gap, availW);
    const { w, h } = rowsBoundingSize(rows, aspects, mid, gap);
    if (w <= availW + 1e-3 && h <= availH + 1e-3) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function computePack(
  aspects: number[],
  availW: number,
  availH: number,
  gap: number
): { H: number; rows: number[][]; scale: number; boxW: number; boxH: number } {
  if (aspects.length === 0) {
    return { H: 48, rows: [], scale: 1, boxW: 0, boxH: 0 };
  }
  const H = maxTileHeightForPack(aspects, availW, availH, gap);
  const rows = buildRows(aspects, H, gap, availW);
  const { w: boxW, h: boxH } = rowsBoundingSize(rows, aspects, H, gap);
  const scale = Math.min(1, availW / Math.max(1, boxW), availH / Math.max(1, boxH));
  return { H, rows, scale: Number.isFinite(scale) ? Math.max(0.05, scale) : 1, boxW, boxH };
}

export interface RecapViewProps {
  title: string;
  logs: Log[];
  onClose: () => void;
}

export function RecapView({ title, logs, onClose }: RecapViewProps) {
  const { t } = useLocale();
  const { me } = useMe();
  const theme = useTheme();
  const isNative = useIsNative();
  const nativeColors = theme.colorScheme === "light" ? NATIVE_LIGHT : NATIVE_DARK;
  const viewportRef = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [aspectByLogId, setAspectByLogId] = useState<Record<string, number>>({});
  const [imagesLayoutReady, setImagesLayoutReady] = useState(false);
  const [pack, setPack] = useState<{ H: number; rows: number[][]; scale: number }>({
    H: 80,
    rows: [],
    scale: 1,
  });
  const [shareInProgress, setShareInProgress] = useState(false);

  const logIdsKey = useMemo(() => logs.map((l) => l.id).join("\0"), [logs]);
  const logIdsKeyRef = useRef(logIdsKey);
  logIdsKeyRef.current = logIdsKey;
  const logsRef = useRef(logs);
  logsRef.current = logs;

  const pendingAspectRef = useRef<Record<string, number>>({});
  const readyIdsRef = useRef<Set<string>>(new Set());

  const aspectArr = useMemo(
    () => logs.map((l) => aspectByLogId[l.id] ?? DEFAULT_ASPECT),
    [logs, aspectByLogId]
  );

  const tryFlushDecode = useCallback((decodeToken: string) => {
    if (decodeToken !== logIdsKeyRef.current) return;
    if (readyIdsRef.current.size < logsRef.current.length) return;
    setAspectByLogId({ ...pendingAspectRef.current });
    setImagesLayoutReady(true);
  }, []);

  useLayoutEffect(() => {
    if (logs.length === 0) {
      setImagesLayoutReady(true);
      setAspectByLogId({});
      setPack({ H: 48, rows: [], scale: 1 });
      return;
    }

    const decodeToken = logIdsKey;
    setImagesLayoutReady(false);
    setAspectByLogId({});
    pendingAspectRef.current = {};
    readyIdsRef.current = new Set();

    for (const log of logs) {
      const url = coerceImageUrlString(getHeroImageUrl(log.image) ?? log.image);
      if (!url) {
        pendingAspectRef.current[log.id] = DEFAULT_ASPECT;
        readyIdsRef.current.add(log.id);
      }
    }
    tryFlushDecode(decodeToken);

    const tout = window.setTimeout(() => {
      if (decodeToken !== logIdsKeyRef.current) return;
      for (const log of logsRef.current) {
        if (readyIdsRef.current.has(log.id)) continue;
        pendingAspectRef.current[log.id] = DEFAULT_ASPECT;
        readyIdsRef.current.add(log.id);
      }
      tryFlushDecode(decodeToken);
    }, DECODE_TIMEOUT_MS);

    return () => window.clearTimeout(tout);
  }, [logIdsKey, logs, tryFlushDecode]);

  const onDecodeNatural = useCallback(
    (logId: string, decodeToken: string, nw: number, nh: number) => {
      if (decodeToken !== logIdsKeyRef.current) return;
      if (!logsRef.current.some((l) => l.id === logId)) return;
      let ratio = DEFAULT_ASPECT;
      if (nw > 0 && nh > 0) {
        const r = nw / nh;
        if (Number.isFinite(r) && r >= 0.2 && r <= 5) ratio = r;
      }
      pendingAspectRef.current[logId] = ratio;
      readyIdsRef.current.add(logId);
      tryFlushDecode(decodeToken);
    },
    [tryFlushDecode]
  );

  const onDecodeError = useCallback(
    (logId: string, decodeToken: string) => {
      if (decodeToken !== logIdsKeyRef.current) return;
      pendingAspectRef.current[logId] = DEFAULT_ASPECT;
      readyIdsRef.current.add(logId);
      tryFlushDecode(decodeToken);
    },
    [tryFlushDecode]
  );

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || logs.length === 0 || !imagesLayoutReady) {
      if (logs.length === 0) setPack({ H: 48, rows: [], scale: 1 });
      return;
    }
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const p = computePack(aspectArr, rect.width, rect.height, GRID_GAP_PX);
      setPack({ H: p.H, rows: p.rows, scale: p.scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [logs.length, aspectArr, logIdsKey, imagesLayoutReady]);

  const sharePack = useMemo(() => {
    if (!imagesLayoutReady || logs.length === 0) {
      return { H: 80, rows: [] as number[][], scale: 1, boxW: 0, boxH: 0 };
    }
    const gap = GRID_GAP_PX * 2;
    return computePack(
      aspectArr,
      SHARE_PACK_INNER_WIDTH_PX,
      SHARE_PACK_INNER_HEIGHT_PX,
      gap
    );
  }, [aspectArr, imagesLayoutReady, logs.length]);

  const handleShare = useCallback(async (): Promise<void> => {
    if (shareInProgress) return;
    const el = shareCardRef.current;
    if (!el) {
      showErrorToast(t, "E015");
      return;
    }
    setShareInProgress(true);
    const dialogTitle = title;
    const fileName = t("recap.shareFileName");
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
        triggerImpact("light");
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
      triggerImpact("light");
    } catch (err) {
      showErrorToast(t, "E015", { originalError: err });
    } finally {
      setShareInProgress(false);
    }
  }, [shareInProgress, t, title, nativeColors.cardBg]);

  useAndroidOverlayBack(true, onClose);

  const starScale =
    Math.min(0.82, Math.max(0.36, (pack.H - 10) / 120)) * 0.78;

  const skeletonCount = Math.min(logs.length, 28);

  const headerBlock = (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 shrink-0 items-center justify-center px-2 pb-2 pt-[max(0.25rem,env(safe-area-inset-top))] pl-[max(0.5rem,env(safe-area-inset-left))]",
        isNative
          ? "pr-[max(5.75rem,env(safe-area-inset-right))] md:pr-[max(6.25rem,env(safe-area-inset-right))]"
          : "pr-[max(3.25rem,env(safe-area-inset-right))]"
      )}
    >
      <div className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-2 md:gap-2.5">
        <Logo
          src={getLogoSrc(theme.colorScheme)}
          alt={t("recap.logoAlt")}
          className="h-8 w-8 shrink-0 rounded-md object-contain md:h-9 md:w-9"
        />
        <h1
          className={cn(
            "min-h-8 min-w-0 text-center text-sm font-semibold leading-snug tracking-tight text-[var(--color-lightest)] md:min-h-9 md:text-base",
            isNative
              ? "max-w-[min(100%,calc(100vw-7.5rem))] md:max-w-[min(100%,calc(100vw-8.5rem))]"
              : "max-w-[min(100%,calc(100vw-5rem))]"
          )}
        >
          {title}
        </h1>
      </div>
      <div className="absolute right-[max(0.25rem,env(safe-area-inset-right))] top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {isNative ? (
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={shareInProgress || logs.length === 0 || !imagesLayoutReady}
            aria-label={t("common.share")}
            aria-busy={shareInProgress}
            className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-black/80 text-white md:h-10 md:w-10 disabled:opacity-50"
            style={{ transform: "none", willChange: "auto" }}
          >
            {shareInProgress ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Share2 className="h-5 w-5" aria-hidden />
            )}
          </button>
        ) : null}
        {isNative ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-black/80 text-white md:h-10 md:w-10"
            style={{ transform: "none", willChange: "auto" }}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full bg-black/75 text-white shadow-lg ring-1 ring-white/20 hover:bg-black/90 hover:text-white md:h-10 md:w-10"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );

  const decodeImgs =
    logs.length > 0 ? (
      <div
        className="pointer-events-none fixed left-0 top-0 -z-10 h-px w-px overflow-hidden opacity-0"
        aria-hidden
      >
        {logs.map((log) => {
          const url = coerceImageUrlString(getHeroImageUrl(log.image) ?? log.image);
          if (!url) return null;
          return (
            <img
              key={`decode-${logIdsKey}-${log.id}`}
              src={url}
              alt=""
              decoding="async"
              loading="eager"
              onLoad={(e) => {
                const el = e.currentTarget;
                onDecodeNatural(log.id, logIdsKey, el.naturalWidth, el.naturalHeight);
              }}
              onError={() => onDecodeError(log.id, logIdsKey)}
            />
          );
        })}
      </div>
    ) : null;

  const renderTile = (log: Log, logIndex: number, H: number) => {
    const hero = getHeroImageUrl(log.image) ?? log.image;
    const stars = log.grade != null ? gradeToStars(log.grade) : null;
    const ar = aspectArr[logIndex] ?? DEFAULT_ASPECT;
    const w = H * ar;
    return (
      <div
        key={log.id}
        className="relative shrink-0 overflow-hidden rounded-lg bg-[var(--color-darkest)] ring-1 ring-black/10 dark:ring-white/10"
        style={{ width: w, height: H }}
      >
        <ItemImage
          src={hero}
          alt=""
          className="absolute inset-0 h-full w-full"
          imgClassName="h-full w-full object-cover object-center"
          mediaType={log.mediaType}
          boardGameSource={log.boardGameSource}
          activeBoardGameProvider={me?.boardGameProvider ?? null}
          loading="eager"
        />
        {stars != null ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent px-0.5 pb-0.5 pt-3"
            style={{ transform: `scale(${starScale})`, transformOrigin: "bottom center" }}
          >
            <StarRating value={stars} readOnly size="sm" className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]" />
          </div>
        ) : null}
      </div>
    );
  };

  const skeletonBody = (
    <div
      ref={viewportRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-2"
      aria-busy="true"
      aria-label={t("recap.loadingCovers")}
    >
      <div className="mb-4 flex items-center gap-2 text-sm text-[var(--color-light)]">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        <span>{t("recap.loadingCovers")}</span>
      </div>
      <div
        className="grid w-full max-w-4xl justify-items-center gap-2"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(3.5rem, 1fr))",
        }}
      >
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div
            key={i}
            className="aspect-[2/3] w-full max-w-[5.5rem] animate-pulse rounded-lg bg-[var(--color-mid)]/20"
          />
        ))}
      </div>
    </div>
  );

  const gridBody = (
    <div
      ref={viewportRef}
      className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden"
    >
      <div
        className="flex max-h-full max-w-full flex-col items-center justify-center"
        style={{
          gap: GRID_GAP_PX,
          transform: pack.scale < 0.999 ? `scale(${pack.scale})` : undefined,
          transformOrigin: "center center",
        }}
      >
        {pack.rows.map((row, ri) => (
          <div key={ri} className="flex shrink-0 flex-row items-stretch justify-center" style={{ gap: GRID_GAP_PX }}>
            {row.map((logIndex) => renderTile(logs[logIndex]!, logIndex, pack.H))}
          </div>
        ))}
      </div>
    </div>
  );

  const shareGap = GRID_GAP_PX * 2;
  const shareGrid =
    imagesLayoutReady && logs.length > 0 ? (
      <div
        className="flex flex-col items-center justify-center"
        style={{
          gap: shareGap,
          transform: sharePack.scale < 0.999 ? `scale(${sharePack.scale})` : undefined,
          transformOrigin: "center center",
        }}
      >
        {sharePack.rows.map((row, ri) => (
          <div key={`s-${ri}`} className="flex shrink-0 flex-row items-stretch justify-center" style={{ gap: shareGap }}>
            {row.map((logIndex) => {
              const log = logs[logIndex]!;
              const hero = getHeroImageUrl(log.image) ?? log.image;
              const stars = log.grade != null ? gradeToStars(log.grade) : null;
              const ar = aspectArr[logIndex] ?? DEFAULT_ASPECT;
              const w = sharePack.H * ar;
              return (
                <div
                  key={`share-${log.id}`}
                  className="relative shrink-0 overflow-hidden rounded-xl"
                  style={{ width: w, height: sharePack.H, backgroundColor: "#0f0f0f" }}
                >
                  <ItemImage
                    src={hero}
                    alt=""
                    className="absolute inset-0 h-full w-full"
                    imgClassName="h-full w-full object-cover object-center"
                    mediaType={log.mediaType}
                    boardGameSource={log.boardGameSource}
                    activeBoardGameProvider={me?.boardGameProvider ?? null}
                    loading="eager"
                  />
                  {stars != null ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/75 to-transparent px-1 pb-1 pt-5"
                      style={{ transform: "scale(0.82)", transformOrigin: "bottom center" }}
                    >
                      <StarRating value={stars} readOnly size="md" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col overflow-hidden overscroll-none bg-[var(--color-dark)]",
        "h-[100dvh] max-h-[100dvh] w-[100dvw] max-w-[100dvw]",
        "pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {decodeImgs}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {headerBlock}
        {logs.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-[var(--color-light)]">
            {t("recap.empty")}
          </p>
        ) : !imagesLayoutReady ? (
          skeletonBody
        ) : (
          gridBody
        )}
      </div>

      <div
        className="pointer-events-none fixed -left-[10000px] top-0 flex w-[1080px] flex-col overflow-visible bg-[var(--color-dark)] p-6"
        aria-hidden
      >
        <div
          ref={shareCardRef}
          className="flex w-[1080px] flex-col overflow-hidden rounded-2xl p-8"
          style={{
            backgroundColor: nativeColors.cardBg,
            color: nativeColors.text,
            border: `1px solid ${nativeColors.border}`,
          }}
        >
          <div className="mb-6 flex flex-wrap items-center justify-center gap-4 px-2">
            <img src={getLogoSrc(theme.colorScheme)} alt="" width={48} height={48} className="rounded-lg" />
            <p
              className="max-w-full text-center text-3xl font-semibold leading-snug"
              style={{ color: nativeColors.text }}
            >
              {title}
            </p>
          </div>
          <div
            className="flex w-full items-center justify-center"
            style={{ minHeight: SHARE_PACK_INNER_HEIGHT_PX }}
          >
            {shareGrid}
          </div>
        </div>
      </div>
    </div>
  );
}
