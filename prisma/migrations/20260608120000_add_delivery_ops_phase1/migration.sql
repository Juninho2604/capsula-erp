-- Módulo Gestión de Deliverys — Fase 1 (feature flag deliveryOps).
-- Módulo AISLADO: no toca SalesOrder, Report Z ni inventario.
-- Plan completo: docs/DELIVERY_OPS_PLAN.md.
--
-- Migración SAFE en producción viva (§44): solo CREATE TABLE de tablas nuevas,
-- no toca columnas ni datos existentes. Las relaciones inversas agregadas a
-- Tenant/Branch/Customer son virtuales en Prisma (no generan DDL acá; las FK
-- viven en las tablas hijas de abajo).

-- ── DeliveryTenantConfig (1:1 con Tenant) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "DeliveryTenantConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "correlativePrefix" TEXT NOT NULL DEFAULT 'PP',
    "nextCorrelative" INTEGER NOT NULL DEFAULT 1,
    "validationMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "webhookUrl" TEXT,
    "schedule" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTenantConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryTenantConfig_tenantId_key" ON "DeliveryTenantConfig"("tenantId");

-- ── BranchDeliveryConfig (1:1 con Branch) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "BranchDeliveryConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "printerStation" TEXT,
    "whatsappGroup" TEXT,
    "managerUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchDeliveryConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BranchDeliveryConfig_branchId_key" ON "BranchDeliveryConfig"("branchId");
CREATE INDEX IF NOT EXISTS "BranchDeliveryConfig_tenantId_idx" ON "BranchDeliveryConfig"("tenantId");

-- ── DeliveryZone (zonas de cobertura por sede) ──────────────────────────────
CREATE TABLE IF NOT EXISTS "DeliveryZone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryZone_branchId_name_key" ON "DeliveryZone"("branchId", "name");
CREATE INDEX IF NOT EXISTS "DeliveryZone_tenantId_idx" ON "DeliveryZone"("tenantId");

-- ── DeliveryOrder (entidad central) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "DeliveryOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "correlative" TEXT NOT NULL,
    "branchId" TEXT,
    "channel" TEXT NOT NULL,
    "chatId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "deliveryAddress" TEXT,
    "deliveryRef" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "comanda" JSONB NOT NULL,
    "totalUsd" DOUBLE PRECISION,
    "totalBs" DOUBLE PRECISION,
    "exchangeRate" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ESPERANDO_PAGO',
    "itemsHash" TEXT,
    "paymentProofPath" TEXT,
    "paymentProofType" TEXT,
    "paymentValidatedById" TEXT,
    "paymentValidatedAt" TIMESTAMP(3),
    "driverId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryOrder_tenantId_correlative_key" ON "DeliveryOrder"("tenantId", "correlative");
CREATE INDEX IF NOT EXISTS "DeliveryOrder_tenantId_status_createdAt_idx" ON "DeliveryOrder"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "DeliveryOrder_tenantId_channel_chatId_idx" ON "DeliveryOrder"("tenantId", "channel", "chatId");
CREATE INDEX IF NOT EXISTS "DeliveryOrder_branchId_status_idx" ON "DeliveryOrder"("branchId", "status");
CREATE INDEX IF NOT EXISTS "DeliveryOrder_tenantId_customerPhone_idx" ON "DeliveryOrder"("tenantId", "customerPhone");

-- ── DeliveryOrderEvent (auditoría de transiciones) ──────────────────────────
CREATE TABLE IF NOT EXISTS "DeliveryOrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "userId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeliveryOrderEvent_orderId_createdAt_idx" ON "DeliveryOrderEvent"("orderId", "createdAt");

-- ── Foreign keys (al final por dependencias) ────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryTenantConfig_tenantId_fkey') THEN
        ALTER TABLE "DeliveryTenantConfig" ADD CONSTRAINT "DeliveryTenantConfig_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BranchDeliveryConfig_tenantId_fkey') THEN
        ALTER TABLE "BranchDeliveryConfig" ADD CONSTRAINT "BranchDeliveryConfig_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BranchDeliveryConfig_branchId_fkey') THEN
        ALTER TABLE "BranchDeliveryConfig" ADD CONSTRAINT "BranchDeliveryConfig_branchId_fkey"
            FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryZone_tenantId_fkey') THEN
        ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryZone_branchId_fkey') THEN
        ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_branchId_fkey"
            FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryOrder_tenantId_fkey') THEN
        ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryOrder_branchId_fkey') THEN
        ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_branchId_fkey"
            FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryOrder_customerId_fkey') THEN
        ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_customerId_fkey"
            FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryOrderEvent_orderId_fkey') THEN
        ALTER TABLE "DeliveryOrderEvent" ADD CONSTRAINT "DeliveryOrderEvent_orderId_fkey"
            FOREIGN KEY ("orderId") REFERENCES "DeliveryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;
