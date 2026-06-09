-- Cuentas por Cobrar — "nos deben" (Fase 4).
-- Safe en producción viva: solo CREATE TABLE. No toca datos existentes.

-- CreateTable
CREATE TABLE "AccountReceivable" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "debtorName" TEXT NOT NULL,
    "customerId" TEXT,
    "totalAmountUsd" DOUBLE PRECISION NOT NULL,
    "collectedAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingUsd" DOUBLE PRECISION NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "fullyCollectedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "AccountReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivablePayment" (
    "id" TEXT NOT NULL,
    "accountReceivableId" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "amountBs" DOUBLE PRECISION,
    "exchangeRate" DOUBLE PRECISION,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "bankAccountId" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ReceivablePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountReceivable_status_idx" ON "AccountReceivable"("status");
CREATE INDEX "AccountReceivable_dueDate_idx" ON "AccountReceivable"("dueDate");
CREATE INDEX "AccountReceivable_tenantId_idx" ON "AccountReceivable"("tenantId");

-- CreateIndex
CREATE INDEX "ReceivablePayment_accountReceivableId_idx" ON "ReceivablePayment"("accountReceivableId");
CREATE INDEX "ReceivablePayment_collectedAt_idx" ON "ReceivablePayment"("collectedAt");
CREATE INDEX "ReceivablePayment_tenantId_idx" ON "ReceivablePayment"("tenantId");

-- AddForeignKey
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_accountReceivableId_fkey" FOREIGN KEY ("accountReceivableId") REFERENCES "AccountReceivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
