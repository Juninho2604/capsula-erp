-- ============================================================================
-- Multi-tenant Step 2.A — NOT NULL + DEFAULT en los 42 modelos con tenantId
--
-- Pone tenantId NOT NULL DEFAULT 'tnt_shanklish_caracas' en TODAS las tablas
-- multi-tenant. Esto blinda la BD: cualquier INSERT que omita tenantId
-- automáticamente hereda Shanklish.
--
-- Pre-condición: TODAS las filas YA tienen tenantId. Verificado en Fase 1.D-γ
-- con queries que devolvieron 0 nulls en User, Branch, SalesOrder, OpenTab,
-- Waiter y SalesOrderItem. Si por algún motivo quedó un NULL, ALTER NOT NULL
-- falla → ROLLBACK completo.
--
-- Cada tabla recibe DOS ALTER:
--   1. ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas'
--   2. ALTER COLUMN "tenantId" SET NOT NULL
--
-- Todo en una transacción Postgres → atómico.
--
-- Por qué DEFAULT a Shanklish:
--   - El código actual NO setea tenantId en sus create/update/upsert.
--   - Sin DEFAULT, NOT NULL haría que esos creates fallen → sitio se cae.
--   - CON DEFAULT, los creates omiten tenantId y Postgres lo aplica auto.
--   - Cuando lleguemos a Fase 3 (queries con tenant context), el código
--     pasará tenantId explícitamente y podremos quitar el DEFAULT con
--     tranquilidad.
--
-- Performance: ALTER COLUMN SET NOT NULL en Postgres requiere un scan de
-- la tabla para validar que no hay NULLs. En tablas grandes (SalesOrder
-- 4694, SalesOrderItem 12550) esto es <1s. Total estimado: <5s.
-- ============================================================================

ALTER TABLE "AccountPayable" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "AccountPayable" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "AccountPayment" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "AccountPayment" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Area" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "Area" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "AuditLog" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "AuditLog" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Branch" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "Branch" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "BroadcastMessage" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "BroadcastMessage" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "CashRegister" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "CashRegister" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "DailyInventory" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "DailyInventory" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "ExchangeRate" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "ExchangeRate" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Expense" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "Expense" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "ExpenseCategory" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "ExpenseCategory" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "GameSession" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "GameSession" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "GameStation" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "GameStation" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "GameType" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "GameType" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "InventoryAudit" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "InventoryAudit" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "InventoryCycle" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "InventoryCycle" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "InventoryItem" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "InventoryItem" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "InventoryLoan" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "InventoryLoan" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "InvoiceCounter" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "InvoiceCounter" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "MenuCategory" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "MenuCategory" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "MenuItem" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "MenuItem" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "MenuModifier" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "MenuModifier" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "MenuModifierGroup" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "MenuModifierGroup" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "OpenTab" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "OpenTab" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "ProductFamily" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "ProductFamily" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "ProductionOrder" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "ProductionOrder" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "ProteinProcessing" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "ProteinProcessing" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "PurchaseOrder" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "PurchaseOrder" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "QueueTicket" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "QueueTicket" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Recipe" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "Recipe" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Requisition" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "Requisition" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Reservation" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "Reservation" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "SalesOrder" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "SalesOrder" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "SalesOrderItem" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "SalesOrderItem" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "ServiceZone" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "ServiceZone" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "SkuCreationTemplate" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "SkuCreationTemplate" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Supplier" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "Supplier" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "SystemConfig" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "SystemConfig" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "TableOrStation" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "TableOrStation" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "User" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Waiter" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "Waiter" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "WristbandPlan" ALTER COLUMN "tenantId" SET DEFAULT 'tnt_shanklish_caracas';
ALTER TABLE "WristbandPlan" ALTER COLUMN "tenantId" SET NOT NULL;
