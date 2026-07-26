-- CreateTable
CREATE TABLE "InventoryCountSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "blindMode" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedById" TEXT,
    "appliedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "weeklyCountId" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "InventoryCountSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountSessionArea" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryCountSessionArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountEntry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "qtyCounted" DOUBLE PRECISION NOT NULL,
    "stockAtEntry" DOUBLE PRECISION NOT NULL,
    "countedById" TEXT NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail" TEXT,

    CONSTRAINT "InventoryCountEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryCountSession_tenantId_status_idx" ON "InventoryCountSession"("tenantId", "status");

-- CreateIndex
CREATE INDEX "InventoryCountSession_lastActivityAt_idx" ON "InventoryCountSession"("lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountSession_tenantId_code_key" ON "InventoryCountSession"("tenantId", "code");

-- CreateIndex
CREATE INDEX "InventoryCountSessionArea_sessionId_idx" ON "InventoryCountSessionArea"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountSessionArea_sessionId_areaId_key" ON "InventoryCountSessionArea"("sessionId", "areaId");

-- CreateIndex
CREATE INDEX "InventoryCountEntry_sessionId_idx" ON "InventoryCountEntry"("sessionId");

-- CreateIndex
CREATE INDEX "InventoryCountEntry_inventoryItemId_idx" ON "InventoryCountEntry"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountEntry_sessionId_inventoryItemId_areaId_key" ON "InventoryCountEntry"("sessionId", "inventoryItemId", "areaId");

-- CreateIndex
CREATE INDEX "InventoryCountEvent_sessionId_at_idx" ON "InventoryCountEvent"("sessionId", "at");

-- AddForeignKey
ALTER TABLE "InventoryCountSession" ADD CONSTRAINT "InventoryCountSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountSession" ADD CONSTRAINT "InventoryCountSession_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountSession" ADD CONSTRAINT "InventoryCountSession_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountSession" ADD CONSTRAINT "InventoryCountSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountSessionArea" ADD CONSTRAINT "InventoryCountSessionArea_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InventoryCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountSessionArea" ADD CONSTRAINT "InventoryCountSessionArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountEntry" ADD CONSTRAINT "InventoryCountEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InventoryCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountEntry" ADD CONSTRAINT "InventoryCountEntry_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountEntry" ADD CONSTRAINT "InventoryCountEntry_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountEvent" ADD CONSTRAINT "InventoryCountEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InventoryCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountEvent" ADD CONSTRAINT "InventoryCountEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

