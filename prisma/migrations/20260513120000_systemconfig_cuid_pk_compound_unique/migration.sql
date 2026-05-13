-- ============================================================================
-- SystemConfig: cuid PK + compound unique (tenantId, key)
-- ============================================================================
--
-- Problema previo:
--   `SystemConfig.key` era PK (única globalmente). Esto bloqueaba multi-tenant:
--   cuando Table Pong intenta guardar `enabled_modules`, choca con la fila
--   existente de Shanklish.
--
-- Cambio (no-destructivo):
--   1. Añade columna `id TEXT` nullable.
--   2. Backfill `id` con cuids para las filas existentes.
--   3. Marca `id` NOT NULL.
--   4. Drop PK sobre `key`.
--   5. Add PK sobre `id`.
--   6. Add unique compuesto `(tenantId, key)`.
--
-- Datos preservados:
--   - `key`, `value`, `updatedAt`, `updatedBy`, `tenantId` de cada fila
--     se mantienen idénticos. Solo se agrega una columna `id` con un cuid
--     nuevo generado en backfill.
--
-- Transaccional:
--   Postgres soporta DDL en transacción → si cualquier paso falla, rollback
--   automático y schema queda como estaba.
--
-- Idempotente:
--   Las cláusulas IF NOT EXISTS / IF EXISTS hacen que la migración pueda
--   re-aplicarse sin error si ya corrió.
-- ============================================================================

BEGIN;

-- 1. Añadir columna id nullable (para que el ADD no falle con datos existentes)
ALTER TABLE "SystemConfig" ADD COLUMN IF NOT EXISTS "id" TEXT;

-- 2. Backfill con cuids generados via gen_random_uuid (más simple que cuid
--    nativo de Prisma; el formato es diferente pero funcionalmente igual
--    como identificador opaco). Solo afecta filas con id NULL.
--
--    Activamos pgcrypto si no está habilitado (idempotente).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

UPDATE "SystemConfig"
SET "id" = 'sc_' || REPLACE(gen_random_uuid()::text, '-', '')
WHERE "id" IS NULL;

-- 3. NOT NULL constraint
ALTER TABLE "SystemConfig" ALTER COLUMN "id" SET NOT NULL;

-- 4. Drop PK sobre key (constraint name por convención de Prisma:
--    SystemConfig_pkey, pero usamos IF EXISTS por seguridad).
ALTER TABLE "SystemConfig" DROP CONSTRAINT IF EXISTS "SystemConfig_pkey";

-- 5. Add PK sobre id
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id");

-- 6. Add unique compuesto (tenantId, key). Si por alguna razón ya existe
--    (re-run), lo dropea primero.
ALTER TABLE "SystemConfig"
    DROP CONSTRAINT IF EXISTS "SystemConfig_tenantId_key_key";
DROP INDEX IF EXISTS "SystemConfig_tenantId_key_key";

ALTER TABLE "SystemConfig"
    ADD CONSTRAINT "SystemConfig_tenantId_key_key" UNIQUE ("tenantId", "key");

COMMIT;

-- ============================================================================
-- Verificación post-migración (no parte de la transacción, solo info):
-- ============================================================================
-- SELECT id, key, tenantId, value FROM "SystemConfig";
-- → cada fila debería tener un id de la forma 'sc_<hex>' y conservar
--   sus valores originales de key/value/tenantId.
