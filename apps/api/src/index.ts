import "express-async-errors";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/auth.js";
import { itemsRouter } from "./routes/items.js";
import { logsRouter } from "./routes/logs.js";
import { meRouter } from "./routes/me.js";
import { searchRouter } from "./routes/search.js";
import { settingsRouter } from "./routes/settings.js";
import { stripeRouter, handleStripeWebhook } from "./routes/stripe.js";
import { cronRouter, runSubscriptionExpiry } from "./routes/cron.js";
import { usersRouter } from "./routes/users.js";
import { feedbackRouter } from "./routes/feedback.js";
import { followsRouter } from "./routes/follows.js";
import { adminRouter } from "./routes/admin.js";
import { prisma } from "./lib/prisma.js";
import { runSeedBadges } from "./scripts/seedBadges.js";
import { runSeedMilestones } from "./scripts/seedMilestones.js";
import { APP_VERSION } from "@dogument/shared";

const APP_VERSION_MISMATCH_CODE = "APP_VERSION_MISMATCH";

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

/** Require X-App-Version to match API version for all /api routes except /api/health. Returns 401 when out of sync. */
app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path === "/health/") {
    return next();
  }
  const clientVersion = req.headers["x-app-version"];
  if (clientVersion !== APP_VERSION) {
    return res.status(401).json({
      code: APP_VERSION_MISMATCH_CODE,
      error: "App version outdated. Please update the app from the store.",
    });
  }
  next();
});

const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
// Default allows batch import: ~2 requests per row (search + create), so 500 rows ≈ 1000 requests
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || 2500;
const limiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  message: { error: "Too many requests" },
});
app.use("/api/", limiter);

app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/items", itemsRouter);
app.use("/api/logs", logsRouter);
app.use("/api/search", searchRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/stripe", stripeRouter);
app.use("/api/cron", cronRouter);
app.use("/api/users", usersRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/follows", followsRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version: APP_VERSION });
});

/** Global error handler: log and return 500 JSON. */
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API error:", err);
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

  // Run subscription expiry in-process: on startup and every 24h (no external cron needed)
  void runSubscriptionExpiry().then((n) => {
    if (n > 0) console.log(`Subscription expiry: ${n} user(s) downgraded to free`);
  });
  setInterval(() => {
    void runSubscriptionExpiry().then((n) => {
      if (n > 0) console.log(`Subscription expiry: ${n} user(s) downgraded to free`);
    });
  }, TWENTY_FOUR_HOURS_MS);
});
