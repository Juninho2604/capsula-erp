-- AlterTable
ALTER TABLE "Waiter" ADD COLUMN "pin" TEXT;
ALTER TABLE "Waiter" ADD COLUMN "isCaptain" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OpenTab" ADD COLUMN "waiterProfileId" TEXT;

-- AddForeignKey
ALTER TABLE "OpenTab" ADD CONSTRAINT "OpenTab_waiterProfileId_fkey" FOREIGN KEY ("waiterProfileId") REFERENCES "Waiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "OpenTab_waiterProfileId_idx" ON "OpenTab"("waiterProfileId");
