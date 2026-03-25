-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "Log_userId_updatedAt_idx" ON "Log"("userId", "updatedAt");
