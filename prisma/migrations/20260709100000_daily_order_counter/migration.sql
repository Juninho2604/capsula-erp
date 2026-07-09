-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "dailyLabel" TEXT,
ADD COLUMN     "dailyNumber" INTEGER;

-- AlterTable
ALTER TABLE "OpenTab" ADD COLUMN     "dailyLabel" TEXT,
ADD COLUMN     "dailyNumber" INTEGER;

-- CreateTable
CREATE TABLE "DailyOrderCounter" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "DailyOrderCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyOrderCounter_tenantId_dayKey_idx" ON "DailyOrderCounter"("tenantId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyOrderCounter_tenantId_scope_dayKey_key" ON "DailyOrderCounter"("tenantId", "scope", "dayKey");

-- AddForeignKey
ALTER TABLE "DailyOrderCounter" ADD CONSTRAINT "DailyOrderCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

