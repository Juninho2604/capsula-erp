-- Tesorería / Conciliación bancaria — Fase 0.
-- Safe en producción viva: solo CREATE TABLE + ADD COLUMN nullable.
-- No toca datos existentes ni agrega NOT NULL sin default.

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'BS',
    "kind" TEXT NOT NULL DEFAULT 'BANK',
    "rif" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosTerminal" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "terminalCode" TEXT,
    "posMethodKey" TEXT,
    "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "PosTerminal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankAccount_tenantId_idx" ON "BankAccount"("tenantId");
CREATE INDEX "BankAccount_isActive_idx" ON "BankAccount"("isActive");
CREATE UNIQUE INDEX "BankAccount_tenantId_name_key" ON "BankAccount"("tenantId", "name");

-- CreateIndex
CREATE INDEX "PosTerminal_tenantId_idx" ON "PosTerminal"("tenantId");
CREATE INDEX "PosTerminal_bankAccountId_idx" ON "PosTerminal"("bankAccountId");
CREATE INDEX "PosTerminal_posMethodKey_idx" ON "PosTerminal"("posMethodKey");
CREATE UNIQUE INDEX "PosTerminal_tenantId_label_key" ON "PosTerminal"("tenantId", "label");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosTerminal" ADD CONSTRAINT "PosTerminal_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosTerminal" ADD CONSTRAINT "PosTerminal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Etiquetado: cuenta bancaria asociada a cada movimiento de dinero (nullable).
-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "bankAccountId" TEXT;
ALTER TABLE "AccountPayment" ADD COLUMN "bankAccountId" TEXT;
ALTER TABLE "SalesOrderPayment" ADD COLUMN "bankAccountId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_bankAccountId_idx" ON "Expense"("bankAccountId");
CREATE INDEX "AccountPayment_bankAccountId_idx" ON "AccountPayment"("bankAccountId");
CREATE INDEX "SalesOrderPayment_bankAccountId_idx" ON "SalesOrderPayment"("bankAccountId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountPayment" ADD CONSTRAINT "AccountPayment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrderPayment" ADD CONSTRAINT "SalesOrderPayment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
