import { useEffect, useState, useRef, type ReactNode } from "react";
import { Logo, getLogoSrc } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { setOnFirstApiResponse, setOnFirstApiError } from "@/lib/api";
import { LoadingErrorCode } from "@/lib/loadingErrorCodes";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { clearAuthSession } from "@/lib/storage";
import { isCapacitorNative } from "@/lib/androidOverlayBack";
import { getUnauthenticatedEntryPath } from "@/lib/unauthenticatedEntry";
import { cn } from "@/lib/utils";

/** Visual progress reaches ~99% over this duration (decoupled from max wait so the bar feels responsive). */
const COLD_START_PROGRESS_DURATION_MS = 12_000;
/** Max wait before Try again (must exceed worst case: several API attempts × long timeout + backoff). */
const MAX_TOTAL_WAIT_MS = 180_000;
/** Show “server may be sleeping” hint after this many ms. */
const SERVER_SLEEPING_HINT_MS = 15_000;
/** Delay after progress stalls at 99% before showing Try again. */
const STUCK_AT_99_TRY_AGAIN_MS = 500;
/** Native: brief branded splash before revealing the in-app loader (API may still be loading). */
const NATIVE_MIN_SPLASH_MS = 500;
const NATIVE_LOADER_SLIDE_MS = 550;

type LoaderState = "loading" | "success" | "timed_out" | "error";

function ColdStartShell({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] bg-[var(--color-dark)] px-4"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

function ColdStartProgressBlock({
  progress,
  initializing,
  state,
  stillWaiting,
  elapsedMs,
  showTryAgain,
  onTryAgain,
  t,
}: {
  progress: number;
  initializing: boolean;
  state: LoaderState;
  stillWaiting: boolean;
  elapsedMs: number;
  showTryAgain: boolean;
  onTryAgain: () => void;
  t: (key: string) => string;
}) {
  return (
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
      {initializing && state === "success" && (
        <span className="text-sm text-[var(--color-light)]">{t("common.checkingSession")}</span>
      )}
      {stillWaiting && elapsedMs >= SERVER_SLEEPING_HINT_MS && (
        <p className="mt-3 max-w-sm text-center text-xs leading-relaxed text-[var(--color-mid)]">
          {t("coldStart.serverSleepingHint")}
        </p>
      )}
      {stillWaiting && showTryAgain && elapsedMs < MAX_TOTAL_WAIT_MS && (
        <Button onClick={onTryAgain} variant="outline" size="sm" className="mt-4">
          {t("common.tryAgain")}
        </Button>
      )}
    </div>
  );
}

export function ColdStartLoader() {
  const { t } = useLocale();
  const { initializing } = useAuth();
  const native = isCapacitorNative();
  const [state, setState] = useState<LoaderState>("loading");
  const [errorCode, setErrorCode] = useState<LoadingErrorCode | null>(null);
  const [progress, setProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const rafRef = useRef<number>(0);
  const [splashHidden, setSplashHidden] = useState(!native);
  const [loaderRevealed, setLoaderRevealed] = useState(!native);
  const [showTryAgain, setShowTryAgain] = useState(false);

  const stillWaiting = state === "loading" || (state === "success" && initializing);

  useEffect(() => {
    if (!stillWaiting || progress < 99) {
      setShowTryAgain(false);
      return;
    }
    const id = setTimeout(() => setShowTryAgain(true), STUCK_AT_99_TRY_AGAIN_MS);
    return () => clearTimeout(id);
  }, [stillWaiting, progress]);

  useEffect(() => {
    if (!native) return;
    const revealId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setLoaderRevealed(true));
    });
    const hideId = setTimeout(() => {
      setSplashHidden(true);
      void import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide());
    }, NATIVE_MIN_SPLASH_MS);
    return () => {
      cancelAnimationFrame(revealId);
      clearTimeout(hideId);
    };
  }, [native]);

  useEffect(() => {
    setOnFirstApiResponse(() => setState("success"));
    setOnFirstApiError((code) => {
      setErrorCode(code);
      setState("error");
    });
  }, []);

  useEffect(() => {
    if (state !== "loading") return;
    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const t = Math.min(1, elapsed / COLD_START_PROGRESS_DURATION_MS);
      const eased = 1 - (1 - t) ** 2.5;
      const p = Math.min(99, eased * 100);
      setProgress(Math.round(p));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state]);

  useEffect(() => {
    if (!stillWaiting) return;
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_TOTAL_WAIT_MS) setState("timed_out");
    }, 1000);
    return () => clearInterval(intervalId);
  }, [stillWaiting]);

  const handleTryAgain = () => {
    window.location.reload();
  };

  const handleSignIn = (): void => {
    void clearAuthSession().then(() => {
      window.dispatchEvent(new CustomEvent("auth:logout"));
      window.location.assign(getUnauthenticatedEntryPath());
    });
  };

  const isAuthError =
    errorCode === LoadingErrorCode.UNAUTHORIZED ||
    errorCode === LoadingErrorCode.FORBIDDEN;

  const ready = state === "success" && !initializing;
  /** On native, keep the overlay mounted under the splash until it fades out (avoids splash-only stall during /me). */
  const hideOverlay = ready && (!native || splashHidden);

  if (hideOverlay) return null;

  const progressBlock = (
    <ColdStartProgressBlock
      progress={progress}
      initializing={initializing}
      state={state}
      stillWaiting={stillWaiting}
      elapsedMs={elapsedMs}
      showTryAgain={showTryAgain}
      onTryAgain={handleTryAgain}
      t={t}
    />
  );

  if (state === "error") {
    return (
      <ColdStartShell ariaLabel="Error">
        <div className="flex h-full flex-col items-center justify-center gap-8">
          {native ? (
            <img
              src={getLogoSrc("dark")}
              alt=""
              className="h-24 w-auto mix-blend-lighten"
            />
          ) : (
            <Logo alt="" className="h-16 w-auto sm:h-20 md:h-24" />
          )}
          <div className="flex max-w-sm flex-col items-center gap-6 text-center">
            <p className="text-sm leading-relaxed text-[var(--color-light)]">
              {errorCode != null ? t(`coldStart.code_${errorCode}` as "coldStart.code_TIMEOUT") : t("coldStart.error")}
            </p>
            {isAuthError ? (
              <div className="flex flex-col items-center gap-2">
                <Button onClick={handleSignIn} variant="default" size="sm">
                  {t("login.signIn")}
                </Button>
                <Button onClick={handleTryAgain} variant="outline" size="sm">
                  {t("common.tryAgain")}
                </Button>
              </div>
            ) : (
              <Button onClick={handleTryAgain} variant="default" size="sm">
                {t("common.tryAgain")}
              </Button>
            )}
          </div>
        </div>
      </ColdStartShell>
    );
  }

  if (state === "timed_out") {
    return (
      <ColdStartShell ariaLabel="Error">
        <div className="flex h-full flex-col items-center justify-center gap-8">
          {native ? (
            <img
              src={getLogoSrc("dark")}
              alt=""
              className="h-24 w-auto mix-blend-lighten"
            />
          ) : (
            <Logo alt="" className="h-16 w-auto sm:h-20 md:h-24" />
          )}
          <div className="flex max-w-sm flex-col items-center gap-6 text-center">
            <p className="text-sm text-[var(--color-light)]">{t("coldStart.timedOut")}</p>
            <Button onClick={handleTryAgain} variant="default" size="sm">
              {t("common.tryAgain")}
            </Button>
          </div>
        </div>
      </ColdStartShell>
    );
  }

  if (native) {
    return (
      <ColdStartShell ariaLabel={initializing ? t("common.checkingSession") : "Loading"}>
        <div className="relative h-full w-full">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <img
              src={getLogoSrc("dark")}
              alt=""
              className="h-24 w-auto mix-blend-lighten"
            />
          </div>
          <div
            className={cn(
              "absolute left-1/2 flex w-full max-w-xs -translate-x-1/2 flex-col items-center transition-[top,opacity,transform] ease-out",
              loaderRevealed
                ? "top-[calc(50%+4.5rem)] translate-y-0 opacity-100"
                : "top-1/2 -translate-y-1/2 opacity-0"
            )}
            style={{ transitionDuration: `${NATIVE_LOADER_SLIDE_MS}ms` }}
          >
            {progressBlock}
          </div>
        </div>
      </ColdStartShell>
    );
  }

  return (
    <ColdStartShell ariaLabel={initializing ? t("common.checkingSession") : "Loading"}>
      <div className="flex h-full flex-col items-center justify-center gap-8">
        <Logo alt="" className="h-16 w-auto sm:h-20 md:h-24" />
        {progressBlock}
      </div>
    </ColdStartShell>
  );
}
