-- ============================================================================
-- Propuesta 002 — SupplierItemPriceHistory
-- ----------------------------------------------------------------------------
-- Origen: Sub-Fase 1.F.3 — preparación de Fase 3.2.
-- Estado: PROPUESTO. NO aplicar sin OK escrito del cliente.
--
-- Motivación
-- ----------
-- Hoy SupplierItem.unitPrice solo guarda el precio actual; cuando se recibe
-- una OC con precio distinto, el valor se sobreescribe sin trazabilidad.
-- CostHistory existe pero solo registra el costo del InventoryItem (promedio
-- ponderado), no el precio por (supplier, item).
--
-- Esta tabla materializa el histórico por par (supplierId, inventoryItemId).
-- Cada cambio de unitPrice (vía createSupplierAction o tras receivePurchaseOrderItemsAction)
-- inserta un registro nuevo. La query "precio vigente" usa effectiveTo IS NULL.
--
-- Características
-- ---------------
-- - 100% additive: solo CREATE TABLE + indices. No toca SupplierItem; el
--   campo unitPrice del modelo existente sigue funcionando como "último
--   precio" para compat con código actual.
-- - Constraint UNIQUE parcial: solo puede haber un registro con effectiveTo
--   = NULL por par (supplierId, inventoryItemId). En Postgres se logra con
--   un índice único parcial.
-- - registeredFromPurchaseOrderId opcional: si el precio vino de una OC
--   recibida, queda trazado el origen.
-- - Migración inversa documentada (DROP TABLE).
--
-- Migración inversa (rollback)
-- ----------------------------
--   DROP TABLE IF EXISTS "SupplierItemPriceHistory";
-- ============================================================================

CREATE TABLE IF NOT EXISTS "SupplierItemPriceHistory" (
    "id"                          TEXT             NOT NULL,
    "supplierId"                  TEXT             NOT NULL,
    "inventoryItemId"             TEXT             NOT NULL,
    "unitPrice"                   DOUBLE PRECISION NOT NULL,
    "currency"                    TEXT             NOT NULL DEFAULT 'USD',
    "effectiveFrom"               TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo"                 TIMESTAMP(3),    -- NULL = vigente
    "registeredFromPurchaseOrderId" TEXT,          -- FK opcional: trazabilidad de la OC origen
    "registeredById"              TEXT,            -- FK User opcional: quien registró el cambio
    "notes"                       TEXT,            -- contexto humano (ej. "ajuste por inflación", "OC #1234")
    "createdAt"                   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierItemPriceHistory_pkey" PRIMARY KEY ("id")
);

-- Índices

CREATE INDEX IF NOT EXISTS "SupplierItemPriceHistory_supplierId_idx"
    ON "SupplierItemPriceHistory"("supplierId");

CREATE INDEX IF NOT EXISTS "SupplierItemPriceHistory_inventoryItemId_idx"
    ON "SupplierItemPriceHistory"("inventoryItemId");

CREATE INDEX IF NOT EXISTS "SupplierItemPriceHistory_effectiveFrom_idx"
    ON "SupplierItemPriceHistory"("effectiveFrom");

-- Compuesto para la query "histórico por par"
CREATE INDEX IF NOT EXISTS "SupplierItemPriceHistory_supplierId_inventoryItemId_idx"
    ON "SupplierItemPriceHistory"("supplierId", "inventoryItemId");

-- Único parcial: solo un registro vigente por par
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierItemPriceHistory_active_per_pair_uniq"
    ON "SupplierItemPriceHistory"("supplierId", "inventoryItemId")
    WHERE "effectiveTo" IS NULL;

-- Foreign keys

ALTER TABLE "SupplierItemPriceHistory"
    ADD CONSTRAINT "SupplierItemPriceHistory_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierItemPriceHistory"
    ADD CONSTRAINT "SupplierItemPriceHistory_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierItemPriceHistory"
    ADD CONSTRAINT "SupplierItemPriceHistory_registeredFromPurchaseOrderId_fkey"
    FOREIGN KEY ("registeredFromPurchaseOrderId") REFERENCES "PurchaseOrder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierItemPriceHistory"
    ADD CONSTRAINT "SupplierItemPriceHistory_registeredById_fkey"
    FOREIGN KEY ("registeredById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
