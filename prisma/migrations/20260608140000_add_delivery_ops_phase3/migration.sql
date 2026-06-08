-- Módulo Gestión de Deliverys — Fase 3 (motorizados + webhooks salientes).
-- Plan: docs/DELIVERY_OPS_PLAN.md.
--
-- Migración SAFE en producción viva (§44): CREATE TABLE de tablas nuevas + ADD
-- CONSTRAINT del FK driverId sobre DeliveryOrder (tabla recién creada en Fase 1,
-- vacía → la validación del FK es instantánea).

-- ── DeliveryDriver (motorizados) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "DeliveryDriver" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryDriver_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeliveryDriver_tenantId_idx" ON "DeliveryDriver"("tenantId");
CREATE INDEX IF NOT EXISTS "DeliveryDriver_branchId_status_idx" ON "DeliveryDriver"("branchId", "status");

-- ── DeliveryWebhookOutbox (webhooks salientes a n8n) ────────────────────────
CREATE TABLE IF NOT EXISTS "DeliveryWebhookOutbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryWebhookOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeliveryWebhookOutbox_tenantId_status_createdAt_idx" ON "DeliveryWebhookOutbox"("tenantId", "status", "createdAt");

-- ── Foreign keys ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryDriver_tenantId_fkey') THEN
        ALTER TABLE "DeliveryDriver" ADD CONSTRAINT "DeliveryDriver_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryDriver_branchId_fkey') THEN
        ALTER TABLE "DeliveryDriver" ADD CONSTRAINT "DeliveryDriver_branchId_fkey"
            FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryWebhookOutbox_tenantId_fkey') THEN
        ALTER TABLE "DeliveryWebhookOutbox" ADD CONSTRAINT "DeliveryWebhookOutbox_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- FK del motorizado sobre la orden (DeliveryOrder.driverId → DeliveryDriver).
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryOrder_driverId_fkey') THEN
        ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_driverId_fkey"
            FOREIGN KEY ("driverId") REFERENCES "DeliveryDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END$$;
