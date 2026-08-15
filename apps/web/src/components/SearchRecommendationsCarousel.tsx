import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import type { BoardGameProvider, MediaType, SearchResult } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { searchResultLogIndicators } from "@/lib/searchResultLogIndicators";
import { useLocale } from "@/contexts/LocaleContext";
import { ItemImage } from "@/components/ItemImage";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { BookPagesBadge } from "@/components/BookPagesBadge";
import { GenreBadges } from "@/components/GenreBadges";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { getLogCardDisplay } from "@/lib/logDisplay";
import type { LogIndexEntry } from "@/lib/logsPageCache";
import { RECOMMENDATION_CARD_BODY, RECOMMENDATION_CARD_WIDTH } from "@/lib/logCardLayout";
import { formatTimeToBeatHours } from "@/lib/formatDuration";
import { tapScale, tapTransition } from "@/lib/animations";
import type { TFunction } from "@/contexts/LocaleContext";

/** Matches Tailwind `gap-3` (0.75rem) for measurement. */
const GAP_PX = 12;
/** Horizontal drift in px/s — slow, readable pace. */
const AUTO_SCROLL_SPEED = 6;

function wrapOffsetInLoop(offset: number, loopWidth: number): number {
  if (loopWidth <= 0) return offset;
  let o = offset;
  while (o >= loopWidth) o -= loopWidth;
  while (o < 0) o += loopWidth;
  return o;
}

export interface SearchRecommendationsCarouselProps {
  items: SearchResult[];
  mediaType: MediaType;
  /** Used for BGG landscape box art in portrait frames. */
  boardGameProvider?: BoardGameProvider;
  token: string | null;
  logsByExternalId: Map<string, LogIndexEntry>;
  onItemOpen: (id: string) => void;
}

export function SearchRecommendationsCarousel({
  items,
  mediaType,
  boardGameProvider,
  token,
  logsByExternalId,
  onItemOpen,
}: SearchRecommendationsCarouselProps) {
  const { t } = useLocale();

  const renderRecommendationCard = (
    item: SearchResult,
    reactKey: string,
    widthClass: string
  ) => {
    const userLog = token ? logsByExternalId.get(item.id) : undefined;
    const { inList, status, railClass, badgeClass } = searchResultLogIndicators(userLog);
    const display = userLog ? getLogCardDisplay(userLog) : null;

    return (
      <div key={reactKey} className={`shrink-0 ${widthClass}`}>
        <motion.div whileTap={tapScale} transition={tapTransition} className="h-full">
          <button
            type="button"
            onClick={() => onItemOpen(item.id)}
            className={`flex h-full w-full flex-col overflow-hidden rounded-lg border bg-[var(--color-dark)] text-left text-inherit shadow-[var(--shadow-card)] cursor-pointer transition-[opacity,border-color] hover:opacity-95 ${railClass}${!inList ? " hover:border-black" : ""}`}
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-lg">
              <ItemImage
                src={item.image}
                className="h-full w-full"
                mediaType={mediaType}
                activeBoardGameProvider={mediaType === "boardgames" ? boardGameProvider : undefined}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              {inList && status && (
                <span
                  className={`absolute bottom-1 right-1 z-10 rounded px-1.5 py-0.5 text-[9px] font-medium ${badgeClass}`}
                  title={getStatusLabel(t, status, mediaType)}
                >
                  {getStatusLabel(t, status, mediaType)}
                </span>
              )}
            </div>
            <div className={RECOMMENDATION_CARD_BODY}>
              <OverflowMarquee className="text-xs font-semibold leading-snug text-[var(--color-lightest)]">
                {item.title}
              </OverflowMarquee>
              {display?.grade != null ? (
                <StarRating value={gradeToStars(display.grade)} readOnly size="sm" />
              ) : null}
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                {item.genres && item.genres.length > 0 && (
                  <GenreBadges genres={item.genres} maxCount={1} />
                )}
                {mediaType === "books" && (
                  <BookPagesBadge pagesCount={item.pagesCount} />
                )}
              </div>
              <OverflowMarquee className="text-[10px] text-[var(--color-light)]">
                {(() => {
                  const parts: string[] = [item.year ?? "", item.subtitle ?? ""].filter(Boolean);
                  if (
                    mediaType === "games" &&
                    item.timeToBeatHours != null &&
                    item.timeToBeatHours > 0
                  ) {
                    const { hours, minutes } = formatTimeToBeatHours(item.timeToBeatHours);
                    parts.push(
                      minutes > 0
                        ? t("itemPage.timeToBeatHoursMinutes", {
                            hours: String(hours),
                            minutes: String(minutes),
                          })
                        : t("itemPage.timeToBeatHours", { hours: String(hours) })
                    );
                  }
                  return parts.join(" · ") || "—";
                })()}
              </OverflowMarquee>
            </div>
          </button>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 max-md:-mx-0.5 max-md:px-0.5">
      <RecommendationsAutoCarousel
        items={items}
        renderSlide={(item, suffix) =>
          renderRecommendationCard(
            item,
            `rec-d-${suffix}-${item.id}`,
            RECOMMENDATION_CARD_WIDTH
          )
        }
        t={t}
      />
    </div>
  );
}

interface AutoCarouselProps {
  items: SearchResult[];
  renderSlide: (item: SearchResult, suffix: string) => ReactNode;
  t: TFunction;
}

type DragSession =
  | {
      kind: "pointer";
      id: number;
      startX: number;
      startY: number;
      startOffset: number;
      dragging: boolean;
    }
  | {
      kind: "touch";
      id: number;
      startX: number;
      startY: number;
      startOffset: number;
      dragging: boolean;
    };

function touchFromList(list: TouchList, id: number): Touch | undefined {
  for (let i = 0; i < list.length; i++) {
    const t = list.item(i);
    if (t?.identifier === id) return t;
  }
  return undefined;
}

function RecommendationsAutoCarousel({
  items,
  renderSlide,
  t,
}: AutoCarouselProps) {
  const itemIds = useMemo(() => items.map((i) => i.id).join("|"), [items]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const loopWidthRef = useRef(0);
  const rafRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const dragSessionRef = useRef<DragSession | null>(null);
  const windowDragCleanupRef = useRef<(() => void) | null>(null);
  const stopAutoRef = useRef<() => void>(() => {});
  const applyTransformRef = useRef<() => void>(() => {});

  const [paused, setPaused] = useState(false);
  const [isHorizontalDrag, setIsHorizontalDrag] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const isVisibleRef = useRef(true);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const n = items.length;
    if (!track || n === 0) {
      loopWidthRef.current = 0;
      return;
    }
    const kids = track.children;
    if (kids.length < n) return;

    let acc = 0;
    for (let i = 0; i < n; i++) {
      const el = kids[i] as HTMLElement;
      const w = el.getBoundingClientRect().width;
      acc += w;
      if (i < n - 1) acc += GAP_PX;
    }
    loopWidthRef.current = Math.max(1, acc);
  }, [items.length]);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    if (mq.matches) setPaused(true);
    const onChange = () => {
      reducedMotionRef.current = mq.matches;
      if (mq.matches) setPaused(true);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const io = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((e) => e.isIntersecting);
        isVisibleRef.current = intersecting;
        setIsVisible(intersecting);
      },
      { rootMargin: "200px" }
    );
    io.observe(vp);
    return () => io.disconnect();
  }, [itemIds]);

  useLayoutEffect(() => {
    offsetRef.current = 0;
    windowDragCleanupRef.current?.();
    windowDragCleanupRef.current = null;
    dragSessionRef.current = null;
    setIsHorizontalDrag(false);
    if (trackRef.current) {
      trackRef.current.style.transform = "translate3d(0,0,0)";
    }
    measure();
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track) return;
    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(vp);
    ro.observe(track);
    return () => ro.disconnect();
  }, [measure, itemIds]);

  const applyTransform = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transform = `translate3d(${-offsetRef.current}px,0,0)`;
  }, []);

  const stopAuto = useCallback(() => {
    setPaused(true);
  }, []);

  useEffect(() => {
    stopAutoRef.current = stopAuto;
    applyTransformRef.current = applyTransform;
  }, [stopAuto, applyTransform]);

  /**
   * Mobile: child <button> is the touch target; bubbled React pointer events often miss moves.
   * Use capture on the viewport + window-level touchmove (passive: false) and pointermove.
   * Skip pointerType "touch" — TouchEvent path handles finger input (avoids duplicate sessions).
   */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || items.length === 0) return;

    const endDragSession = () => {
      windowDragCleanupRef.current?.();
      windowDragCleanupRef.current = null;
      dragSessionRef.current = null;
      setIsHorizontalDrag(false);
    };

    const applyOffsetForSession = (session: DragSession, clientX: number) => {
      const lw = loopWidthRef.current;
      offsetRef.current = wrapOffsetInLoop(session.startOffset - (clientX - session.startX), lw);
      applyTransformRef.current();
    };

    const armHorizontalDrag = (
      session: DragSession,
      clientX: number,
      clientY: number,
      ev?: Event
    ): boolean => {
      const dx = clientX - session.startX;
      const dy = clientY - session.startY;
      if (!session.dragging) {
        if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return false;
        session.dragging = true;
        setPaused(true);
        setIsHorizontalDrag(true);
      }
      ev?.preventDefault();
      applyOffsetForSession(session, clientX);
      return true;
    };

    const onPointerDownCapture = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (e.pointerType === "touch") return;
      endDragSession();
      stopAutoRef.current();
      dragSessionRef.current = {
        kind: "pointer",
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startOffset: offsetRef.current,
        dragging: false,
      };

      const onWinMove = (ev: PointerEvent) => {
        const s = dragSessionRef.current;
        if (!s || s.kind !== "pointer" || s.id !== ev.pointerId) return;
        armHorizontalDrag(s, ev.clientX, ev.clientY, ev);
      };

      const onWinUp = (ev: PointerEvent) => {
        const s = dragSessionRef.current;
        if (!s || s.kind !== "pointer" || s.id !== ev.pointerId) return;
        endDragSession();
      };

      window.addEventListener("pointermove", onWinMove, { passive: false });
      window.addEventListener("pointerup", onWinUp);
      window.addEventListener("pointercancel", onWinUp);
      windowDragCleanupRef.current = () => {
        window.removeEventListener("pointermove", onWinMove);
        window.removeEventListener("pointerup", onWinUp);
        window.removeEventListener("pointercancel", onWinUp);
      };
    };

    const onTouchStartCapture = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0]!;
      endDragSession();
      stopAutoRef.current();
      const touchId = t.identifier;
      dragSessionRef.current = {
        kind: "touch",
        id: touchId,
        startX: t.clientX,
        startY: t.clientY,
        startOffset: offsetRef.current,
        dragging: false,
      };

      const onWinTouchMove = (ev: TouchEvent) => {
        const s = dragSessionRef.current;
        if (!s || s.kind !== "touch") return;
        const touch = touchFromList(ev.touches, s.id);
        if (!touch) return;
        armHorizontalDrag(s, touch.clientX, touch.clientY, ev);
      };

      const onWinTouchEnd = (ev: TouchEvent) => {
        const s = dragSessionRef.current;
        if (!s || s.kind !== "touch") return;
        if (!touchFromList(ev.changedTouches, s.id)) return;
        endDragSession();
      };

      window.addEventListener("touchmove", onWinTouchMove, { passive: false, capture: true });
      window.addEventListener("touchend", onWinTouchEnd, { capture: true });
      window.addEventListener("touchcancel", onWinTouchEnd, { capture: true });
      windowDragCleanupRef.current = () => {
        window.removeEventListener("touchmove", onWinTouchMove, { capture: true });
        window.removeEventListener("touchend", onWinTouchEnd, { capture: true });
        window.removeEventListener("touchcancel", onWinTouchEnd, { capture: true });
      };
    };

    vp.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    vp.addEventListener("touchstart", onTouchStartCapture, { capture: true, passive: true });

    return () => {
      endDragSession();
      vp.removeEventListener("pointerdown", onPointerDownCapture, { capture: true });
      vp.removeEventListener("touchstart", onTouchStartCapture, { capture: true });
    };
  }, [itemIds, items.length]);

  useEffect(() => {
    if (paused || !isVisible || items.length === 0 || reducedMotionRef.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      return;
    }

    const tick = (now: number) => {
      const lw = loopWidthRef.current;
      if (lw <= 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTimeRef.current == null) lastTimeRef.current = now;
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      let o = offsetRef.current + AUTO_SCROLL_SPEED * dt;
      o = wrapOffsetInLoop(o, lw);
      offsetRef.current = o;

      const trackEl = trackRef.current;
      if (trackEl) {
        trackEl.style.transform = `translate3d(${-o}px,0,0)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [paused, isVisible, itemIds]);

  if (items.length === 0) return null;

  return (
    <>
      <div
        ref={viewportRef}
        className={`relative w-full min-w-0 overflow-hidden rounded-lg pb-1 pt-1 ${
          isHorizontalDrag ? "touch-none" : "touch-manipulation"
        }`}
        onWheel={stopAuto}
        onFocusCapture={stopAuto}
        role="region"
        aria-label={t("search.recommendationsTitle")}
      >
        <div
          ref={trackRef}
          className="flex w-max gap-3 will-change-transform select-none"
          style={{ transform: "translate3d(0,0,0)" }}
        >
          {items.map((item) => renderSlide(item, "a"))}
          {items.map((item) => renderSlide(item, "b"))}
        </div>
      </div>
    </>
  );
}
