-- Drop `@default("tnt_shanklish_caracas")` de tenantId en TODOS los modelos
-- tenant-aware.
--
-- Razón: el default era un "fallback" heredado de la migración multi-tenant
-- inicial. En producción, cualquier .create() que olvidaba pasar tenantId
-- explícito caía a este default → el record se escribía con tenantId=shanklish
-- aunque el caller operara sobre otro tenant. Bug grave de aislamiento.
--
-- Con esta migration:
--   - Inserts SIN tenantId → SQL NOT NULL error (lo cazamos en dev/prod).
--   - Filas existentes no se tocan (DROP DEFAULT no toca valores actuales).
--   - Toda código de creación DEBE pasar tenantId explícito o usar la
--     extension withTenant() que lo inyecta.
--
-- Idempotente: ALTER COLUMN DROP DEFAULT no falla si ya no hay default.

ALTER TABLE "AccountPayable" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "AccountPayment" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Area" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "AuditLog" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Branch" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "BroadcastMessage" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "CashRegister" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Customer" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "DailyInventory" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ExchangeRate" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Expense" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ExpenseCategory" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "GameSession" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "GameStation" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "GameType" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "InventoryAudit" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "InventoryCycle" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "InventoryItem" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "InventoryLoan" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "InvoiceCounter" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "MenuCategory" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "MenuItem" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "MenuModifier" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "MenuModifierGroup" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "OpenTab" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PrintJob" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ProductFamily" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ProductionOrder" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ProteinProcessing" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "QueueTicket" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Recipe" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Requisition" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Reservation" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "SalesOrder" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "SalesOrderItem" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ServiceZone" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "SkuCreationTemplate" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Supplier" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "SystemConfig" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "TableOrStation" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Waiter" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "WristbandPlan" ALTER COLUMN "tenantId" DROP DEFAULT;
