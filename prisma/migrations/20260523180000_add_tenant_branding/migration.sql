-- Branding fiscal/visual del tenant: legalName, taxId, logoUrl.
-- Todos opcionales. Tenants nuevos arrancan con NULL → recibos no muestran
-- esos campos hasta que el operador los setee. Shanklish se backfillea con
-- los valores que estaban hardcoded en src/lib/print-command.ts y
-- src/components/pos/PrintTicket.tsx — para que su operación NO cambie.

ALTER TABLE "Tenant"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "taxId"     TEXT,
  ADD COLUMN "logoUrl"   TEXT;

-- Backfill SAFE para Shanklish: los mismos valores que aparecían hardcoded
-- en el código antes de este cambio. Garantiza que los recibos de Shanklish
-- post-deploy se ven IDÉNTICOS a pre-deploy.
UPDATE "Tenant"
SET "legalName" = 'Shanklish Caracas, C.A.',
    "taxId"     = 'J413087278',
    "logoUrl"   = '/logo-shanklish.png'
WHERE "slug" = 'shanklish';
