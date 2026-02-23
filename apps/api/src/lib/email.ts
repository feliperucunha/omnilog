import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "OMNILOG <noreply@example.com>";

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * Sends a password reset email with the given link.
 * If SMTP is not configured, logs the link to console (dev) and resolves without sending.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const transporter = getTransporter();
  const subject = "Reset your OMNILOG password";
  const text = `You requested a password reset. Open this link to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`;
  const html = `<p>You requested a password reset. <a href="${resetUrl}">Click here to set a new password</a>.</p><p>Or copy this link: ${resetUrl}</p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`;

  if (!transporter) {
    console.log("[email] SMTP not configured. Password reset link:", resetUrl);
    return;
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}
