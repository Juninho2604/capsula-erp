-- AlterTable OpenTab: waiterProfileId FK a Waiter
ALTER TABLE "OpenTab" ADD COLUMN "waiterProfileId" TEXT;

-- AlterTable SalesOrder: waiterProfileId FK a Waiter
ALTER TABLE "SalesOrder" ADD COLUMN "waiterProfileId" TEXT;

-- CreateTable TableTransfer
CREATE TABLE "TableTransfer" (
    "id" TEXT NOT NULL,
    "openTabId" TEXT NOT NULL,
    "fromWaiterId" TEXT NOT NULL,
    "toWaiterId" TEXT NOT NULL,
    "reason" TEXT,
    "authorizedByWaiterId" TEXT,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TableTransfer_openTabId_idx" ON "TableTransfer"("openTabId");
CREATE INDEX "TableTransfer_fromWaiterId_idx" ON "TableTransfer"("fromWaiterId");
CREATE INDEX "TableTransfer_toWaiterId_idx" ON "TableTransfer"("toWaiterId");
CREATE INDEX "OpenTab_waiterProfileId_idx" ON "OpenTab"("waiterProfileId");
CREATE INDEX "SalesOrder_waiterProfileId_idx" ON "SalesOrder"("waiterProfileId");

-- AddForeignKey
ALTER TABLE "OpenTab" ADD CONSTRAINT "OpenTab_waiterProfileId_fkey"
    FOREIGN KEY ("waiterProfileId") REFERENCES "Waiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_waiterProfileId_fkey"
    FOREIGN KEY ("waiterProfileId") REFERENCES "Waiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_openTabId_fkey"
    FOREIGN KEY ("openTabId") REFERENCES "OpenTab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_fromWaiterId_fkey"
    FOREIGN KEY ("fromWaiterId") REFERENCES "Waiter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_toWaiterId_fkey"
    FOREIGN KEY ("toWaiterId") REFERENCES "Waiter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_authorizedByWaiterId_fkey"
    FOREIGN KEY ("authorizedByWaiterId") REFERENCES "Waiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
