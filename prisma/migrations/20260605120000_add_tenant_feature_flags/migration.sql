-- Tenant.featureFlags: JSONB con catálogo de flags on/off por tenant.
-- Catálogo de claves válidas en src/lib/feature-flags.ts.
-- Default '{}' = todo apagado. Safe en producción viva (NOT NULL con DEFAULT,
-- Postgres no escanea la tabla, solo agrega la columna al catalog).
ALTER TABLE "Tenant" ADD COLUMN "featureFlags" JSONB NOT NULL DEFAULT '{}'::jsonb;
