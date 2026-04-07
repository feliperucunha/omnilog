import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { SPEND_TRACKED_MEDIA_TYPES } from "@geeklogs/shared";
import { prisma } from "./prisma.js";
import { logSpendStatsDateWhereHalfOpen } from "./purchaseFields.js";
import { rollupHoursFromCompletedLogs, type CompletedLogForHours } from "./completedLogHours.js";
import { isSmtpConfigured, sendMonthlyDigestEmail } from "./email.js";
import { APP_SETTING_KEYS, getAppSettingValue, upsertAppSettingValue } from "./appSettings.js";
import {
  type DigestLocale,
  digestCopy,
  formatDigestMonthLabel,
  normalizeDigestLocale,
} from "./digestI18n.js";

/** Embedded logo: same CID in HTML img and nodemailer attachment. */
export const DIGEST_LOGO_CID = "geeklogs-logo@geeklogs";

/** Same decimal rules as apps/web/src/lib/moneyInput.ts (keep in sync for display). */
const DECIMALS: Record<string, number> = {
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
};

function currencyMinorDecimals(currency: string): number {
  return DECIMALS[currency.toUpperCase()] ?? 2;
}

function formatMinorAsCurrency(minor: number, currency: string): string {
  const d = currencyMinorDecimals(currency);
  const major = minor / 10 ** d;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(major);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type DigestPeriod = {
  start: Date;
  endExclusive: Date;
};

/** Stable id for the digest window, e.g. `2026-02` for all of February UTC. */
export function digestPeriodKey(period: DigestPeriod): string {
  const y = period.start.getUTCFullYear();
  const m = period.start.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Previous calendar month in UTC [start, endExclusive), e.g. in March 2025 → all of February 2025.
 * Automated monthly jobs can call this on the 1st of each month.
 */
export function getPreviousCalendarMonthUtc(now: Date = new Date()): DigestPeriod {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const endExclusive = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  return {
    start,
    endExclusive,
  };
}

const BOARDGAMES_MEDIA = "boardgames" as const;

export type UserDigestStats = {
  logsAdded: number;
  completedCount: number;
  reviewsCount: number;
  totalHours: number;
  logsWithPositiveHours: number;
  /** Totals per ISO 4217 currency code (minor units summed). */
  spendByCurrency: Record<string, number>;
  /** BoardGameMatch rows with playedAt in the digest window (user’s logs only). */
  boardGameSessionsLogged: number;
  /** Logs with mediaType boardgames and completedAt in the window. */
  boardGamesCompleted: number;
  /** Logs with mediaType boardgames and createdAt in the window. */
  boardGamesAdded: number;
};

export async function computeUserDigestStats(userId: string, period: DigestPeriod): Promise<UserDigestStats> {
  const { start, endExclusive } = period;

  const [
    logsAdded,
    completedCount,
    reviewsCount,
    completedLogs,
    purchaseLogs,
    boardGameSessionsLogged,
    boardGamesCompleted,
    boardGamesAdded,
  ] = await Promise.all([
    prisma.log.count({
      where: { userId, createdAt: { gte: start, lt: endExclusive } },
    }),
    prisma.log.count({
      where: { userId, completedAt: { gte: start, lt: endExclusive } },
    }),
    prisma.log.count({
      where: {
        userId,
        grade: { not: null },
        updatedAt: { gte: start, lt: endExclusive },
      },
    }),
    prisma.log.findMany({
      where: { userId, completedAt: { gte: start, lt: endExclusive } },
      select: {
        completedAt: true,
        contentHours: true,
        startedAt: true,
        mediaType: true,
        hoursToBeat: true,
        matchesPlayed: true,
      },
    }),
    prisma.log.findMany({
      where: {
        userId,
        purchaseAmountMinor: { not: null },
        purchaseCurrency: { not: null },
        mediaType: { in: [...SPEND_TRACKED_MEDIA_TYPES] },
        AND: [logSpendStatsDateWhereHalfOpen({ gte: start, lt: endExclusive })],
      },
      select: { purchaseAmountMinor: true, purchaseCurrency: true },
    }),
    prisma.boardGameMatch.count({
      where: {
        playedAt: { gte: start, lt: endExclusive },
        log: { userId },
      },
    }),
    prisma.log.count({
      where: {
        userId,
        mediaType: BOARDGAMES_MEDIA,
        completedAt: { gte: start, lt: endExclusive },
      },
    }),
    prisma.log.count({
      where: {
        userId,
        mediaType: BOARDGAMES_MEDIA,
        createdAt: { gte: start, lt: endExclusive },
      },
    }),
  ]);

  const hoursRollup = rollupHoursFromCompletedLogs(completedLogs as CompletedLogForHours[]);

  const spendByCurrency: Record<string, number> = {};
  for (const row of purchaseLogs) {
    const n = row.purchaseAmountMinor;
    const cur = row.purchaseCurrency?.toUpperCase();
    if (n == null || cur == null) continue;
    spendByCurrency[cur] = (spendByCurrency[cur] ?? 0) + n;
  }

  return {
    logsAdded,
    completedCount,
    reviewsCount,
    totalHours: hoursRollup.totalHours,
    logsWithPositiveHours: hoursRollup.logsWithPositiveHours,
    spendByCurrency,
    boardGameSessionsLogged,
    boardGamesCompleted,
    boardGamesAdded,
  };
}

type EmailPalette = {
  cardBg: string;
  outerBg: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  statBg: string;
};

function paletteForEmail(theme: "light" | "dark"): EmailPalette {
  if (theme === "dark") {
    return {
      cardBg: "#18181b",
      outerBg: "#09090b",
      text: "#fafafa",
      muted: "#a1a1aa",
      border: "#27272a",
      accent: "#818cf8",
      statBg: "#18181b",
    };
  }
  return {
    cardBg: "#ffffff",
    outerBg: "#f4f4f5",
    text: "#18181b",
    muted: "#71717a",
    border: "#e4e4e7",
    accent: "#6366f1",
    statBg: "#fafafa",
  };
}

function buildDigestHtml(params: {
  displayName: string;
  monthLabel: string;
  stats: UserDigestStats;
  logoImgTag: string;
  appOrigin: string;
  locale: DigestLocale;
  emailTheme: "light" | "dark";
}): string {
  const { displayName, monthLabel, stats, logoImgTag, appOrigin, locale, emailTheme } = params;
  const copy = digestCopy(locale);
  const safeName = escapeHtml(displayName);
  const spendLines = Object.entries(stats.spendByCurrency)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, minor]) => formatMinorAsCurrency(minor, cur))
    .join(" · ");
  const spendBlock = spendLines.length > 0 ? spendLines : "—";

  const p = paletteForEmail(emailTheme);
  const lang = locale === "pt-BR" ? "pt-BR" : locale;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>Geeklogs — ${escapeHtml(monthLabel)}</title></head>
<body style="margin:0;padding:0;background:${p.outerBg};font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${p.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${p.outerBg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:${p.cardBg};border-radius:12px;border:1px solid ${p.border};overflow:hidden;">
          <tr>
            <td style="padding:28px 24px 8px;text-align:center;">
              ${logoImgTag}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 4px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${p.muted};">${escapeHtml(copy.monthlyRecapKicker)}</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;font-weight:700;color:${p.text};">${escapeHtml(monthLabel)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 8px;">
              <p style="margin:0;font-size:15px;line-height:1.5;color:${p.text};">${escapeHtml(copy.greeting(displayName))}</p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:${p.muted};">${escapeHtml(copy.intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 20px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 8px;">
                ${statRow(copy.newLogs, String(stats.logsAdded), p)}
                ${statRow(copy.completed, String(stats.completedCount), p)}
                ${statRow(copy.reviewsSaved, String(stats.reviewsCount), p)}
                ${statRow(copy.contentHours, stats.totalHours === 0 ? "0" : String(stats.totalHours), p)}
                ${statRow(copy.boardGamesAdded, String(stats.boardGamesAdded), p)}
                ${statRow(copy.boardGamesCompleted, String(stats.boardGamesCompleted), p)}
                ${statRow(copy.boardGameMatchesLogged, String(stats.boardGameSessionsLogged), p)}
                <tr>
                  <td style="padding:14px 16px;background:${p.statBg};border-radius:10px;border:1px solid ${p.border};">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:${p.muted};">${escapeHtml(copy.purchaseTotal)}</p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:${p.text};">${escapeHtml(spendBlock)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;text-align:center;">
              <a href="${escapeHtml(appOrigin)}/dashboard" style="display:inline-block;padding:12px 22px;background:${p.accent};color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">${escapeHtml(copy.openApp)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${p.muted};text-align:center;">${escapeHtml(copy.footer)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function statRow(label: string, value: string, p: EmailPalette): string {
  return `<tr>
    <td style="padding:14px 16px;background:${p.statBg};border-radius:10px;border:1px solid ${p.border};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:${p.muted};">${escapeHtml(label)}</td>
          <td align="right" style="font-size:20px;font-weight:700;color:${p.accent};">${escapeHtml(value)}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function buildDigestText(params: {
  displayName: string;
  monthLabel: string;
  stats: UserDigestStats;
  appOrigin: string;
  locale: DigestLocale;
}): string {
  const { displayName, monthLabel, stats, appOrigin, locale } = params;
  const copy = digestCopy(locale);
  const spendLines = Object.entries(stats.spendByCurrency)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, minor]) => formatMinorAsCurrency(minor, cur))
    .join(" · ");
  const lines = [
    copy.greeting(displayName),
    "",
    copy.textYourRecap(monthLabel),
    `- ${copy.newLogs}: ${stats.logsAdded}`,
    `- ${copy.completed}: ${stats.completedCount}`,
    `- ${copy.reviewsSaved}: ${stats.reviewsCount}`,
    `- ${copy.contentHours}: ${stats.totalHours}`,
    `- ${copy.boardGamesAdded}: ${stats.boardGamesAdded}`,
    `- ${copy.boardGamesCompleted}: ${stats.boardGamesCompleted}`,
    `- ${copy.boardGameMatchesLogged}: ${stats.boardGameSessionsLogged}`,
    `- ${copy.textPurchaseLine}: ${spendLines || "—"}`,
    "",
    `${copy.openApp}: ${appOrigin}/dashboard`,
    "",
    copy.textReceiving,
  ];
  return lines.join("\n");
}

function appOriginForDigest(): string {
  const raw = process.env.WEB_ORIGIN?.trim() || "http://localhost:5173";
  return raw.replace(/\/$/, "");
}

/**
 * Load logo bytes for CID embedding. Set DIGEST_LOGO_PATH to an absolute path in production if the
 * monorepo path is not available (e.g. minimal Docker image).
 */
export async function loadDigestLogoBuffer(): Promise<Buffer | null> {
  const envPath = process.env.DIGEST_LOGO_PATH?.trim();
  if (envPath) {
    try {
      return await readFile(envPath);
    } catch {
      console.warn("[monthlyDigest] DIGEST_LOGO_PATH read failed:", envPath);
    }
  }
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.join(__dirname, "../../../web/public/logo.png")];
  for (const p of candidates) {
    try {
      return await readFile(p);
    } catch {
      /* try next */
    }
  }
  console.warn(
    "[monthlyDigest] Logo file not found; digest will use text branding. Set DIGEST_LOGO_PATH or ensure apps/web/public/logo.png exists relative to the API."
  );
  return null;
}

export type SendDigestOutcome =
  | { ok: true; kind: "sent" }
  | { ok: true; kind: "skipped"; reason: "recap_disabled" }
  | { ok: false; kind: "no_user" | "smtp" };

export async function sendDigestForUser(
  userId: string,
  toEmail: string,
  period: DigestPeriod,
  options?: { force?: boolean }
): Promise<SendDigestOutcome> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      email: true,
      preferredLocale: true,
      preferredTheme: true,
      recapEmailsEnabled: true,
    },
  });
  if (!user) return { ok: false, kind: "no_user" };

  if (!options?.force && !user.recapEmailsEnabled) {
    return { ok: true, kind: "skipped", reason: "recap_disabled" };
  }

  const locale = normalizeDigestLocale(user.preferredLocale);
  const emailTheme = user.preferredTheme === "light" ? "light" : "dark";
  const monthLabel = formatDigestMonthLabel(period.start, locale);

  const stats = await computeUserDigestStats(userId, period);
  const displayName = user.username?.trim() || user.email.split("@")[0] || "there";
  const appOrigin = appOriginForDigest();

  const logoBuffer = await loadDigestLogoBuffer();
  const logoImgTag = logoBuffer
    ? `<img src="cid:${DIGEST_LOGO_CID}" alt="Geeklogs" width="120" style="display:block;margin:0 auto;max-width:120px;height:auto;border:0;"/>`
    : `<div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${emailTheme === "dark" ? "#fafafa" : "#18181b"};">Geeklogs</div>`;

  const html = buildDigestHtml({
    displayName,
    monthLabel,
    stats,
    logoImgTag,
    appOrigin,
    locale,
    emailTheme,
  });
  const text = buildDigestText({ displayName, monthLabel, stats, appOrigin, locale });
  const copy = digestCopy(locale);
  const subject = `${copy.subjectPrefix} — ${monthLabel}`;

  const attachments = logoBuffer
    ? [{ filename: "logo.png", content: logoBuffer, cid: DIGEST_LOGO_CID }]
    : undefined;

  const sent = await sendMonthlyDigestEmail(toEmail, subject, html, text, attachments);
  if (!sent) return { ok: false, kind: "smtp" };
  return { ok: true, kind: "sent" };
}

export type MonthlyDigestBatchResult = {
  period: DigestPeriod;
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: { userId: string; email: string; message: string }[];
};

/**
 * Sends the digest for the given period to every user at their account email (skips recap opt-outs).
 */
export async function broadcastMonthlyDigest(period: DigestPeriod): Promise<MonthlyDigestBatchResult> {
  const users = await prisma.user.findMany({
    where: { recapEmailsEnabled: true },
    select: { id: true, email: true },
  });
  const errors: MonthlyDigestBatchResult["errors"] = [];
  let sent = 0;
  for (const u of users) {
    const outcome = await sendDigestForUser(u.id, u.email, period);
    if (outcome.ok && outcome.kind === "sent") sent += 1;
    else if (!outcome.ok)
      errors.push({
        userId: u.id,
        email: u.email,
        message: outcome.kind === "no_user" ? "user missing" : "send failed or SMTP not configured",
      });
  }
  return {
    period,
    attempted: users.length,
    sent,
    skipped: 0,
    failed: errors.length,
    errors,
  };
}

export type MonthlyDigestAutoResult =
  | { ran: false; reason: "disabled" | "no_smtp" | "already_sent" | "smtp_all_failed" }
  | { ran: true; periodKey: string; result: MonthlyDigestBatchResult };

/** Default: automatic monthly digest is on (set `MONTHLY_DIGEST_AUTO=false` to disable). */
export const MONTHLY_DIGEST_AUTO_DEFAULT = true;

export function isMonthlyDigestAutoEnabled(): boolean {
  const raw = process.env.MONTHLY_DIGEST_AUTO?.trim();
  if (raw === undefined || raw === "") return MONTHLY_DIGEST_AUTO_DEFAULT;
  const lower = raw.toLowerCase();
  if (lower === "false" || lower === "0" || lower === "no") return false;
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  return MONTHLY_DIGEST_AUTO_DEFAULT;
}

/**
 * Sends the previous UTC calendar month digest to all opted-in users if it has not been sent yet
 * for that period (tracked in AppSetting). Call from process startup and on a timer — no external cron.
 *
 * - Skips when `MONTHLY_DIGEST_AUTO` disables auto-send (default is **on**; use `false` / `0` / `no` to turn off).
 * - Skips when SMTP is not configured (retries on later runs).
 * - Does not advance the "last sent" marker if every send failed (retries).
 * - Advances the marker when there were no recipients or at least one successful send.
 */
export async function runMonthlyDigestIfDue(): Promise<MonthlyDigestAutoResult> {
  if (!isMonthlyDigestAutoEnabled()) {
    return { ran: false, reason: "disabled" };
  }

  if (!isSmtpConfigured()) {
    return { ran: false, reason: "no_smtp" };
  }

  const period = getPreviousCalendarMonthUtc();
  const periodKey = digestPeriodKey(period);

  const lastSent = await getAppSettingValue(APP_SETTING_KEYS.MONTHLY_DIGEST_LAST_SENT_PERIOD);
  if (lastSent === periodKey) {
    return { ran: false, reason: "already_sent" };
  }

  const result = await broadcastMonthlyDigest(period);

  if (result.attempted > 0 && result.sent === 0) {
    console.warn(
      "[monthlyDigest] Auto digest: no messages accepted by SMTP; not advancing last-sent marker (will retry)."
    );
    return { ran: false, reason: "smtp_all_failed" };
  }

  await upsertAppSettingValue(APP_SETTING_KEYS.MONTHLY_DIGEST_LAST_SENT_PERIOD, periodKey);
  console.log(
    `[monthlyDigest] Auto digest completed for period ${periodKey}: sent=${result.sent}, failed=${result.failed}`
  );
  return { ran: true, periodKey, result };
}
