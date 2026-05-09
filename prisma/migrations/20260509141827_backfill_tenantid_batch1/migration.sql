-- ============================================================================
-- Multi-tenant Step 1.C — Backfill tenantId en los 6 modelos del paso 1.B
--
-- Pone `tenantId = 'tnt_shanklish_caracas'` en TODA fila que aún tenga
-- `tenantId IS NULL` en MenuCategory, MenuItem, Recipe, Supplier,
-- ExpenseCategory y ProductFamily.
--
-- Idempotente: el WHERE tenantId IS NULL hace que correr la migration
-- múltiples veces sea seguro. Si por alguna razón hay filas creadas DESPUÉS
-- del paso 1.B (entre 1.B y 1.C, o entre 1.C y 1.E), igual quedan cubiertas
-- en una re-ejecución manual o en el siguiente backfill.
--
-- Cero impacto runtime:
--   - Solo UPDATE; no toca schema.
--   - Las queries existentes ignoran tenantId (es opcional en Prisma).
--   - Las que SÍ lo lean (ninguna por ahora) verán el tenant correcto.
--
-- Atomicidad:
--   Toda la migration corre en una transacción Postgres. Si cualquier UPDATE
--   falla, ROLLBACK completo y la BD queda como estaba.
--
-- Performance:
--   UPDATE en tablas con < 1000 filas es instantáneo. El total combinado
--   debería tomar < 100ms.
--
-- Validación post-migration (no incluida en SQL, manual desde el VPS):
--   SELECT COUNT(*) FROM "MenuCategory" WHERE "tenantId" IS NULL;
--   -- debe ser 0 (todas backfilled)
-- ============================================================================

-- ─── MenuCategory ───────────────────────────────────────────────────────────
UPDATE "MenuCategory"
SET "tenantId" = 'tnt_shanklish_caracas'
WHERE "tenantId" IS NULL;

-- ─── MenuItem ───────────────────────────────────────────────────────────────
UPDATE "MenuItem"
SET "tenantId" = 'tnt_shanklish_caracas'
WHERE "tenantId" IS NULL;

-- ─── Recipe ─────────────────────────────────────────────────────────────────
UPDATE "Recipe"
SET "tenantId" = 'tnt_shanklish_caracas'
WHERE "tenantId" IS NULL;

-- ─── Supplier ───────────────────────────────────────────────────────────────
UPDATE "Supplier"
SET "tenantId" = 'tnt_shanklish_caracas'
WHERE "tenantId" IS NULL;

-- ─── ExpenseCategory ────────────────────────────────────────────────────────
UPDATE "ExpenseCategory"
SET "tenantId" = 'tnt_shanklish_caracas'
WHERE "tenantId" IS NULL;

-- ─── ProductFamily ──────────────────────────────────────────────────────────
UPDATE "ProductFamily"
SET "tenantId" = 'tnt_shanklish_caracas'
WHERE "tenantId" IS NULL;
