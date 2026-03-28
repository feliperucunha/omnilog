import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type OverflowMarqueeProps = {
  children: ReactNode;
  className?: string;
  /** Native tooltip; defaults to string/number children when omitted */
  title?: string;
};

/**
 * When the text is wider than the container, scrolls horizontally in a loop instead of ellipsis.
 * Root is a `<span className="block">` so it can live inside `<h1>`–`<h6>` / `<DialogTitle>` (phrasing-only).
 * Respects `prefers-reduced-motion` (horizontal scroll instead of animation).
 */
export function OverflowMarquee({ children, className, title }: OverflowMarqueeProps) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [durationSec, setDurationSec] = useState(18);
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  const ariaTitle =
    title ??
    (typeof children === "string" || typeof children === "number" ? String(children) : undefined);

  const check = useCallback(() => {
    const outer = outerRef.current;
    const inner = measureRef.current;
    if (!outer || !inner) return;
    const delta = inner.scrollWidth - outer.clientWidth;
    setOverflow(delta > 1);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = (): void => setReduceMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useLayoutEffect(() => {
    check();
    const id = requestAnimationFrame(() => check());
    return () => cancelAnimationFrame(id);
  }, [check, children]);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const ro = new ResizeObserver(check);
    ro.observe(outer);
    const inner = measureRef.current;
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [check, children]);

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts?.ready) return;
    void document.fonts.ready.then(() => check());
  }, [check, children]);

  useLayoutEffect(() => {
    if (!overflow || reduceMotion) return;
    const w = measureRef.current?.scrollWidth ?? 0;
    setDurationSec(Math.min(50, Math.max(10, w / 28)));
  }, [overflow, reduceMotion, children]);

  const outerClass = cn("block min-w-0 w-full", className);

  if (!overflow) {
    return (
      <span ref={outerRef} className={cn(outerClass, "overflow-hidden")} title={ariaTitle}>
        <span ref={measureRef} className="inline-block whitespace-nowrap">
          {children}
        </span>
      </span>
    );
  }

  if (reduceMotion) {
    return (
      <span
        ref={outerRef}
        className={cn(
          outerClass,
          "overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]"
        )}
        title={ariaTitle}
      >
        <span ref={measureRef} className="inline-block whitespace-nowrap">
          {children}
        </span>
      </span>
    );
  }

  const style = {
    "--overflow-marquee-duration": `${durationSec}s`,
  } as CSSProperties;

  return (
    <span ref={outerRef} className={cn(outerClass, "overflow-hidden")} title={ariaTitle}>
      <span className="flex w-max animate-overflow-marquee" style={style}>
        <span ref={measureRef} className="inline-flex shrink-0 whitespace-nowrap pr-10">
          {children}
        </span>
        <span className="inline-flex shrink-0 whitespace-nowrap pr-10" aria-hidden>
          {children}
        </span>
      </span>
    </span>
  );
}
