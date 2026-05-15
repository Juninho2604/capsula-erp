-- Apertura teórica: cierre del día anterior (auto-arrastrado, read-only).
-- initialCount sigue siendo el conteo físico real de la mañana (ahora editable
-- desde la UI). Backfill: para registros existentes copiamos initialCount al
-- nuevo campo para que la diferencia inicial sea 0.

ALTER TABLE "DailyInventoryItem"
  ADD COLUMN "theoreticalInitialCount" DOUBLE PRECISION DEFAULT 0;

UPDATE "DailyInventoryItem"
  SET "theoreticalInitialCount" = COALESCE("initialCount", 0)
  WHERE "theoreticalInitialCount" IS NULL OR "theoreticalInitialCount" = 0;
