import * as Sentry from "@sentry/react";

/** Call once at app startup. No-op when `VITE_SENTRY_DSN` is unset. */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: Math.min(1, Math.max(0, Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) || 0.05)),
  });
}

export { Sentry };
