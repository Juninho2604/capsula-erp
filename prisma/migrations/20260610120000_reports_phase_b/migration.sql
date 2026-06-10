-- Reportes FASE B (DIAGNOSTICO_REPORTES.md §5-§6) — 100% aditiva, safe en
-- producción viva (§44): solo ADD COLUMN nullable + CREATE INDEX + FK sobre
-- columna nueva (tabla con pocas filas, lock breve). Idempotente con guards.

-- M1 — Dual currency en cobros de mesa (BUG #3): persistir monto Bs y tasa
-- histórica en cada PaymentSplit. Lo histórico queda NULL (= "Bs no
-- registrado"; los reportes NO deben reconvertir con tasa actual).
ALTER TABLE "PaymentSplit" ADD COLUMN IF NOT EXISTS "amountBs" DOUBLE PRECISION;
ALTER TABLE "PaymentSplit" ADD COLUMN IF NOT EXISTS "exchangeRate" DOUBLE PRECISION;

-- M2 — Vínculo venta→turno de caja (BUG #4): habilita Reporte X por turno.
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "cashRegisterId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SalesOrder_cashRegisterId_fkey'
    ) THEN
        ALTER TABLE "SalesOrder"
            ADD CONSTRAINT "SalesOrder_cashRegisterId_fkey"
            FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SalesOrder_cashRegisterId_idx" ON "SalesOrder"("cashRegisterId");

-- M3 — Timestamp de cocina lista (BUG #11): habilita tiempos de cocina.
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "kitchenReadyAt" TIMESTAMP(3);

-- M5 — Índices compuestos para el patrón de reportes (tenantId + fecha).
-- Tablas chicas hoy (~5k filas SalesOrder) → CREATE INDEX normal, sin
-- CONCURRENTLY (prisma migrate corre en transacción).
CREATE INDEX IF NOT EXISTS "SalesOrder_tenantId_createdAt_idx"     ON "SalesOrder"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "SalesOrder_tenantId_voidedAt_idx"      ON "SalesOrder"("tenantId", "voidedAt");
CREATE INDEX IF NOT EXISTS "Expense_tenantId_paidAt_idx"           ON "Expense"("tenantId", "paidAt");
CREATE INDEX IF NOT EXISTS "CashRegister_tenantId_shiftDate_idx"   ON "CashRegister"("tenantId", "shiftDate");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_tenantId_orderDate_idx"  ON "PurchaseOrder"("tenantId", "orderDate");
CREATE INDEX IF NOT EXISTS "InventoryMovement_inventoryItemId_createdAt_idx" ON "InventoryMovement"("inventoryItemId", "createdAt");
CREATE INDEX IF NOT EXISTS "InventoryMovement_movementType_createdAt_idx"    ON "InventoryMovement"("movementType", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_createdAt_idx"       ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentSplit_paidAt_idx"               ON "PaymentSplit"("paidAt");
