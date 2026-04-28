-- ============================================================================
-- Propuesta 001 — InventoryDeductionRetry (outbox pattern)
-- ----------------------------------------------------------------------------
-- Origen: Sub-Fase 1.F.2 — preparación de Fase 2.
-- Estado: PROPUESTO. NO aplicar sin OK escrito del cliente.
--
-- Motivación
-- ----------
-- Hoy, cuando registerInventoryForCartItems() falla (en pos.actions.ts:487),
-- la venta se persiste igual con el marcador
-- "[DESCARGO INVENTARIO PENDIENTE — Revisar manualmente]" en SalesOrder.notes.
-- Eso preserva la venta (decisión del negocio) pero deja al inventario fuera
-- de sincronía sin reintentar.
--
-- Esta tabla materializa un outbox: cada fallo del descargo deja una fila
-- aquí con el payload necesario para reintentar; un cron / worker lee filas
-- pendientes con backoff exponencial (nextRetryAt).
--
-- Características
-- ---------------
-- - 100% additive: solo CREATE TABLE + indices. No toca SalesOrder, ni
--   InventoryMovement, ni el flujo del POS.
-- - FK a SalesOrder con ON DELETE SET NULL para no perder el registro de
--   intentos si el operador anula la venta original.
-- - El campo "payload" guarda el snapshot serializado del cart en el
--   momento del fallo (items con menuItemId + quantity + areaId del POS).
--   Si la receta o stock cambian entre intentos, el cron debe re-validar
--   antes de aplicar.
-- - Estados:
--     PENDING       — esperando primer/siguiente intento
--     IN_PROGRESS   — el worker la tomó (lock soft con updatedAt)
--     COMPLETED     — descargo finalmente aplicado
--     FAILED        — agotó maxAttempts; requiere intervención manual
--     CANCELLED     — el operador la archivó manualmente
-- - Índice (status, nextRetryAt) optimiza la query del cron:
--     WHERE status='PENDING' AND nextRetryAt <= NOW() ORDER BY nextRetryAt
--
-- Migración inversa (rollback)
-- ----------------------------
--   DROP TABLE IF EXISTS "InventoryDeductionRetry";
-- ============================================================================

CREATE TABLE IF NOT EXISTS "InventoryDeductionRetry" (
    "id"            TEXT          NOT NULL,
    "salesOrderId"  TEXT,         -- FK SalesOrder (nullable: ON DELETE SET NULL)
    "payload"       TEXT          NOT NULL,        -- JSON serializado del cart snapshot
    "status"        TEXT          NOT NULL DEFAULT 'PENDING',
    "attempts"      INTEGER       NOT NULL DEFAULT 0,
    "maxAttempts"   INTEGER       NOT NULL DEFAULT 5,
    "lastError"     TEXT,         -- mensaje del último intento fallido
    "nextRetryAt"   TIMESTAMP(3)  NOT NULL,         -- cuándo el cron debe intentar
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt"   TIMESTAMP(3),
    "cancelledAt"   TIMESTAMP(3),
    "cancelledById" TEXT,         -- FK User opcional (quien archivó)
    "notes"         TEXT,         -- bitácora del operador
    "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "InventoryDeductionRetry_pkey" PRIMARY KEY ("id")
);

-- Índices

CREATE INDEX IF NOT EXISTS "InventoryDeductionRetry_status_idx"
    ON "InventoryDeductionRetry"("status");

CREATE INDEX IF NOT EXISTS "InventoryDeductionRetry_nextRetryAt_idx"
    ON "InventoryDeductionRetry"("nextRetryAt");

-- Compuesto para la query del cron (ambos campos en el WHERE)
CREATE INDEX IF NOT EXISTS "InventoryDeductionRetry_status_nextRetryAt_idx"
    ON "InventoryDeductionRetry"("status", "nextRetryAt");

CREATE INDEX IF NOT EXISTS "InventoryDeductionRetry_salesOrderId_idx"
    ON "InventoryDeductionRetry"("salesOrderId");

-- Foreign keys

ALTER TABLE "InventoryDeductionRetry"
    ADD CONSTRAINT "InventoryDeductionRetry_salesOrderId_fkey"
    FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryDeductionRetry"
    ADD CONSTRAINT "InventoryDeductionRetry_cancelledById_fkey"
    FOREIGN KEY ("cancelledById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
