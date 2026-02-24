import "express-async-errors";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/auth.js";
import { itemsRouter } from "./routes/items.js";
import { logsRouter } from "./routes/logs.js";
import { meRouter } from "./routes/me.js";
import { searchRouter } from "./routes/search.js";
import { settingsRouter } from "./routes/settings.js";

const app = express();
const PORT = process.env.PORT ?? 3001;
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

/** CORS: allow multiple origins (e.g. production + localhost) via comma-separated CORS_ORIGINS. */
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [WEB_ORIGIN];

app.use(
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  })
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/** Global error handler: log and return 500 JSON. */
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API error:", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
