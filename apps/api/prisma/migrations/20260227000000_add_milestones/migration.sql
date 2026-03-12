-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "medium" "BadgeMedium",
    "threshold" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_metric_scope_medium_threshold_key" ON "Milestone"("metric", "scope", "medium", "threshold");

-- CreateIndex
CREATE INDEX "Milestone_metric_scope_idx" ON "Milestone"("metric", "scope");
