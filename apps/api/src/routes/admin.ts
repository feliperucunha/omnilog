import { Router, type Response } from "express";
import { z } from "zod";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import {
  isKnownFeatureFlagKey,
  listFeatureFlags,
  setFeatureFlagEnabled,
} from "../lib/featureFlags.js";
import { APP_SETTING_KEYS, upsertAppSettingValue } from "../lib/appSettings.js";

export const adminRouter = Router();
adminRouter.use(authMiddleware);

const patchFeatureFlagSchema = z.object({ enabled: z.boolean() });
const patchBetaBannerSchema = z.object({ message: z.string().trim().min(1).max(4000) });

async function requireAdmin(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  const userId = req.user!.userId;
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  if (currentUser?.tier !== "admin") {
    res.status(403).json({ error: "Admin only", code: "ADMIN_REQUIRED" });
    return false;
  }
  return true;
}

/** GET /admin/users - List all users with login count, logs count, last login. Admin only. */
adminRouter.get("/users", async (req: AuthenticatedRequest, res) => {
  if (!(await requireAdmin(req, res))) return;

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

/** GET /admin/feature-flags - List app feature flags. Admin only. */
adminRouter.get("/feature-flags", async (req: AuthenticatedRequest, res) => {
  if (!(await requireAdmin(req, res))) return;
  const flags = await listFeatureFlags();
  res.json({
    data: flags.map((f) => ({
      key: f.key,
      enabled: f.enabled,
      updatedAt: f.updatedAt.toISOString(),
    })),
  });
});

/**
 * PATCH /admin/feature-flags/:key
 * Body: { enabled: boolean }. Admin only.
 */
adminRouter.patch("/feature-flags/:key", async (req: AuthenticatedRequest, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { key } = req.params;
  if (!isKnownFeatureFlagKey(key)) {
    res.status(400).json({ error: "Unknown feature flag key", code: "UNKNOWN_FEATURE_FLAG" });
    return;
  }
  const parsed = patchFeatureFlagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", code: "VALIDATION_ERROR" });
    return;
  }
  try {
    const updated = await setFeatureFlagEnabled(key, parsed.data.enabled);
    res.json({
      data: {
        key: updated.key,
        enabled: updated.enabled,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch {
    res.status(404).json({ error: "Feature flag not found", code: "FEATURE_FLAG_NOT_FOUND" });
  }
});

/** GET /admin/beta-banner - Read beta banner message (admin only). */
adminRouter.get("/beta-banner", async (req: AuthenticatedRequest, res) => {
  if (!(await requireAdmin(req, res))) return;
  // message is optional (default is computed client-side), but admin UI needs current value.
  const row = await prisma.appSetting.findUnique({
    where: { key: APP_SETTING_KEYS.BETA_BANNER_MESSAGE },
    select: { value: true, updatedAt: true },
  });
  res.json({
    data: {
      message: row?.value ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    },
  });
});

/** PATCH /admin/beta-banner - Update beta banner message (admin only). */
adminRouter.patch("/beta-banner", async (req: AuthenticatedRequest, res) => {
  if (!(await requireAdmin(req, res))) return;
  const parsed = patchBetaBannerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", code: "VALIDATION_ERROR" });
    return;
  }
  const updated = await upsertAppSettingValue(APP_SETTING_KEYS.BETA_BANNER_MESSAGE, parsed.data.message);
  res.json({
    data: {
      key: updated.key,
      message: updated.value,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});
