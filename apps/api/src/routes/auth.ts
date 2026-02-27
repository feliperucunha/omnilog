import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sanitizeEmail, sanitizeText } from "../lib/sanitize.js";
import { sendPasswordResetEmail } from "../lib/email.js";
import { setAuthCookie, clearAuthCookie } from "../lib/authCookie.js";
import type { AuthResponse } from "@logeverything/shared";

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/** Password: at least 8 characters, at least one letter and one number. */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((p) => /[a-zA-Z]/.test(p), "Password must contain at least one letter")
  .refine((p) => /\d/.test(p), "Password must contain at least one number");

const usernameSchema = z
  .string()
  .min(2, "Username must be at least 2 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscore and hyphen")
  .trim();

const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().email().max(255).trim(),
  password: passwordSchema,
});

const loginSchema = z.object({
  /** Email or username; validated as non-empty string, lookup by either field. */
  email: z.string().min(1, "Email or username required").max(255).trim(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().max(255).trim(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  password: passwordSchema,
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const email = sanitizeEmail(parsed.data.email);
  if (!email) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }
  const username = sanitizeText(parsed.data.username, 32) ?? parsed.data.username.trim().slice(0, 32);
  const { password } = parsed.data;
  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const existingByUsername = await prisma.user.findUnique({ where: { username } });
  if (existingByUsername) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, password: hashed },
    select: { id: true, username: true, email: true, onboarded: true },
  });
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
  const response: AuthResponse = {
    token,
    user: { id: user.id, username: user.username ?? undefined, email: user.email, onboarded: user.onboarded },
  };
  setAuthCookie(res, token);
  res.status(201).json(response);
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const loginInput = sanitizeEmail(parsed.data.email) ?? parsed.data.email.trim();
  if (!loginInput) {
    res.status(400).json({ error: "Email or username required" });
    return;
  }
  const { password } = parsed.data;
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: loginInput }, { username: loginInput }],
    },
    select: { id: true, username: true, email: true, password: true, onboarded: true },
  });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: "Invalid email/username or password" });
    return;
  }
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
  const response: AuthResponse = {
    token,
    user: { id: user.id, username: user.username ?? undefined, email: user.email, onboarded: user.onboarded },
  };
  setAuthCookie(res, token);
  res.json(response);
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Logged out" });
});

authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const email = sanitizeEmail(parsed.data.email);
  if (!email) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  // Always return 200 to avoid email enumeration
  if (!user) {
    res.json({ message: "If that email is registered, you will receive a reset link." });
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpires: expires },
  });
  const resetUrl = `${WEB_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;
  await sendPasswordResetEmail(user.email, resetUrl);
  res.json({ message: "If that email is registered, you will receive a reset link." });
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const token = sanitizeText(parsed.data.token, 512);
  if (!token) {
    res.status(400).json({ error: "Invalid or expired reset link. Request a new one." });
    return;
  }
  const { password } = parsed.data;
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gt: new Date() },
    },
    select: { id: true, email: true, onboarded: true },
  });
  if (!user) {
    res.status(400).json({ error: "Invalid or expired reset link. Request a new one." });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, username: true, email: true, onboarded: true },
  });
  if (!u) {
    res.status(500).json({ error: "User not found" });
    return;
  }
  const jwtToken = jwt.sign(
    { userId: u.id, email: u.email },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
  const response: AuthResponse = {
    token: jwtToken,
    user: { id: u.id, username: u.username ?? undefined, email: u.email, onboarded: u.onboarded },
  };
  setAuthCookie(res, jwtToken);
  res.json(response);
});
