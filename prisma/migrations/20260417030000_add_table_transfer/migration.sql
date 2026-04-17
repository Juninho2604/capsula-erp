-- CreateTable
CREATE TABLE "TableTransfer" (
    "id"             TEXT NOT NULL,
    "openTabId"      TEXT NOT NULL,
    "fromWaiterId"   TEXT NOT NULL,
    "toWaiterId"     TEXT NOT NULL,
    "authorizedById" TEXT NOT NULL,
    "reason"         TEXT,
    "transferredAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TableTransfer_openTabId_idx"    ON "TableTransfer"("openTabId");
CREATE INDEX "TableTransfer_fromWaiterId_idx" ON "TableTransfer"("fromWaiterId");
CREATE INDEX "TableTransfer_toWaiterId_idx"   ON "TableTransfer"("toWaiterId");

-- AddForeignKey
ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_openTabId_fkey"
    FOREIGN KEY ("openTabId") REFERENCES "OpenTab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_fromWaiterId_fkey"
    FOREIGN KEY ("fromWaiterId") REFERENCES "Waiter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_toWaiterId_fkey"
    FOREIGN KEY ("toWaiterId") REFERENCES "Waiter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_authorizedById_fkey"
    FOREIGN KEY ("authorizedById") REFERENCES "Waiter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
