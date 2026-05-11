-- Multi-tenant Fase 2.B: convertir uniques globales a uniques compuestos
-- (tenantId, X). Esta migración es segura porque:
--   1. Hoy solo existe un tenant ('tnt_shanklish_caracas'), por lo que el
--      nuevo unique compuesto NO puede tener conflictos con datos existentes.
--   2. Todas las operaciones DDL corren en una sola transacción atómica
--      (gestionada por prisma migrate deploy). Postgres no expone estado
--      intermedio a clientes concurrentes.
--   3. IntercompanySettlement.code queda intacto (su modelo no es tenant-aware).
--
-- Para cada modelo: DROP el unique single-column, CREATE el composite.

-- ============================================================================
-- User.email
-- ============================================================================
DROP INDEX "User_email_key";
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- ============================================================================
-- InventoryItem.sku
-- ============================================================================
DROP INDEX "InventoryItem_sku_key";
CREATE UNIQUE INDEX "InventoryItem_tenantId_sku_key" ON "InventoryItem"("tenantId", "sku");

-- ============================================================================
-- ProductionOrder.orderNumber
-- ============================================================================
DROP INDEX "ProductionOrder_orderNumber_key";
CREATE UNIQUE INDEX "ProductionOrder_tenantId_orderNumber_key" ON "ProductionOrder"("tenantId", "orderNumber");

-- ============================================================================
-- ProteinProcessing.code
-- ============================================================================
DROP INDEX "ProteinProcessing_code_key";
CREATE UNIQUE INDEX "ProteinProcessing_tenantId_code_key" ON "ProteinProcessing"("tenantId", "code");

-- ============================================================================
-- Requisition.code
-- ============================================================================
DROP INDEX "Requisition_code_key";
CREATE UNIQUE INDEX "Requisition_tenantId_code_key" ON "Requisition"("tenantId", "code");

-- ============================================================================
-- MenuItem.sku
-- ============================================================================
DROP INDEX "MenuItem_sku_key";
CREATE UNIQUE INDEX "MenuItem_tenantId_sku_key" ON "MenuItem"("tenantId", "sku");

-- ============================================================================
-- SalesOrder.orderNumber
-- ============================================================================
DROP INDEX "SalesOrder_orderNumber_key";
CREATE UNIQUE INDEX "SalesOrder_tenantId_orderNumber_key" ON "SalesOrder"("tenantId", "orderNumber");

-- ============================================================================
-- Supplier.code  (nullable)
-- ============================================================================
DROP INDEX "Supplier_code_key";
CREATE UNIQUE INDEX "Supplier_tenantId_code_key" ON "Supplier"("tenantId", "code");

-- ============================================================================
-- PurchaseOrder.orderNumber
-- ============================================================================
DROP INDEX "PurchaseOrder_orderNumber_key";
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_orderNumber_key" ON "PurchaseOrder"("tenantId", "orderNumber");

-- ============================================================================
-- ExpenseCategory.name
-- ============================================================================
DROP INDEX "ExpenseCategory_name_key";
CREATE UNIQUE INDEX "ExpenseCategory_tenantId_name_key" ON "ExpenseCategory"("tenantId", "name");

-- ============================================================================
-- Branch.code
-- ============================================================================
DROP INDEX "Branch_code_key";
CREATE UNIQUE INDEX "Branch_tenantId_code_key" ON "Branch"("tenantId", "code");

-- ============================================================================
-- OpenTab.tabCode
-- ============================================================================
DROP INDEX "OpenTab_tabCode_key";
CREATE UNIQUE INDEX "OpenTab_tenantId_tabCode_key" ON "OpenTab"("tenantId", "tabCode");

-- ============================================================================
-- InvoiceCounter.channel
-- ============================================================================
DROP INDEX "InvoiceCounter_channel_key";
CREATE UNIQUE INDEX "InvoiceCounter_tenantId_channel_key" ON "InvoiceCounter"("tenantId", "channel");

-- ============================================================================
-- GameType.code
-- ============================================================================
DROP INDEX "GameType_code_key";
CREATE UNIQUE INDEX "GameType_tenantId_code_key" ON "GameType"("tenantId", "code");

-- ============================================================================
-- GameStation.code
-- ============================================================================
DROP INDEX "GameStation_code_key";
CREATE UNIQUE INDEX "GameStation_tenantId_code_key" ON "GameStation"("tenantId", "code");

-- ============================================================================
-- WristbandPlan.code
-- ============================================================================
DROP INDEX "WristbandPlan_code_key";
CREATE UNIQUE INDEX "WristbandPlan_tenantId_code_key" ON "WristbandPlan"("tenantId", "code");

-- ============================================================================
-- Reservation.code
-- ============================================================================
DROP INDEX "Reservation_code_key";
CREATE UNIQUE INDEX "Reservation_tenantId_code_key" ON "Reservation"("tenantId", "code");

-- ============================================================================
-- GameSession.code
-- ============================================================================
DROP INDEX "GameSession_code_key";
CREATE UNIQUE INDEX "GameSession_tenantId_code_key" ON "GameSession"("tenantId", "code");

-- ============================================================================
-- ProductFamily.code
-- ============================================================================
DROP INDEX "ProductFamily_code_key";
CREATE UNIQUE INDEX "ProductFamily_tenantId_code_key" ON "ProductFamily"("tenantId", "code");

-- ============================================================================
-- InventoryCycle.code
-- ============================================================================
DROP INDEX "InventoryCycle_code_key";
CREATE UNIQUE INDEX "InventoryCycle_tenantId_code_key" ON "InventoryCycle"("tenantId", "code");
