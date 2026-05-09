-- ============================================================================
-- Multi-tenant Step 1.A — Crear tabla Tenant + sembrar registro inicial
--
-- Cambios:
--   1. CREATE TABLE "Tenant" (id, slug, name, createdAt, updatedAt)
--   2. UNIQUE INDEX en slug
--   3. INSERT del tenant inicial 'shanklish' con id fijo conocido para que
--      backfills posteriores puedan referenciarlo sin SELECT previo.
--
-- Esta migration es:
--   - Atómica (Postgres envuelve toda la migration en transacción).
--   - Additive (no toca tablas existentes).
--   - Idempotente respecto al INSERT (ON CONFLICT DO NOTHING).
--
-- Rollback: DROP TABLE "Tenant"; — no hay FKs hacia Tenant todavía.
-- ============================================================================

-- CreateTable
CREATE TABLE "Tenant" (
    "id"        TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- Seed: tenant inicial para preservar la operación actual de Shanklish.
-- El id es un literal fijo para que sub-pasos posteriores puedan referenciarlo
-- en backfills sin tener que hacer SELECT primero.
INSERT INTO "Tenant" ("id", "slug", "name", "createdAt", "updatedAt")
VALUES ('tnt_shanklish_caracas', 'shanklish', 'Shanklish Caracas', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
