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
import type { MediaType, SearchResult } from "@geeklogs/shared";
import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES } from "@geeklogs/shared";
import { getStatusLabel } from "@/lib/statusLabel";
import { useLocale } from "@/contexts/LocaleContext";
import { ItemImage } from "@/components/ItemImage";
import { GenreBadges } from "@/components/GenreBadges";
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

function pageCountForLoop(loopWidth: number, pageWidth: number): number {
  if (loopWidth <= 0) return 1;
  if (pageWidth <= 0) return 1;
  return Math.max(1, Math.ceil(loopWidth / pageWidth));
}

function pageIndexForOffset(offset: number, loopWidth: number, pageWidth: number): number {
  if (loopWidth <= 0 || pageWidth <= 0) return 0;
  const pc = pageCountForLoop(loopWidth, pageWidth);
  const p = wrapOffsetInLoop(offset, loopWidth);
  let idx = Math.floor(p / pageWidth);
  if (idx < 0) idx = 0;
  if (idx >= pc) idx = pc - 1;
  return idx;
}

function pageStartOffset(pageIndex: number, pageWidth: number): number {
  return pageIndex * pageWidth;
}

/** Segments for shortest scroll path on the loop (may use duplicate strip). */
function shortestPathSegments(
  from: number,
  to: number,
  lw: number
): { from: number; to: number }[] {
  const dF = to >= from ? to - from : lw - from + to;
  const dB = from >= to ? from - to : from + lw - to;
  if (dF <= dB) {
    if (to >= from) return [{ from, to }];
    return [{ from, to: to + lw }];
  }
  if (from >= to) return [{ from, to }];
  return [
    { from, to: 0 },
    { from: lw, to },
  ];
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** ~0.45 px/ms → feels like manual scrolling; clamped for short/long jumps. */
function durationMsForDistance(dist: number): number {
  return Math.min(1400, Math.max(380, dist / 0.45));
}

export interface SearchRecommendationsCarouselProps {
  items: SearchResult[];
  mediaType: MediaType;
  token: string | null;
  logsByExternalId: Map<string, string>;
  onItemOpen: (id: string) => void;
}

export function SearchRecommendationsCarousel({
  items,
  mediaType,
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
    const status = token ? logsByExternalId.get(item.id) : undefined;
    const isDropped = status === "dropped";
    const isInProgress =
      status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
    const isCompleted =
      status != null && (COMPLETED_STATUSES as readonly string[]).includes(status);
    const listBorderClass =
      status == null
        ? "border border-[var(--color-surface-border)]"
        : isDropped
          ? "border border-red-500"
          : isInProgress
            ? "border border-amber-400"
            : isCompleted
              ? "border border-emerald-600"
              : "border border-[var(--color-mid)]";
    const badgeClass =
      status == null
        ? ""
        : isDropped
          ? "bg-red-500/95 text-white"
          : isInProgress
            ? "bg-amber-400 text-[var(--color-darkest)]"
            : isCompleted
              ? "bg-emerald-600 text-white"
              : "bg-[var(--color-mid)]/90 text-[var(--color-lightest)]";

    return (
      <div key={reactKey} className={`shrink-0 ${widthClass}`}>
        <motion.div whileTap={tapScale} transition={tapTransition} className="h-full">
          <button
            type="button"
            onClick={() => onItemOpen(item.id)}
            className={`flex h-full w-full flex-col overflow-hidden rounded-lg border bg-[var(--color-dark)] text-left text-inherit shadow-[var(--shadow-card)] cursor-pointer transition-[opacity,border-color] hover:opacity-95 ${listBorderClass}`}
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-lg">
              <ItemImage src={item.image} className="h-full w-full" />
              {token && status && (
                <span
                  className={`absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-[9px] font-medium ${badgeClass}`}
                  title={getStatusLabel(t, status, mediaType)}
                >
                  {getStatusLabel(t, status, mediaType)}
                </span>
              )}
            </div>
            <div className="flex min-h-[3.5rem] flex-col gap-0.5 p-2.5">
              <p className="line-clamp-2 text-xs font-semibold leading-snug text-[var(--color-lightest)]">
                {item.title}
              </p>
              {item.genres && item.genres.length > 0 && (
                <GenreBadges genres={item.genres} maxCount={1} />
              )}
              <p className="line-clamp-2 text-[10px] text-[var(--color-light)]">
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
              </p>
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
        mediaType={mediaType}
        renderSlide={(item, suffix) =>
          renderRecommendationCard(
            item,
            `rec-d-${suffix}-${item.id}`,
            "w-[9.5rem] sm:w-[11rem]"
          )
        }
        t={t}
      />
    </div>
  );
}

interface AutoCarouselProps {
  items: SearchResult[];
  mediaType: MediaType;
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
  mediaType,
  renderSlide,
  t,
}: AutoCarouselProps) {
  const itemIds = useMemo(() => items.map((i) => i.id).join("|"), [items]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const loopWidthRef = useRef(0);
  const pageWidthRef = useRef(0);
  const lastPageRef = useRef(-1);
  const rafRef = useRef(0);
  const dotAnimRafRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const dragSessionRef = useRef<DragSession | null>(null);
  const windowDragCleanupRef = useRef<(() => void) | null>(null);
  const stopAutoRef = useRef<() => void>(() => {});
  const cancelDotAnimRef = useRef<() => void>(() => {});
  const applyTransformRef = useRef<() => void>(() => {});

  const [paused, setPaused] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [activePage, setActivePage] = useState(0);
  const [isHorizontalDrag, setIsHorizontalDrag] = useState(false);

  const cancelDotAnim = useCallback(() => {
    if (dotAnimRafRef.current) {
      cancelAnimationFrame(dotAnimRafRef.current);
      dotAnimRafRef.current = 0;
    }
  }, []);

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

  const syncPageLayout = useCallback(() => {
    const vp = viewportRef.current;
    const pw = vp?.clientWidth ?? 0;
    pageWidthRef.current = pw;
    measure();
    const lw = loopWidthRef.current;
    const pc = pageCountForLoop(lw, pw);
    setPageCount(pc);
    const cur = Math.min(pageIndexForOffset(offsetRef.current, lw, pw), pc - 1);
    if (cur !== lastPageRef.current) {
      lastPageRef.current = cur;
      setActivePage(cur);
    }
  }, [measure]);

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
    cancelDotAnim();
    offsetRef.current = 0;
    lastPageRef.current = -1;
    windowDragCleanupRef.current?.();
    windowDragCleanupRef.current = null;
    dragSessionRef.current = null;
    setIsHorizontalDrag(false);
    if (trackRef.current) {
      trackRef.current.style.transform = "translate3d(0,0,0)";
    }
    syncPageLayout();
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track) return;
    const ro = new ResizeObserver(() => {
      syncPageLayout();
    });
    ro.observe(vp);
    ro.observe(track);
    return () => ro.disconnect();
  }, [cancelDotAnim, syncPageLayout, itemIds]);

  useEffect(() => () => cancelDotAnim(), [cancelDotAnim]);

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
    cancelDotAnimRef.current = cancelDotAnim;
    applyTransformRef.current = applyTransform;
  }, [stopAuto, cancelDotAnim, applyTransform]);

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
      const pw = pageWidthRef.current;
      const d = pageIndexForOffset(offsetRef.current, lw, pw);
      if (d !== lastPageRef.current) {
        lastPageRef.current = d;
        setActivePage(d);
      }
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
        cancelDotAnimRef.current();
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
    if (paused || items.length === 0 || reducedMotionRef.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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

      const pw = pageWidthRef.current;
      const d = pageIndexForOffset(o, lw, pw);
      if (d !== lastPageRef.current) {
        lastPageRef.current = d;
        setActivePage(d);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [paused, itemIds]);

  const animateToPage = useCallback(
    (pageIndex: number) => {
      stopAuto();
      cancelDotAnim();

      const lw = loopWidthRef.current;
      const pw = pageWidthRef.current;
      const pc = pageCountForLoop(lw, pw);
      if (pageIndex < 0 || pageIndex >= pc || pw <= 0) return;
      const target = pageStartOffset(pageIndex, pw);
      const from = offsetRef.current;

      const snapToTarget = () => {
        offsetRef.current = wrapOffsetInLoop(target, lw);
        lastPageRef.current = pageIndex;
        setActivePage(pageIndex);
        applyTransform();
      };

      if (reducedMotionRef.current) {
        snapToTarget();
        return;
      }

      const segments = shortestPathSegments(from, target, lw);
      const totalDist = segments.reduce((acc, s) => acc + Math.abs(s.to - s.from), 0);
      if (totalDist < 0.5) {
        snapToTarget();
        return;
      }

      const runSegment = (segIndex: number) => {
        if (segIndex >= segments.length) {
          snapToTarget();
          return;
        }

        const seg = segments[segIndex]!;
        const dist = Math.abs(seg.to - seg.from);
        if (dist < 0.5) {
          if (segIndex === segments.length - 1) {
            snapToTarget();
          } else {
            offsetRef.current = seg.to;
            applyTransform();
            const next = segments[segIndex + 1]!;
            if (seg.to === 0 && next.from === lw) {
              offsetRef.current = lw;
              applyTransform();
            }
            runSegment(segIndex + 1);
          }
          return;
        }

        const duration = durationMsForDistance(dist);
        const t0 = performance.now();

        const step = (now: number) => {
          const elapsed = now - t0;
          const u = Math.min(1, elapsed / duration);
          const e = easeInOutCubic(u);
          const pos = seg.from + (seg.to - seg.from) * e;
          offsetRef.current = pos;
          const trackEl = trackRef.current;
          if (trackEl) {
            trackEl.style.transform = `translate3d(${-pos}px,0,0)`;
          }

          const lw2 = loopWidthRef.current;
          const pw2 = pageWidthRef.current;
          const dIdx = pageIndexForOffset(pos, lw2, pw2);
          if (dIdx !== lastPageRef.current) {
            lastPageRef.current = dIdx;
            setActivePage(dIdx);
          }

          if (u < 1) {
            dotAnimRafRef.current = requestAnimationFrame(step);
          } else {
            offsetRef.current = seg.to;
            applyTransform();
            if (segIndex < segments.length - 1) {
              const next = segments[segIndex + 1]!;
              if (seg.to === 0 && next.from === lw) {
                offsetRef.current = lw;
                applyTransform();
              }
              runSegment(segIndex + 1);
            } else {
              offsetRef.current = wrapOffsetInLoop(seg.to, lw);
              lastPageRef.current = pageIndex;
              setActivePage(pageIndex);
              applyTransform();
              dotAnimRafRef.current = 0;
            }
          }
        };

        dotAnimRafRef.current = requestAnimationFrame(step);
      };

      runSegment(0);
    },
    [applyTransform, cancelDotAnim, stopAuto]
  );

  const handleDotClick = (pageIndex: number) => {
    animateToPage(pageIndex);
  };

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
      <div
        className="flex flex-wrap justify-center gap-2"
        role="group"
        aria-label={t("search.recommendationsNav")}
      >
        {Array.from({ length: pageCount }, (_, i) => (
          <button
            key={`rec-dot-${mediaType}-p${i}`}
            type="button"
            aria-current={i === activePage ? "true" : undefined}
            aria-label={t("search.recommendationsDotLabel", { index: String(i + 1) })}
            className={`h-2 w-2 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-dark)] ${
              i === activePage
                ? "bg-[var(--color-lightest)]"
                : "bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
            }`}
            onClick={() => handleDotClick(i)}
          />
        ))}
      </div>
    </>
  );
}
