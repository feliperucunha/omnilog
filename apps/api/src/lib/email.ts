import nodemailer from "nodemailer";
import { Sentry } from "../instrument-sentry.js";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "Geeklogs <noreply@example.com>";
const WEB_ORIGIN_FOR_EMAIL = (process.env.WEB_ORIGIN ?? "http://localhost:5173").replace(/\/$/, "");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/** True when SMTP env vars are set so digests and password reset can send mail. */
export function isSmtpConfigured(): boolean {
  return !!(SMTP_HOST?.trim() && SMTP_USER?.trim() && SMTP_PASS?.trim());
}

function captureEmailError(err: unknown, context: string): void {
  console.error(`[email] ${context}:`, err);
  if (process.env.SENTRY_DSN?.trim() && err instanceof Error) {
    Sentry.captureException(err);
  }
}

/**
 * Sends a password reset email with the given link.
 * Returns true if mail was accepted by SMTP; false if SMTP is not configured or send failed.
 * If SMTP is not configured, logs the reset URL on the server (no email is sent).
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const transporter = getTransporter();
  const subject = "Reset your Geeklogs password";
  const text = `You requested a password reset. Open this link to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`;
  const html = `<p>You requested a password reset. <a href="${resetUrl}">Click here to set a new password</a>.</p><p>Or copy this link: ${resetUrl}</p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`;

  if (!transporter) {
    console.warn(
      "[email] SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS). Reset link (copy from server logs only):",
      resetUrl
    );
    return false;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    captureEmailError(err, "Password reset send failed");
    return false;
  }
}

/**
 * Monthly activity digest (HTML + plain text). Same SMTP config as password reset.
 * Returns false if SMTP is not configured or send failed.
 */
export async function sendMonthlyDigestEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments?: { filename: string; content: Buffer; cid: string }[]
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(
      "[email] SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS). Monthly digest not sent."
    );
    return false;
  }
  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    });
    return true;
  } catch (err) {
    captureEmailError(err, "Monthly digest send failed");
    return false;
  }
}

/**
 * Welcome email sent after a successful account registration. Best-effort:
 * returns false (and never throws) if SMTP is not configured or the send fails.
 */
export async function sendWelcomeEmail(
  to: string,
  displayName?: string | null
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(
      "[email] SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS). Welcome email not sent for",
      to
    );
    return false;
  }
  const safeName = displayName?.trim() ? escapeHtml(displayName.trim()) : "there";
  const plainName = displayName?.trim() || "there";
  const homeUrl = `${WEB_ORIGIN_FOR_EMAIL}/`;
  const tiersUrl = `${WEB_ORIGIN_FOR_EMAIL}/tiers`;
  const subject = "Welcome to Geeklogs";
  const text =
    `Hi ${plainName},\n\n` +
    `Welcome to Geeklogs — your account is ready.\n\n` +
    `Log everything you watch, play, and read in one place. ` +
    `You can start logging right away from your dashboard:\n${homeUrl}\n\n` +
    `When you're ready for unlimited logs, statistics and CSV export, ` +
    `check out Pro:\n${tiersUrl}\n\n` +
    `If you didn't create this account, just ignore this email and the account will remain unused.\n\n` +
    `— The Geeklogs team`;
  const html =
    `<p>Hi ${safeName},</p>` +
    `<p>Welcome to Geeklogs — your account is ready.</p>` +
    `<p>Log everything you watch, play, and read in one place. ` +
    `You can start logging right away from <a href="${homeUrl}">your dashboard</a>.</p>` +
    `<p>When you're ready for unlimited logs, statistics and CSV export, ` +
    `check out <a href="${tiersUrl}">Pro</a>.</p>` +
    `<p style="color:#666;font-size:12px">If you didn't create this account, just ignore this email and the account will remain unused.</p>` +
    `<p>— The Geeklogs team</p>`;
  try {
    await transporter.sendMail({ from: SMTP_FROM, to, subject, text, html });
    return true;
  } catch (err) {
    captureEmailError(err, "Welcome email send failed");
    return false;
  }
}

/**
 * Sent once when a user becomes Pro (Stripe checkout completed). Best-effort.
 * `interval` is "monthly" | "yearly" | null; included in the body when known.
 * `subscriptionEndsAt` is the next renewal date; included when known.
 */
export async function sendSubscriptionConfirmationEmail(
  to: string,
  options: {
    displayName?: string | null;
    interval?: "monthly" | "yearly" | null;
    nextRenewalAt?: Date | null;
  } = {}
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(
      "[email] SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS). Subscription confirmation email not sent for",
      to
    );
    return false;
  }
  const safeName = options.displayName?.trim() ? escapeHtml(options.displayName.trim()) : "there";
  const plainName = options.displayName?.trim() || "there";
  const tiersUrl = `${WEB_ORIGIN_FOR_EMAIL}/tiers`;
  const intervalLabel =
    options.interval === "yearly" ? "yearly" : options.interval === "monthly" ? "monthly" : null;
  const renewalLabel =
    options.nextRenewalAt && !Number.isNaN(options.nextRenewalAt.getTime())
      ? options.nextRenewalAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;
  const subject = "You're now Geeklogs Pro";
  const billingLine = intervalLabel
    ? `Billing cadence: ${intervalLabel}.${renewalLabel ? ` Next renewal on ${renewalLabel}.` : ""}`
    : renewalLabel
      ? `Next renewal on ${renewalLabel}.`
      : "";
  const text =
    `Hi ${plainName},\n\n` +
    `Thanks for upgrading to Geeklogs Pro. Your account is active and you've unlocked:\n` +
    `  - Unlimited logs\n` +
    `  - Statistics page (calendar, time by category, monthly/yearly views)\n` +
    `  - CSV export\n` +
    `  - Public-profile customization\n` +
    `  - No ads\n\n` +
    (billingLine ? `${billingLine}\n\n` : "") +
    `Manage or cancel anytime from your Plans page:\n${tiersUrl}\n\n` +
    `— The Geeklogs team`;
  const html =
    `<p>Hi ${safeName},</p>` +
    `<p>Thanks for upgrading to <strong>Geeklogs Pro</strong>. Your account is active and you've unlocked:</p>` +
    `<ul>` +
    `<li>Unlimited logs</li>` +
    `<li>Statistics page (calendar, time by category, monthly/yearly views)</li>` +
    `<li>CSV export</li>` +
    `<li>Public-profile customization</li>` +
    `<li>No ads</li>` +
    `</ul>` +
    (billingLine ? `<p>${escapeHtml(billingLine)}</p>` : "") +
    `<p>Manage or cancel anytime from your <a href="${tiersUrl}">Plans page</a>.</p>` +
    `<p>— The Geeklogs team</p>`;
  try {
    await transporter.sendMail({ from: SMTP_FROM, to, subject, text, html });
    return true;
  } catch (err) {
    captureEmailError(err, "Subscription confirmation email send failed");
    return false;
  }
}

/**
 * Sent once when a Pro user clicks Cancel. Subscription remains active until
 * the end of the paid period; `accessEndsAt` is included when known.
 */
export async function sendSubscriptionCancellationEmail(
  to: string,
  options: {
    displayName?: string | null;
    accessEndsAt?: Date | null;
  } = {}
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(
      "[email] SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS). Cancellation email not sent for",
      to
    );
    return false;
  }
  const safeName = options.displayName?.trim() ? escapeHtml(options.displayName.trim()) : "there";
  const plainName = options.displayName?.trim() || "there";
  const tiersUrl = `${WEB_ORIGIN_FOR_EMAIL}/tiers`;
  const endsLabel =
    options.accessEndsAt && !Number.isNaN(options.accessEndsAt.getTime())
      ? options.accessEndsAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;
  const subject = "Your Geeklogs Pro subscription is cancelled";
  const accessLine = endsLabel
    ? `You'll keep Pro access until ${endsLabel}. After that date your account moves back to the Free plan, and your logs stay with you.`
    : "You'll keep Pro access through the end of the current billing period. After that your account moves back to the Free plan, and your logs stay with you.";
  const text =
    `Hi ${plainName},\n\n` +
    `Your Geeklogs Pro subscription has been cancelled. ${accessLine}\n\n` +
    `Changed your mind? You can resume Pro or pick a different plan any time:\n${tiersUrl}\n\n` +
    `— The Geeklogs team`;
  const html =
    `<p>Hi ${safeName},</p>` +
    `<p>Your <strong>Geeklogs Pro</strong> subscription has been cancelled. ${escapeHtml(accessLine)}</p>` +
    `<p>Changed your mind? You can resume Pro or pick a different plan from your <a href="${tiersUrl}">Plans page</a>.</p>` +
    `<p>— The Geeklogs team</p>`;
  try {
    await transporter.sendMail({ from: SMTP_FROM, to, subject, text, html });
    return true;
  } catch (err) {
    captureEmailError(err, "Subscription cancellation email send failed");
    return false;
  }
}
