-- ============================================================================
-- Multi-tenant Fase 2.B: uniques globales → uniques compuestos (tenantId, X)
-- ============================================================================
--
-- Esta migración es segura porque:
--   1. Hoy solo existe un tenant ('tnt_shanklish_caracas'). El nuevo unique
--      compuesto NO puede tener conflictos con datos existentes porque los
--      valores ya eran únicos globalmente (y por tanto únicos dentro del tenant).
--   2. Todas las operaciones DDL corren en una sola transacción atómica
--      (prisma migrate deploy). Postgres no expone estado intermedio.
--   3. Para cada índice se usa: ALTER TABLE DROP CONSTRAINT IF EXISTS + DROP
--      INDEX IF EXISTS. Esto cubre tanto el caso de unique definido como
--      constraint como el caso de unique definido como índice puro, sin
--      fallar si por alguna razón (manual cleanup, repair previo) el objeto
--      ya no existe.
--   4. Auditado: ningún FK referencia estos campos como destination — todos
--      los FKs van por id. No hay riesgo de bloqueo por dependencias.
--   5. IntercompanySettlement.code queda intacto (su modelo no es tenant-aware).
--   6. GameSession.reservationId queda intacto (relación 1:1 con Reservation,
--      cuyo id ya es único globalmente).
--
-- Modelos afectados (20):
--   User.email, InventoryItem.sku, ProductionOrder.orderNumber,
--   ProteinProcessing.code, Requisition.code, MenuItem.sku,
--   SalesOrder.orderNumber, Supplier.code, PurchaseOrder.orderNumber,
--   ExpenseCategory.name, Branch.code, OpenTab.tabCode,
--   InvoiceCounter.channel, GameType.code, GameStation.code,
--   WristbandPlan.code, Reservation.code, GameSession.code,
--   ProductFamily.code, InventoryCycle.code.
-- ============================================================================

-- ============================================================================
-- User.email
-- ============================================================================
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- ============================================================================
-- InventoryItem.sku
-- ============================================================================
ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_sku_key";
DROP INDEX IF EXISTS "InventoryItem_sku_key";
CREATE UNIQUE INDEX "InventoryItem_tenantId_sku_key" ON "InventoryItem"("tenantId", "sku");

-- ============================================================================
-- ProductionOrder.orderNumber
-- ============================================================================
ALTER TABLE "ProductionOrder" DROP CONSTRAINT IF EXISTS "ProductionOrder_orderNumber_key";
DROP INDEX IF EXISTS "ProductionOrder_orderNumber_key";
CREATE UNIQUE INDEX "ProductionOrder_tenantId_orderNumber_key" ON "ProductionOrder"("tenantId", "orderNumber");

-- ============================================================================
-- ProteinProcessing.code
-- ============================================================================
ALTER TABLE "ProteinProcessing" DROP CONSTRAINT IF EXISTS "ProteinProcessing_code_key";
DROP INDEX IF EXISTS "ProteinProcessing_code_key";
CREATE UNIQUE INDEX "ProteinProcessing_tenantId_code_key" ON "ProteinProcessing"("tenantId", "code");

-- ============================================================================
-- Requisition.code
-- ============================================================================
ALTER TABLE "Requisition" DROP CONSTRAINT IF EXISTS "Requisition_code_key";
DROP INDEX IF EXISTS "Requisition_code_key";
CREATE UNIQUE INDEX "Requisition_tenantId_code_key" ON "Requisition"("tenantId", "code");

-- ============================================================================
-- MenuItem.sku
-- ============================================================================
ALTER TABLE "MenuItem" DROP CONSTRAINT IF EXISTS "MenuItem_sku_key";
DROP INDEX IF EXISTS "MenuItem_sku_key";
CREATE UNIQUE INDEX "MenuItem_tenantId_sku_key" ON "MenuItem"("tenantId", "sku");

-- ============================================================================
-- SalesOrder.orderNumber
-- ============================================================================
ALTER TABLE "SalesOrder" DROP CONSTRAINT IF EXISTS "SalesOrder_orderNumber_key";
DROP INDEX IF EXISTS "SalesOrder_orderNumber_key";
CREATE UNIQUE INDEX "SalesOrder_tenantId_orderNumber_key" ON "SalesOrder"("tenantId", "orderNumber");

-- ============================================================================
-- Supplier.code  (nullable — Postgres permite múltiples NULL en uniques)
-- ============================================================================
ALTER TABLE "Supplier" DROP CONSTRAINT IF EXISTS "Supplier_code_key";
DROP INDEX IF EXISTS "Supplier_code_key";
CREATE UNIQUE INDEX "Supplier_tenantId_code_key" ON "Supplier"("tenantId", "code");

-- ============================================================================
-- PurchaseOrder.orderNumber
-- ============================================================================
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_orderNumber_key";
DROP INDEX IF EXISTS "PurchaseOrder_orderNumber_key";
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_orderNumber_key" ON "PurchaseOrder"("tenantId", "orderNumber");

-- ============================================================================
-- ExpenseCategory.name
-- ============================================================================
ALTER TABLE "ExpenseCategory" DROP CONSTRAINT IF EXISTS "ExpenseCategory_name_key";
DROP INDEX IF EXISTS "ExpenseCategory_name_key";
CREATE UNIQUE INDEX "ExpenseCategory_tenantId_name_key" ON "ExpenseCategory"("tenantId", "name");

-- ============================================================================
-- Branch.code
-- ============================================================================
ALTER TABLE "Branch" DROP CONSTRAINT IF EXISTS "Branch_code_key";
DROP INDEX IF EXISTS "Branch_code_key";
CREATE UNIQUE INDEX "Branch_tenantId_code_key" ON "Branch"("tenantId", "code");

-- ============================================================================
-- OpenTab.tabCode
-- ============================================================================
ALTER TABLE "OpenTab" DROP CONSTRAINT IF EXISTS "OpenTab_tabCode_key";
DROP INDEX IF EXISTS "OpenTab_tabCode_key";
CREATE UNIQUE INDEX "OpenTab_tenantId_tabCode_key" ON "OpenTab"("tenantId", "tabCode");

-- ============================================================================
-- InvoiceCounter.channel
-- ============================================================================
ALTER TABLE "InvoiceCounter" DROP CONSTRAINT IF EXISTS "InvoiceCounter_channel_key";
DROP INDEX IF EXISTS "InvoiceCounter_channel_key";
CREATE UNIQUE INDEX "InvoiceCounter_tenantId_channel_key" ON "InvoiceCounter"("tenantId", "channel");

-- ============================================================================
-- GameType.code
-- ============================================================================
ALTER TABLE "GameType" DROP CONSTRAINT IF EXISTS "GameType_code_key";
DROP INDEX IF EXISTS "GameType_code_key";
CREATE UNIQUE INDEX "GameType_tenantId_code_key" ON "GameType"("tenantId", "code");

-- ============================================================================
-- GameStation.code
-- ============================================================================
ALTER TABLE "GameStation" DROP CONSTRAINT IF EXISTS "GameStation_code_key";
DROP INDEX IF EXISTS "GameStation_code_key";
CREATE UNIQUE INDEX "GameStation_tenantId_code_key" ON "GameStation"("tenantId", "code");

-- ============================================================================
-- WristbandPlan.code
-- ============================================================================
ALTER TABLE "WristbandPlan" DROP CONSTRAINT IF EXISTS "WristbandPlan_code_key";
DROP INDEX IF EXISTS "WristbandPlan_code_key";
CREATE UNIQUE INDEX "WristbandPlan_tenantId_code_key" ON "WristbandPlan"("tenantId", "code");

-- ============================================================================
-- Reservation.code
-- ============================================================================
ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS "Reservation_code_key";
DROP INDEX IF EXISTS "Reservation_code_key";
CREATE UNIQUE INDEX "Reservation_tenantId_code_key" ON "Reservation"("tenantId", "code");

-- ============================================================================
-- GameSession.code
-- ============================================================================
ALTER TABLE "GameSession" DROP CONSTRAINT IF EXISTS "GameSession_code_key";
DROP INDEX IF EXISTS "GameSession_code_key";
CREATE UNIQUE INDEX "GameSession_tenantId_code_key" ON "GameSession"("tenantId", "code");

-- ============================================================================
-- ProductFamily.code
-- ============================================================================
ALTER TABLE "ProductFamily" DROP CONSTRAINT IF EXISTS "ProductFamily_code_key";
DROP INDEX IF EXISTS "ProductFamily_code_key";
CREATE UNIQUE INDEX "ProductFamily_tenantId_code_key" ON "ProductFamily"("tenantId", "code");

-- ============================================================================
-- InventoryCycle.code
-- ============================================================================
ALTER TABLE "InventoryCycle" DROP CONSTRAINT IF EXISTS "InventoryCycle_code_key";
DROP INDEX IF EXISTS "InventoryCycle_code_key";
CREATE UNIQUE INDEX "InventoryCycle_tenantId_code_key" ON "InventoryCycle"("tenantId", "code");
