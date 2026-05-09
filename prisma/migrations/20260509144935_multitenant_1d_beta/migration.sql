-- ============================================================================
-- Multi-tenant Step 1.D-β — tenantId + backfill en lote RIESGO MEDIO
--
-- 12 modelos administrativos/financieros: ProductionOrder, ProteinProcessing,
-- Requisition, DailyInventory, InventoryLoan, InventoryAudit, PurchaseOrder,
-- Expense, CashRegister, AccountPayable, AccountPayment, InventoryCycle.
--
-- Cada modelo en la misma transacción:
--   1. ALTER TABLE ADD COLUMN tenantId TEXT NULL
--   2. ADD CONSTRAINT FK ON DELETE RESTRICT
--   3. CREATE INDEX en tenantId
--   4. UPDATE SET tenantId = 'tnt_shanklish_caracas' WHERE tenantId IS NULL
--
-- Riesgo medio: estos modelos se usan en flujos administrativos (gestión de
-- compras, gastos, cuentas, auditorías). NO en la ruta del POS de cajeros/
-- meseros, pero un fallo aquí afectaría operaciones administrativas hasta
-- el rollback.
--
-- Atomicidad: toda la migration en transacción Postgres → ROLLBACK completo
-- si algo falla.
-- ============================================================================

-- ─── ProductionOrder ────────────────────────────────────────────────────────
ALTER TABLE "ProductionOrder" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ProductionOrder"
  ADD CONSTRAINT "ProductionOrder_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ProductionOrder_tenantId_idx" ON "ProductionOrder"("tenantId");
UPDATE "ProductionOrder" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── ProteinProcessing ──────────────────────────────────────────────────────
ALTER TABLE "ProteinProcessing" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ProteinProcessing"
  ADD CONSTRAINT "ProteinProcessing_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ProteinProcessing_tenantId_idx" ON "ProteinProcessing"("tenantId");
UPDATE "ProteinProcessing" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── Requisition ────────────────────────────────────────────────────────────
ALTER TABLE "Requisition" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Requisition"
  ADD CONSTRAINT "Requisition_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Requisition_tenantId_idx" ON "Requisition"("tenantId");
UPDATE "Requisition" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── DailyInventory ─────────────────────────────────────────────────────────
ALTER TABLE "DailyInventory" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "DailyInventory"
  ADD CONSTRAINT "DailyInventory_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "DailyInventory_tenantId_idx" ON "DailyInventory"("tenantId");
UPDATE "DailyInventory" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── InventoryLoan ──────────────────────────────────────────────────────────
ALTER TABLE "InventoryLoan" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "InventoryLoan"
  ADD CONSTRAINT "InventoryLoan_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "InventoryLoan_tenantId_idx" ON "InventoryLoan"("tenantId");
UPDATE "InventoryLoan" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── InventoryAudit ─────────────────────────────────────────────────────────
ALTER TABLE "InventoryAudit" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "InventoryAudit"
  ADD CONSTRAINT "InventoryAudit_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "InventoryAudit_tenantId_idx" ON "InventoryAudit"("tenantId");
UPDATE "InventoryAudit" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── PurchaseOrder ──────────────────────────────────────────────────────────
ALTER TABLE "PurchaseOrder" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");
UPDATE "PurchaseOrder" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── Expense ────────────────────────────────────────────────────────────────
ALTER TABLE "Expense" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Expense_tenantId_idx" ON "Expense"("tenantId");
UPDATE "Expense" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── CashRegister ───────────────────────────────────────────────────────────
ALTER TABLE "CashRegister" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CashRegister"
  ADD CONSTRAINT "CashRegister_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CashRegister_tenantId_idx" ON "CashRegister"("tenantId");
UPDATE "CashRegister" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── AccountPayable ─────────────────────────────────────────────────────────
ALTER TABLE "AccountPayable" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "AccountPayable"
  ADD CONSTRAINT "AccountPayable_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AccountPayable_tenantId_idx" ON "AccountPayable"("tenantId");
UPDATE "AccountPayable" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── AccountPayment ─────────────────────────────────────────────────────────
ALTER TABLE "AccountPayment" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "AccountPayment"
  ADD CONSTRAINT "AccountPayment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AccountPayment_tenantId_idx" ON "AccountPayment"("tenantId");
UPDATE "AccountPayment" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── InventoryCycle ─────────────────────────────────────────────────────────
ALTER TABLE "InventoryCycle" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "InventoryCycle"
  ADD CONSTRAINT "InventoryCycle_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "InventoryCycle_tenantId_idx" ON "InventoryCycle"("tenantId");
UPDATE "InventoryCycle" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;
