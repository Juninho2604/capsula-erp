-- §51.A — Conteo físico semanal como entidad.
-- Snapshot inmutable de cada conteo aplicado en /conteo-semanal. Habilita
-- historial y comparativas semana N vs N-1.
--
-- El ajuste real de stock sigue siendo InventoryMovement(ADJUSTMENT_*);
-- WeeklyCount es solo el record de "qué se contó, cuándo, por quién, y
-- qué número era cada SKU al momento del conteo".
--
-- Migración SAFE en producción viva (solo ADD): solo crea tablas nuevas,
-- no toca columnas existentes.

CREATE TABLE IF NOT EXISTS "WeeklyCount" (
    "id" TEXT NOT NULL,
    "countNumber" TEXT NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "principalAreaId" TEXT NOT NULL,
    "productionAreaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "WeeklyCount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyCount_tenantId_countNumber_key" ON "WeeklyCount"("tenantId", "countNumber");
CREATE INDEX IF NOT EXISTS "WeeklyCount_tenantId_idx" ON "WeeklyCount"("tenantId");
CREATE INDEX IF NOT EXISTS "WeeklyCount_countDate_idx" ON "WeeklyCount"("countDate");
CREATE INDEX IF NOT EXISTS "WeeklyCount_principalAreaId_idx" ON "WeeklyCount"("principalAreaId");

CREATE TABLE IF NOT EXISTS "WeeklyCountItem" (
    "id" TEXT NOT NULL,
    "weeklyCountId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "baseUnit" TEXT NOT NULL,
    "stockBeforePrincipal" DOUBLE PRECISION NOT NULL,
    "qtyCountedPrincipal" DOUBLE PRECISION NOT NULL,
    "variancePrincipal" DOUBLE PRECISION NOT NULL,
    "stockBeforeProduction" DOUBLE PRECISION,
    "qtyCountedProduction" DOUBLE PRECISION,
    "varianceProduction" DOUBLE PRECISION,

    CONSTRAINT "WeeklyCountItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyCountItem_weeklyCountId_inventoryItemId_key" ON "WeeklyCountItem"("weeklyCountId", "inventoryItemId");
CREATE INDEX IF NOT EXISTS "WeeklyCountItem_weeklyCountId_idx" ON "WeeklyCountItem"("weeklyCountId");
CREATE INDEX IF NOT EXISTS "WeeklyCountItem_inventoryItemId_idx" ON "WeeklyCountItem"("inventoryItemId");

-- Foreign keys (defer hasta el final por dependencias)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyCount_principalAreaId_fkey') THEN
        ALTER TABLE "WeeklyCount" ADD CONSTRAINT "WeeklyCount_principalAreaId_fkey"
            FOREIGN KEY ("principalAreaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyCount_productionAreaId_fkey') THEN
        ALTER TABLE "WeeklyCount" ADD CONSTRAINT "WeeklyCount_productionAreaId_fkey"
            FOREIGN KEY ("productionAreaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyCount_createdById_fkey') THEN
        ALTER TABLE "WeeklyCount" ADD CONSTRAINT "WeeklyCount_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyCount_tenantId_fkey') THEN
        ALTER TABLE "WeeklyCount" ADD CONSTRAINT "WeeklyCount_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyCountItem_weeklyCountId_fkey') THEN
        ALTER TABLE "WeeklyCountItem" ADD CONSTRAINT "WeeklyCountItem_weeklyCountId_fkey"
            FOREIGN KEY ("weeklyCountId") REFERENCES "WeeklyCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyCountItem_inventoryItemId_fkey') THEN
        ALTER TABLE "WeeklyCountItem" ADD CONSTRAINT "WeeklyCountItem_inventoryItemId_fkey"
            FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;
