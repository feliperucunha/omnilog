import type { Response } from "express";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "auth";
const JWT_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 days

/** Production (cross-origin) needs SameSite=None; Secure. Local dev uses Lax. */
const isProduction = process.env.NODE_ENV === "production";

export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}

/**
 * Set httpOnly auth cookie with JWT. Use after login/register/reset-password.
 * Cross-origin (Vercel → Render) requires SameSite=None; Secure in production.
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: JWT_MAX_AGE_SEC * 1000,
    path: "/",
  });
}

/** Clear auth cookie. Use on logout. */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
}
