-- Tesorería / Conciliación bancaria — Fase 2.
-- Safe en producción viva: solo CREATE TABLE. No toca datos existentes.

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fiscalWeek" TEXT NOT NULL,
    "expectedIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionCalc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statementIn" DOUBLE PRECISION,
    "commissionStmt" DOUBLE PRECISION,
    "differential" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "rateAtSettle" DOUBLE PRECISION,
    "bcvLossUsd" DOUBLE PRECISION,
    "postedExpenseId" TEXT,
    "notes" TEXT,
    "reconciledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankReconciliation_tenantId_idx" ON "BankReconciliation"("tenantId");
CREATE INDEX "BankReconciliation_bankAccountId_idx" ON "BankReconciliation"("bankAccountId");
CREATE INDEX "BankReconciliation_date_idx" ON "BankReconciliation"("date");
CREATE INDEX "BankReconciliation_status_idx" ON "BankReconciliation"("status");
CREATE UNIQUE INDEX "BankReconciliation_tenantId_bankAccountId_date_key" ON "BankReconciliation"("tenantId", "bankAccountId", "date");

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
