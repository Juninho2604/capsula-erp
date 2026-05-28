-- Re-aplicación IDEMPOTENTE de las 4 columnas de branding del Tenant.
--
-- Las migrations originales `20260523180000_add_tenant_branding`
-- (legalName, taxId, logoUrl) y `20260523200000_add_tenant_display_name`
-- (displayName) deberían haber agregado estas columnas. Pero en producción
-- aparecieron crashes del tipo "Server Components render error" en pages
-- que SELECT esas columnas, lo que sugiere que al menos una migración no
-- terminó de aplicarse (race entre migrate deploy y swap atómico del deploy
-- script, o un fallo silencioso intermedio).
--
-- Esta migración usa `ADD COLUMN IF NOT EXISTS` para ser SEGURA en ambos
-- escenarios:
--   - Si las columnas YA existen (caso normal post-deploy correcto): no-op.
--   - Si alguna falta: la crea + backfilla Shanklish con los valores
--     históricos para preservar exactamente el mismo visual.
--
-- Es safe correr esta migración múltiples veces sin efectos secundarios.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "legalName"   TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "taxId"       TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoUrl"     TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "displayName" TEXT;

-- Backfill Shanklish solo donde el campo aún está NULL. Si ya estaba
-- backfilleado, no se sobreescribe (idempotente).
UPDATE "Tenant"
SET "legalName"   = COALESCE("legalName",   'Shanklish Caracas, C.A.'),
    "taxId"       = COALESCE("taxId",       'J413087278'),
    "logoUrl"     = COALESCE("logoUrl",     '/logo-shanklish.png'),
    "displayName" = COALESCE("displayName", 'Shanklish')
WHERE "slug" = 'shanklish';
