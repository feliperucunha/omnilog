import { Router } from "express";
import { z } from "zod";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js";
import { startCollectionImportJobAsync, getCollectionImportJob } from "../services/boardGameCollectionImport.service.js";

export const boardGameCollectionImportRouter = Router();
boardGameCollectionImportRouter.use(authMiddleware);

const startSchema = z.object({
  source: z.enum(["bgg", "ludopedia"]),
  bggUsername: z.string().max(120).optional(),
  ludopediaUsername: z.string().max(120).optional(),
  duplicateMode: z.enum(["skip", "replace"]).default("skip"),
});

boardGameCollectionImportRouter.post("/collection-import", async (req: AuthenticatedRequest, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.userId;
  const result = await startCollectionImportJobAsync({
    userId,
    source: parsed.data.source,
    bggUsername: parsed.data.bggUsername,
    ludopediaUsername: parsed.data.ludopediaUsername,
    duplicateMode: parsed.data.duplicateMode,
  });
  if (!result.ok) {
    if (result.code === "COLLECTION_IMPORT_COOLDOWN") {
      res.status(429).json({
        error: result.error,
        code: result.code,
        nextAvailableAt: result.nextAvailableAt,
      });
      return;
    }
    res.status(400).json({ error: result.error, code: result.code });
    return;
  }
  res.status(202).json({ jobId: result.jobId });
});

boardGameCollectionImportRouter.get("/collection-import/:jobId", (req: AuthenticatedRequest, res) => {
  const job = getCollectionImportJob(req.params.jobId, req.user!.userId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    id: job.id,
    status: job.status,
    source: job.source,
    duplicateMode: job.duplicateMode,
    current: job.current,
    total: job.total,
    lastTitle: job.lastTitle,
    error: job.error,
    code: job.code,
    imported: job.imported,
    replaced: job.replaced,
    skipped: job.skipped,
    failed: job.failed,
    created: job.created,
    updated: job.updated,
  });
});
