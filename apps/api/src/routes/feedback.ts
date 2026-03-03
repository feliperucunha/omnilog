import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(10),
  comments: z.string().max(2000).optional(),
});

export const feedbackRouter = Router();

feedbackRouter.post(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) return;
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid feedback: rating 1–10 required" });
      return;
    }
    const { rating, comments } = parsed.data;
    await prisma.feedback.create({
      data: {
        userId: req.user.userId,
        rating,
        comments: comments?.trim() || null,
      },
    });
    res.status(201).json({ ok: true });
  }
);
