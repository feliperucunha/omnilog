import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js";

export const followsRouter = Router();
followsRouter.use(authMiddleware);

const followBodySchema = z.object({
  userId: z.string().min(1).max(100),
});

/** GET /follows - List users the current user follows. Returns { data: Array<{ id, username }> }. */
followsRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const followerId = req.user!.userId;
  const followings = await prisma.follow.findMany({
    where: { followerId },
    select: {
      following: {
        select: { id: true, username: true },
      },
    },
  });
  const data = followings.map((f) => ({
    id: f.following.id,
    username: f.following.username ?? null,
  }));
  res.json({ data });
});

/** POST /follows - Follow a user. Body: { userId }. */
followsRouter.post("/", async (req: AuthenticatedRequest, res: Response) => {
  const followerId = req.user!.userId;
  const parsed = followBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const followingId = parsed.data.userId;
  if (followerId === followingId) {
    res.status(400).json({ error: "Cannot follow yourself" });
    return;
  }
  const target = await prisma.user.findUnique({
    where: { id: followingId },
    select: { id: true },
  });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await prisma.follow.upsert({
    where: {
      followerId_followingId: { followerId, followingId },
    },
    create: { followerId, followingId },
    update: {},
  });
  res.status(204).send();
});

/** DELETE /follows/:userId - Unfollow a user. */
followsRouter.delete("/:userId", async (req: AuthenticatedRequest, res: Response) => {
  const followerId = req.user!.userId;
  const followingId = req.params.userId;
  if (!followingId) {
    res.status(400).json({ error: "User id required" });
    return;
  }
  await prisma.follow.deleteMany({
    where: { followerId, followingId },
  });
  res.status(204).send();
});

/** GET /follows/status/:userId - Returns { following: boolean } for the current user and given profile user. */
followsRouter.get("/status/:userId", async (req: AuthenticatedRequest, res: Response) => {
  const followerId = req.user!.userId;
  const followingId = req.params.userId;
  if (!followingId) {
    res.status(400).json({ error: "User id required" });
    return;
  }
  const follow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: { followerId, followingId },
    },
  });
  res.json({ following: !!follow });
});
