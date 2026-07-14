-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "rif" TEXT;

-- AlterTable
ALTER TABLE "AccountPayable" ADD COLUMN     "retentionIslrUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "retentionIvaUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AccountPayment" ADD COLUMN     "isCash" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supplierAdvanceId" TEXT;

-- CreateTable
CREATE TABLE "SupplierAdvance" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "amountBs" DOUBLE PRECISION,
    "exchangeRate" DOUBLE PRECISION,
    "paymentMethod" TEXT NOT NULL,
    "paymentRef" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "appliedAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "voidReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "SupplierAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierAdvance_tenantId_idx" ON "SupplierAdvance"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierAdvance_supplierId_idx" ON "SupplierAdvance"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierAdvance_status_idx" ON "SupplierAdvance"("status");

-- CreateIndex
CREATE INDEX "SupplierAdvance_paidAt_idx" ON "SupplierAdvance"("paidAt");

-- AddForeignKey
ALTER TABLE "AccountPayment" ADD CONSTRAINT "AccountPayment_supplierAdvanceId_fkey" FOREIGN KEY ("supplierAdvanceId") REFERENCES "SupplierAdvance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAdvance" ADD CONSTRAINT "SupplierAdvance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAdvance" ADD CONSTRAINT "SupplierAdvance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAdvance" ADD CONSTRAINT "SupplierAdvance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

