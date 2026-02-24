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

const registerSchema = z.object({
  email: z.string().email().max(255).trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email().max(255).trim(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().max(255).trim(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  password: z.string().min(8, "Password must be at least 8 characters"),
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
  const { password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashed },
    select: { id: true, email: true, onboarded: true },
  });
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  const response: AuthResponse = {
    token,
    user: { id: user.id, email: user.email, onboarded: user.onboarded },
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
  const email = sanitizeEmail(parsed.data.email);
  if (!email) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }
  const { password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, password: true, onboarded: true },
  });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  const response: AuthResponse = {
    token,
    user: { id: user.id, email: user.email, onboarded: user.onboarded },
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
  const jwtToken = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  const response: AuthResponse = {
    token: jwtToken,
    user: { id: user.id, email: user.email, onboarded: user.onboarded },
  };
  setAuthCookie(res, jwtToken);
  res.json(response);
});
