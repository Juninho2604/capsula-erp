-- =============================================================================
-- MIGRACIÓN: Games, Intercompany y Módulos Avanzados
-- Fecha: 2026-03-23
-- Política: 100% aditiva — Solo ADD/CREATE, nunca DROP ni ALTER destructivo
-- =============================================================================

-- =============================================================================
-- 1. CAMPOS NUEVOS EN TABLAS EXISTENTES
-- =============================================================================

-- InventoryItem — Bebidas y familia de producto
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isBeverage"          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "beverageCategory"    TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "beverageSubCategory" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isAlcoholic"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "servingSize"         DOUBLE PRECISION;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "servingSizeUnit"     TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "productFamilyId"     TEXT;

-- MenuItem — Routing de cocina e intercompany
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "serviceCategory"   TEXT;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "kitchenRouting"    TEXT;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "isIntercompanyItem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "externalSku"       TEXT;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "sourceBranchId"    TEXT;

-- OpenTab — Service charge y propina acumulada
ALTER TABLE "OpenTab" ADD COLUMN IF NOT EXISTS "totalServiceCharge" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "OpenTab" ADD COLUMN IF NOT EXISTS "totalTip"           DOUBLE PRECISION NOT NULL DEFAULT 0;

-- PaymentSplit — Prorrateo de service charge y propina
ALTER TABLE "PaymentSplit" ADD COLUMN IF NOT EXISTS "serviceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PaymentSplit" ADD COLUMN IF NOT EXISTS "tipAmount"           DOUBLE PRECISION NOT NULL DEFAULT 0;

-- =============================================================================
-- 2. MÓDULO ENTRETENIMIENTO / JUEGOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS "GameType" (
    "id"                     TEXT NOT NULL,
    "code"                   TEXT NOT NULL,
    "name"                   TEXT NOT NULL,
    "description"            TEXT,
    "icon"                   TEXT,
    "color"                  TEXT,
    "defaultSessionMinutes"  INTEGER NOT NULL DEFAULT 60,
    "isActive"               BOOLEAN NOT NULL DEFAULT true,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameType_code_key" ON "GameType"("code");
CREATE INDEX IF NOT EXISTS "GameType_code_idx" ON "GameType"("code");

-- ─── GameStation ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GameStation" (
    "id"            TEXT NOT NULL,
    "code"          TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "gameTypeId"    TEXT NOT NULL,
    "branchId"      TEXT,
    "currentStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "hourlyRate"    DOUBLE PRECISION,
    "notes"         TEXT,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameStation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameStation_code_key"   ON "GameStation"("code");
CREATE INDEX IF NOT EXISTS "GameStation_gameTypeId_idx"    ON "GameStation"("gameTypeId");
CREATE INDEX IF NOT EXISTS "GameStation_currentStatus_idx" ON "GameStation"("currentStatus");
CREATE INDEX IF NOT EXISTS "GameStation_branchId_idx"      ON "GameStation"("branchId");

ALTER TABLE "GameStation" ADD CONSTRAINT "GameStation_gameTypeId_fkey"
    FOREIGN KEY ("gameTypeId") REFERENCES "GameType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameStation" ADD CONSTRAINT "GameStation_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── WristbandPlan ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "WristbandPlan" (
    "id"              TEXT NOT NULL,
    "code"            TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "price"           DOUBLE PRECISION NOT NULL,
    "color"           TEXT,
    "maxSessions"     INTEGER,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WristbandPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WristbandPlan_code_key"    ON "WristbandPlan"("code");
CREATE INDEX IF NOT EXISTS "WristbandPlan_isActive_idx"       ON "WristbandPlan"("isActive");

-- ─── Reservation ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Reservation" (
    "id"              TEXT NOT NULL,
    "code"            TEXT NOT NULL,
    "stationId"       TEXT NOT NULL,
    "wristbandPlanId" TEXT,
    "customerName"    TEXT NOT NULL,
    "customerPhone"   TEXT,
    "guestCount"      INTEGER NOT NULL DEFAULT 1,
    "scheduledStart"  TIMESTAMP(3) NOT NULL,
    "scheduledEnd"    TIMESTAMP(3) NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'PENDING',
    "notes"           TEXT,
    "depositAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositPaid"     BOOLEAN NOT NULL DEFAULT false,
    "createdById"     TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"       TIMESTAMP(3),
    "deletedById"     TEXT,
    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_code_key"           ON "Reservation"("code");
CREATE INDEX IF NOT EXISTS "Reservation_stationId_scheduledStart_idx" ON "Reservation"("stationId", "scheduledStart");
CREATE INDEX IF NOT EXISTS "Reservation_status_idx"                ON "Reservation"("status");
CREATE INDEX IF NOT EXISTS "Reservation_customerPhone_idx"         ON "Reservation"("customerPhone");

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_wristbandPlanId_fkey"
    FOREIGN KEY ("wristbandPlanId") REFERENCES "WristbandPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── GameSession ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GameSession" (
    "id"              TEXT NOT NULL,
    "code"            TEXT NOT NULL,
    "stationId"       TEXT NOT NULL,
    "gameTypeId"      TEXT NOT NULL,
    "reservationId"   TEXT,
    "salesOrderId"    TEXT,
    "wristbandCode"   TEXT,
    "customerName"    TEXT,
    "guestCount"      INTEGER NOT NULL DEFAULT 1,
    "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt"         TIMESTAMP(3),
    "scheduledEndAt"  TIMESTAMP(3),
    "status"          TEXT NOT NULL DEFAULT 'ACTIVE',
    "billingType"     TEXT NOT NULL DEFAULT 'HOURLY',
    "minutesBilled"   INTEGER NOT NULL DEFAULT 0,
    "amountBilled"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes"           TEXT,
    "startedById"     TEXT NOT NULL,
    "endedById"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameSession_code_key"             ON "GameSession"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "GameSession_reservationId_key"    ON "GameSession"("reservationId");
CREATE INDEX IF NOT EXISTS "GameSession_stationId_status_idx"        ON "GameSession"("stationId", "status");
CREATE INDEX IF NOT EXISTS "GameSession_startedAt_idx"               ON "GameSession"("startedAt");
CREATE INDEX IF NOT EXISTS "GameSession_salesOrderId_idx"            ON "GameSession"("salesOrderId");

ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_gameTypeId_fkey"
    FOREIGN KEY ("gameTypeId") REFERENCES "GameType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_salesOrderId_fkey"
    FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_startedById_fkey"
    FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_endedById_fkey"
    FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── QueueTicket ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "QueueTicket" (
    "id"                     TEXT NOT NULL,
    "ticketNumber"           INTEGER NOT NULL,
    "stationId"              TEXT,
    "gameTypeId"             TEXT,
    "customerName"           TEXT NOT NULL,
    "customerPhone"          TEXT,
    "guestCount"             INTEGER NOT NULL DEFAULT 1,
    "status"                 TEXT NOT NULL DEFAULT 'WAITING',
    "calledAt"               TIMESTAMP(3),
    "seatedAt"               TIMESTAMP(3),
    "estimatedWaitMinutes"   INTEGER,
    "notes"                  TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueueTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QueueTicket_status_createdAt_idx" ON "QueueTicket"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "QueueTicket_stationId_idx"        ON "QueueTicket"("stationId");

ALTER TABLE "QueueTicket" ADD CONSTRAINT "QueueTicket_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- 3. MÓDULO INTERCOMPANY
-- =============================================================================

CREATE TABLE IF NOT EXISTS "IntercompanySettlement" (
    "id"           TEXT NOT NULL,
    "code"         TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId"   TEXT NOT NULL,
    "periodStart"  TIMESTAMP(3) NOT NULL,
    "periodEnd"    TIMESTAMP(3) NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes"        TEXT,
    "approvedById" TEXT,
    "approvedAt"   TIMESTAMP(3),
    "paidAt"       TIMESTAMP(3),
    "createdById"  TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"    TIMESTAMP(3),
    "deletedById"  TEXT,
    CONSTRAINT "IntercompanySettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntercompanySettlement_code_key"          ON "IntercompanySettlement"("code");
CREATE INDEX IF NOT EXISTS "IntercompanySettlement_fromBranchId_toBranchId_idx" ON "IntercompanySettlement"("fromBranchId", "toBranchId");
CREATE INDEX IF NOT EXISTS "IntercompanySettlement_status_idx"               ON "IntercompanySettlement"("status");
CREATE INDEX IF NOT EXISTS "IntercompanySettlement_periodStart_idx"          ON "IntercompanySettlement"("periodStart");

-- ─── IntercompanySettlementLine ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "IntercompanySettlementLine" (
    "id"              TEXT NOT NULL,
    "settlementId"    TEXT NOT NULL,
    "menuItemId"      TEXT,
    "inventoryItemId" TEXT,
    "description"     TEXT NOT NULL,
    "quantity"        DOUBLE PRECISION NOT NULL,
    "unit"            TEXT NOT NULL,
    "unitPrice"       DOUBLE PRECISION NOT NULL,
    "totalPrice"      DOUBLE PRECISION NOT NULL,
    "notes"           TEXT,
    "sortOrder"       INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "IntercompanySettlementLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IntercompanySettlementLine_settlementId_idx" ON "IntercompanySettlementLine"("settlementId");

ALTER TABLE "IntercompanySettlementLine" ADD CONSTRAINT "IntercompanySettlementLine_settlementId_fkey"
    FOREIGN KEY ("settlementId") REFERENCES "IntercompanySettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── IntercompanyItemMapping ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "IntercompanyItemMapping" (
    "id"                    TEXT NOT NULL,
    "menuItemId"            TEXT NOT NULL,
    "sourceInventoryItemId" TEXT NOT NULL,
    "fromBranchId"          TEXT NOT NULL,
    "toBranchId"            TEXT NOT NULL,
    "transferPrice"         DOUBLE PRECISION,
    "isActive"              BOOLEAN NOT NULL DEFAULT true,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntercompanyItemMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntercompanyItemMapping_menuItemId_fromBranchId_key"
    ON "IntercompanyItemMapping"("menuItemId", "fromBranchId");
CREATE INDEX IF NOT EXISTS "IntercompanyItemMapping_fromBranchId_toBranchId_idx"
    ON "IntercompanyItemMapping"("fromBranchId", "toBranchId");

ALTER TABLE "IntercompanyItemMapping" ADD CONSTRAINT "IntercompanyItemMapping_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- 4. MÓDULOS DE ADMINISTRACIÓN AVANZADA
-- =============================================================================

-- ─── ProductFamily ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ProductFamily" (
    "id"          TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "icon"        TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductFamily_code_key" ON "ProductFamily"("code");
CREATE INDEX IF NOT EXISTS "ProductFamily_code_idx"        ON "ProductFamily"("code");

-- FK de InventoryItem → ProductFamily
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'InventoryItem_productFamilyId_fkey'
    ) THEN
        ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productFamilyId_fkey"
            FOREIGN KEY ("productFamilyId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "InventoryItem_isBeverage_idx"     ON "InventoryItem"("isBeverage");
CREATE INDEX IF NOT EXISTS "InventoryItem_productFamilyId_idx" ON "InventoryItem"("productFamilyId");

-- ─── SkuCreationTemplate ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "SkuCreationTemplate" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "productFamilyId" TEXT,
    "defaultFields"   TEXT NOT NULL,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkuCreationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SkuCreationTemplate_productFamilyId_idx" ON "SkuCreationTemplate"("productFamilyId");

ALTER TABLE "SkuCreationTemplate" ADD CONSTRAINT "SkuCreationTemplate_productFamilyId_fkey"
    FOREIGN KEY ("productFamilyId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── BroadcastMessage ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BroadcastMessage" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "type"        TEXT NOT NULL DEFAULT 'INFO',
    "targetRoles" TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "startsAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"   TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BroadcastMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BroadcastMessage_isActive_startsAt_idx" ON "BroadcastMessage"("isActive", "startsAt");
CREATE INDEX IF NOT EXISTS "BroadcastMessage_type_idx"              ON "BroadcastMessage"("type");

-- ─── InventoryCycle ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "InventoryCycle" (
    "id"          TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "cycleType"   TEXT NOT NULL DEFAULT 'WEEKLY',
    "areaIds"     TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'OPEN',
    "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt"    TIMESTAMP(3),
    "closedById"  TEXT,
    "notes"       TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryCycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCycle_code_key"      ON "InventoryCycle"("code");
CREATE INDEX IF NOT EXISTS "InventoryCycle_status_idx"           ON "InventoryCycle"("status");
CREATE INDEX IF NOT EXISTS "InventoryCycle_cycleType_idx"        ON "InventoryCycle"("cycleType");
CREATE INDEX IF NOT EXISTS "InventoryCycle_startedAt_idx"        ON "InventoryCycle"("startedAt");

-- ─── InventoryCycleSnapshot ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "InventoryCycleSnapshot" (
    "id"              TEXT NOT NULL,
    "cycleId"         TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "areaId"          TEXT NOT NULL,
    "countedStock"    DOUBLE PRECISION NOT NULL,
    "systemStock"     DOUBLE PRECISION NOT NULL,
    "difference"      DOUBLE PRECISION NOT NULL,
    "unit"            TEXT NOT NULL,
    "costSnapshot"    DOUBLE PRECISION,
    "countedById"     TEXT NOT NULL,
    "countedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"           TEXT,
    CONSTRAINT "InventoryCycleSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCycleSnapshot_cycleId_inventoryItemId_areaId_key"
    ON "InventoryCycleSnapshot"("cycleId", "inventoryItemId", "areaId");
CREATE INDEX IF NOT EXISTS "InventoryCycleSnapshot_cycleId_idx"         ON "InventoryCycleSnapshot"("cycleId");
CREATE INDEX IF NOT EXISTS "InventoryCycleSnapshot_inventoryItemId_idx" ON "InventoryCycleSnapshot"("inventoryItemId");

ALTER TABLE "InventoryCycleSnapshot" ADD CONSTRAINT "InventoryCycleSnapshot_cycleId_fkey"
    FOREIGN KEY ("cycleId") REFERENCES "InventoryCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryCycleSnapshot" ADD CONSTRAINT "InventoryCycleSnapshot_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- índices adicionales en MenuItem
CREATE INDEX IF NOT EXISTS "MenuItem_serviceCategory_idx"    ON "MenuItem"("serviceCategory");
CREATE INDEX IF NOT EXISTS "MenuItem_isIntercompanyItem_idx" ON "MenuItem"("isIntercompanyItem");

-- =============================================================================
-- FIN DE MIGRACIÓN
-- =============================================================================
