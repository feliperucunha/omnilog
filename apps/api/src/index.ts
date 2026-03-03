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
import { paypalRouter, handlePayPalWebhook } from "./routes/paypal.js";
import { cronRouter, runSubscriptionExpiry } from "./routes/cron.js";
import { usersRouter } from "./routes/users.js";
import { feedbackRouter } from "./routes/feedback.js";

const app = express();
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

// PayPal webhook needs raw body for signature verification – register before express.json()
app.post(
  "/api/paypal/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => void handlePayPalWebhook(req, res)
);

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests" },
});
app.use("/api/", limiter);

app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/items", itemsRouter);
app.use("/api/logs", logsRouter);
app.use("/api/search", searchRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/paypal", paypalRouter);
app.use("/api/cron", cronRouter);
app.use("/api/users", usersRouter);
app.use("/api/feedback", feedbackRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
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
