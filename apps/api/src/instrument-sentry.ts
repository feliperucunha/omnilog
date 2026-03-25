import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: Math.min(1, Math.max(0, Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.05)),
  });
}

export { Sentry };
