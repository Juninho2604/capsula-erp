-- Módulo Gestión de Deliverys — Fase 4/4.5 (instrucciones dinámicas del gerente).
-- Plan: docs/DELIVERY_OPS_PLAN.md.
--
-- Migración SAFE en producción viva (§44): solo CREATE TABLE de tablas nuevas.

-- ── ItemAvailability (agotados por sede, capa estructurada) ─────────────────
CREATE TABLE IF NOT EXISTS "ItemAvailability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemAvailability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ItemAvailability_branchId_itemLabel_key" ON "ItemAvailability"("branchId", "itemLabel");
CREATE INDEX IF NOT EXISTS "ItemAvailability_tenantId_branchId_available_idx" ON "ItemAvailability"("tenantId", "branchId", "available");

-- ── ManagerNote (notas de texto libre del gerente, capa libre) ──────────────
CREATE TABLE IF NOT EXISTS "ManagerNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "text" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ManagerNote_tenantId_isActive_idx" ON "ManagerNote"("tenantId", "isActive");

-- ── RoutingRule (reglas de ruteo producto → sede, capa estructurada) ────────
CREATE TABLE IF NOT EXISTS "RoutingRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matchProduct" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RoutingRule_tenantId_isActive_idx" ON "RoutingRule"("tenantId", "isActive");

-- ── Foreign keys ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItemAvailability_tenantId_fkey') THEN
        ALTER TABLE "ItemAvailability" ADD CONSTRAINT "ItemAvailability_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItemAvailability_branchId_fkey') THEN
        ALTER TABLE "ItemAvailability" ADD CONSTRAINT "ItemAvailability_branchId_fkey"
            FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ManagerNote_tenantId_fkey') THEN
        ALTER TABLE "ManagerNote" ADD CONSTRAINT "ManagerNote_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ManagerNote_branchId_fkey') THEN
        ALTER TABLE "ManagerNote" ADD CONSTRAINT "ManagerNote_branchId_fkey"
            FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RoutingRule_tenantId_fkey') THEN
        ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RoutingRule_branchId_fkey') THEN
        ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_branchId_fkey"
            FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;
