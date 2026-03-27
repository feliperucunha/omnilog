import nodemailer from "nodemailer";
import { Sentry } from "../instrument-sentry.js";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "Geeklogs <noreply@example.com>";

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
