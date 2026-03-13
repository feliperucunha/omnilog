import { useEffect, useState, useRef } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { setOnFirstApiResponse, setOnFirstApiError } from "@/lib/api";
import { LoadingErrorCode } from "@/lib/loadingErrorCodes";
import { useLocale } from "@/contexts/LocaleContext";

/** Full-screen loader shown until the first API response (handles cold start ~50s). */
const COLD_START_DURATION_MS = 50_000;

type LoaderState = "loading" | "success" | "timed_out" | "error";

const w = typeof window !== "undefined" ? (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }) : null;
const isNative = (): boolean => Boolean(w?.Capacitor?.isNativePlatform?.());

export function ColdStartLoader() {
  const { t } = useLocale();
  const [state, setState] = useState<LoaderState>("loading");
  const [errorCode, setErrorCode] = useState<LoadingErrorCode | null>(null);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const rafRef = useRef<number>(0);

  /** On native (Android/iOS), skip the cold-start loader so the app is not stuck in a 0–100% → Try again loop when the first request fails or times out (e.g. network/API URL). The app then shows normally and any API errors appear in context. */
  useEffect(() => {
    if (!isNative()) return;
    import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide());
  }, []);

  useEffect(() => {
    setOnFirstApiResponse(() => setState("success"));
    setOnFirstApiError((code) => {
      setErrorCode(code);
      setState("error");
    });
  }, []);

  useEffect(() => {
    if (state === "loading") return;
    if (isNative()) {
      import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide());
    }
  }, [state]);

  useEffect(() => {
    if (state !== "loading") return;
    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(100, (elapsed / COLD_START_DURATION_MS) * 100);
      setProgress(Math.round(p));
      if (p >= 100) setState("timed_out");
      else rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state]);

  const handleTryAgain = () => {
    window.location.reload();
  };

  if (isNative()) return null;
  if (state === "success") return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-[var(--color-dark)] px-4"
      role="status"
      aria-live="polite"
      aria-label={state === "loading" ? "Loading" : "Error"}
    >
      <Logo alt="" className="h-16 w-auto sm:h-20 md:h-24" />
      {state === "loading" ? (
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
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-6 text-center">
          {state === "error" && errorCode != null && (
            <p className="font-mono text-sm font-medium text-[var(--color-mid)]" aria-label="Error code">
              {t("coldStart.errorCodeLabel")}: {errorCode}
            </p>
          )}
          <p className="text-sm text-[var(--color-light)]">
            {state === "error"
              ? (errorCode != null ? t(`coldStart.code_${errorCode}` as "coldStart.code_TIMEOUT") : t("coldStart.error"))
              : t("coldStart.timedOut")}
          </p>
          <Button onClick={handleTryAgain} variant="default" size="sm">
            {t("common.tryAgain")}
          </Button>
        </div>
      )}
    </div>
  );
}
