-- CreateTable
CREATE TABLE "GooglePlayPubSubMessage" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GooglePlayPubSubMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GooglePlayPubSubMessage_messageId_key" ON "GooglePlayPubSubMessage"("messageId");
