import { Router } from "express";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

export const adminRouter = Router();
adminRouter.use(authMiddleware);

/** GET /admin/users - List all users with login count, logs count, last login. Admin only. */
adminRouter.get("/users", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  if (currentUser?.tier !== "admin") {
    res.status(403).json({ error: "Admin only", code: "ADMIN_REQUIRED" });
    return;
  }

  const users = await prisma.user.findMany({
    orderBy: { lastLoginAt: "desc" },
    select: {
      id: true,
      email: true,
      username: true,
      loginCount: true,
      lastLoginAt: true,
      createdAt: true,
      _count: { select: { logs: true } },
    },
  });

  res.json({
    data: users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username ?? null,
      loginCount: u.loginCount,
      logsCount: u._count.logs,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  });
});
