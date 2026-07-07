-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('BOT', 'HUMAN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('CUSTOMER', 'BOT', 'HUMAN');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'LOCATION', 'TEMPLATE', 'AUDIO', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "WaDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "TemplateApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED');

-- CreateTable
CREATE TABLE "WaConversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "waId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'BOT',
    "assignedToUserId" TEXT,
    "lastCustomerMsgAt" TIMESTAMP(3),
    "windowExpiresAt" TIMESTAMP(3),
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "optedOutAt" TIMESTAMP(3),
    "lastOrderId" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "senderType" "MessageSenderType" NOT NULL,
    "senderUserId" TEXT,
    "kind" "MessageKind" NOT NULL,
    "body" TEXT,
    "mediaUrl" TEXT,
    "mediaMimeType" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "templateName" TEXT,
    "wamid" TEXT,
    "deliveryStatus" "WaDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "errorDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es',
    "category" TEXT NOT NULL,
    "bodyPreview" TEXT NOT NULL,
    "variablesCount" INTEGER NOT NULL DEFAULT 0,
    "approvalStatus" "TemplateApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "appSecret" TEXT NOT NULL,
    "displayPhone" TEXT,
    "graphApiVersion" TEXT NOT NULL DEFAULT 'v21.0',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WaCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaConversation_tenantId_status_updatedAt_idx" ON "WaConversation"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaConversation_tenantId_waId_key" ON "WaConversation"("tenantId", "waId");

-- CreateIndex
CREATE UNIQUE INDEX "WaMessage_wamid_key" ON "WaMessage"("wamid");

-- CreateIndex
CREATE INDEX "WaMessage_conversationId_createdAt_idx" ON "WaMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "WaMessage_tenantId_wamid_idx" ON "WaMessage"("tenantId", "wamid");

-- CreateIndex
CREATE UNIQUE INDEX "WaTemplate_tenantId_name_language_key" ON "WaTemplate"("tenantId", "name", "language");

-- CreateIndex
CREATE UNIQUE INDEX "WaCredential_tenantId_key" ON "WaCredential"("tenantId");

-- AddForeignKey
ALTER TABLE "WaConversation" ADD CONSTRAINT "WaConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaMessage" ADD CONSTRAINT "WaMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaTemplate" ADD CONSTRAINT "WaTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaCredential" ADD CONSTRAINT "WaCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

