import { useEffect, useState, useRef } from "react";
import { Logo } from "@/components/Logo";
import { setOnFirstApiResponse } from "@/lib/api";

/** Full-screen loader shown until the first API response (handles cold start ~50s). */
const COLD_START_DURATION_MS = 50_000;

export function ColdStartLoader() {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    setOnFirstApiResponse(() => setVisible(false));
  }, []);

  useEffect(() => {
    if (!visible) return;
    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(100, (elapsed / COLD_START_DURATION_MS) * 100);
      setProgress(Math.round(p));
      if (p < 100) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-[var(--color-dark)]"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <Logo alt="" className="h-16 w-auto sm:h-20 md:h-24" />
      <div className="flex flex-col items-center gap-2">
        <span className="text-2xl font-semibold tabular-nums text-[var(--color-lightest)]">
          {progress}%
        </span>
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-[var(--color-darkest)] sm:w-56">
          <div
            className="h-full rounded-full bg-[var(--btn-gradient-start)] transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
