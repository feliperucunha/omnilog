import "./instrument-sentry.js";
import "express-async-errors";
import express from "express";
import { Sentry } from "./instrument-sentry.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/auth.js";
import { itemsRouter } from "./routes/items.js";
import { logsRouter } from "./routes/logs.js";
import { meRouter } from "./routes/me.js";
import { searchRouter } from "./routes/search.js";
import { settingsRouter } from "./routes/settings.js";
import { stripeRouter, handleStripeWebhook, syncStripeSubscriptions } from "./routes/stripe.js";
import { googlePlayBillingRouter } from "./routes/googlePlayBilling.js";
import { handleGooglePlayPubSubPush } from "./routes/googlePlayPubsub.js";
import { cronRouter, runSubscriptionExpiry } from "./routes/cron.js";
import { syncGooglePlaySubscriptions } from "./lib/googlePlayBilling.js";
import { usersRouter } from "./routes/users.js";
import { feedbackRouter } from "./routes/feedback.js";
import { followsRouter } from "./routes/follows.js";
import { adminRouter } from "./routes/admin.js";
import { boardGameCollectionImportRouter } from "./routes/boardGameCollectionImport.js";
import { prisma } from "./lib/prisma.js";
import { runMonthlyDigestIfDue } from "./lib/monthlyDigest.js";
import { isWakeApiPingEnabled } from "./lib/featureFlags.js";
import { runSeedBadges } from "./scripts/seedBadges.js";
import { runSeedMilestones } from "./scripts/seedMilestones.js";
import { APP_VERSION } from "@geeklogs/shared";

const app = express();
// When behind a proxy (e.g. Heroku), trust X-Forwarded-* so rate-limit and IP logging work correctly.
app.set("trust proxy", 1);
const PORT = process.env.PORT ?? 3001;
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

/** CORS: allowed request origins (frontend URLs where the browser runs), not the API URL. */
const corsOriginsRaw = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [WEB_ORIGIN];
const corsOrigins = corsOriginsRaw.length > 0 ? corsOriginsRaw : [WEB_ORIGIN];

app.use(
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  })
);
app.use(cookieParser());

// Stripe webhook needs raw body for signature verification – register before express.json()
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => void handleStripeWebhook(req, res)
);

app.use(express.json());

// Play RTDN: Pub/Sub push (no X-App-Version; authenticate via JWT or shared secret — see .env.example)
app.post("/api/billing/google-play/pubsub", (req, res) =>
  void handleGooglePlayPubSubPush(req, res)
);

const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
// Default allows batch import: ~2 requests per row (search + create), so 500 rows ≈ 1000 requests
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || 2500;
const limiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  message: { error: "Too many requests" },
  skip: (req) => req.originalUrl.includes("/billing/google-play/pubsub"),
});
app.use("/api/", limiter);

app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/items", itemsRouter);
app.use("/api/logs", logsRouter);
app.use("/api/search", searchRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/stripe", stripeRouter);
app.use("/api/billing/google-play", googlePlayBillingRouter);
app.use("/api/cron", cronRouter);
app.use("/api/users", usersRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/follows", followsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/board-games", boardGameCollectionImportRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version: APP_VERSION });
});

/** Public: whether clients should ping /api/health on an interval (free-tier sleep). No auth / no app version header. */
app.get("/api/wake-ping-config", async (_req, res) => {
  const raw = Number(process.env.WAKE_PING_INTERVAL_MS);
  const intervalMs =
    Number.isFinite(raw) && raw >= 60_000 ? Math.floor(raw) : 5 * 60 * 1000;

  const envEnabled =
    process.env.WAKE_API_PING_ENABLED === "true" || process.env.WAKE_API_PING_ENABLED === "1";
  if (envEnabled) {
    res.json({ enabled: true, intervalMs });
    return;
  }

  const enabled = await isWakeApiPingEnabled();
  res.json({ enabled, intervalMs });
});

/** Global error handler: log and return 500 JSON. */
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API error:", err);
  if (process.env.SENTRY_DSN?.trim() && err instanceof Error) {
    Sentry.captureException(err);
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);

  // Ensure badge definitions exist (no manual seed command needed)
  void prisma.badge
    .count()
    .then((n) => {
      if (n === 0) return runSeedBadges().then(() => console.log("Badges seeded."));
    })
    .catch((e) => console.error("Badge seed check failed:", e));

  // Idempotent upsert: ensures milestones exist. If you use Supabase without Prisma migrate, run supabase-milestones.sql first.
  void runSeedMilestones()
    .then(() => console.log("Milestones synced."))
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      const hint =
        msg.includes("does not exist") || msg.includes("relation")
          ? " Run apps/api/prisma/supabase-milestones.sql in Supabase SQL Editor, then restart."
          : "";
      console.error("Milestone seed failed." + hint, e);
    });

  // Run subscription reconciliation in-process: on startup and every 24h.
  // Order matters: refresh live state from Stripe (and Google Play) FIRST so
  // subscriptionEndsAt is up to date, THEN run the expiry sweep. Otherwise a
  // paying customer whose webhook was missed could be downgraded by the cron
  // before sync had a chance to extend their end date. syncStripeSubscriptions
  // is the safety net for setups where the Stripe webhook isn't configured.
  const runBillingSync = async () => {
    try {
      const playCleared = await syncGooglePlaySubscriptions();
      if (playCleared > 0) {
        console.log(`Google Play subscription sync: ${playCleared} user(s) cleared or updated`);
      }
    } catch (err) {
      console.error("[billing-sync] Google Play sync failed:", err);
    }
    try {
      const { refreshed, downgraded, reupgraded, cancellationsDetected, clearedStale } =
        await syncStripeSubscriptions();
      if (
        refreshed > 0 ||
        downgraded > 0 ||
        reupgraded > 0 ||
        cancellationsDetected > 0 ||
        clearedStale > 0
      ) {
        console.log(
          `Stripe subscription sync: ${refreshed} refreshed, ${downgraded} downgraded, ${reupgraded} re-upgraded, ${cancellationsDetected} cancellation(s) detected, ${clearedStale} stale id(s) cleared`
        );
      }
    } catch (err) {
      console.error("[billing-sync] Stripe sync failed:", err);
    }
    try {
      const expired = await runSubscriptionExpiry();
      if (expired > 0) console.log(`Subscription expiry: ${expired} user(s) downgraded to free`);
    } catch (err) {
      console.error("[billing-sync] Expiry failed:", err);
    }
  };
  void runBillingSync();
  setInterval(() => void runBillingSync(), TWENTY_FOUR_HOURS_MS);

  // Monthly recap emails: in-process on startup and every 24h (no external cron). See runMonthlyDigestIfDue.
  void runMonthlyDigestIfDue().then((r) => {
    if (r.ran) console.log(`Monthly digest auto: period ${r.periodKey} (sent ${r.result.sent})`);
  });
  setInterval(() => {
    void runMonthlyDigestIfDue().then((r) => {
      if (r.ran) console.log(`Monthly digest auto: period ${r.periodKey} (sent ${r.result.sent})`);
    });
  }, TWENTY_FOUR_HOURS_MS);
});
