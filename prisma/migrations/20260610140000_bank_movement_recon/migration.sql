-- Conciliación por movimiento (Fase 3). Safe en prod viva: solo CREATE TABLE.

CREATE TABLE "BankMovementRecon" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "counterpartyType" TEXT NOT NULL DEFAULT 'NATURAL',
    "commissionRemoved" BOOLEAN NOT NULL DEFAULT false,
    "commissionOverridePct" DOUBLE PRECISION,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "statementAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "reconciledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "BankMovementRecon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankMovementRecon_tenantId_idx" ON "BankMovementRecon"("tenantId");
CREATE INDEX "BankMovementRecon_bankAccountId_idx" ON "BankMovementRecon"("bankAccountId");
CREATE INDEX "BankMovementRecon_date_idx" ON "BankMovementRecon"("date");
CREATE UNIQUE INDEX "BankMovementRecon_tenantId_sourceType_sourceId_key" ON "BankMovementRecon"("tenantId", "sourceType", "sourceId");

ALTER TABLE "BankMovementRecon" ADD CONSTRAINT "BankMovementRecon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
