-- ============================================================================
-- Multi-tenant Step 1.D-γ — tenantId + backfill en lote ALTO RIESGO (POS crítico)
--
-- 14 modelos en la ruta caliente del POS:
--   User, Branch, Area, ServiceZone, TableOrStation, OpenTab, SalesOrder,
--   SalesOrderItem, Waiter, GameStation, GameSession, InvoiceCounter,
--   SystemConfig, Reservation.
--
-- IMPORTANTE: SystemConfig.key e InvoiceCounter.channel mantienen su
-- UNIQUE global. Eso es intencional — solo Shanklish opera, sin colisión.
-- En Fase 2 se cambia a unique compuesto (tenantId, key) y (tenantId, channel).
--
-- Atomicidad: todo en transacción. Si CUALQUIER paso falla → ROLLBACK
-- completo. Vercel cancela el deploy y el sitio sigue corriendo con el
-- código anterior. Cero downtime, cero pérdida de datos.
--
-- Performance:
--   - SalesOrder es la mayor (~4694 filas) → UPDATE < 500ms.
--   - User: 24 filas → trivial.
--   - OpenTab: depende de cuentas activas, pero ALTER ADD COLUMN nullable
--     es metadata-only, no bloquea reads/writes concurrentes.
--   - Total estimado: < 3 segundos.
--
-- Cero impacto runtime:
--   tenantId es opcional en Prisma. Las queries actuales NO lo leen ni
--   escriben. El POS sigue funcionando exactamente igual.
-- ============================================================================

-- ─── User ───────────────────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "User"
  ADD CONSTRAINT "User_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
UPDATE "User" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── Branch ─────────────────────────────────────────────────────────────────
ALTER TABLE "Branch" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Branch"
  ADD CONSTRAINT "Branch_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Branch_tenantId_idx" ON "Branch"("tenantId");
UPDATE "Branch" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── Area ───────────────────────────────────────────────────────────────────
ALTER TABLE "Area" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Area"
  ADD CONSTRAINT "Area_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Area_tenantId_idx" ON "Area"("tenantId");
UPDATE "Area" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── ServiceZone ────────────────────────────────────────────────────────────
ALTER TABLE "ServiceZone" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ServiceZone"
  ADD CONSTRAINT "ServiceZone_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ServiceZone_tenantId_idx" ON "ServiceZone"("tenantId");
UPDATE "ServiceZone" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── TableOrStation ─────────────────────────────────────────────────────────
ALTER TABLE "TableOrStation" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "TableOrStation"
  ADD CONSTRAINT "TableOrStation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TableOrStation_tenantId_idx" ON "TableOrStation"("tenantId");
UPDATE "TableOrStation" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── OpenTab ────────────────────────────────────────────────────────────────
ALTER TABLE "OpenTab" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "OpenTab"
  ADD CONSTRAINT "OpenTab_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "OpenTab_tenantId_idx" ON "OpenTab"("tenantId");
UPDATE "OpenTab" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── SalesOrder ─────────────────────────────────────────────────────────────
ALTER TABLE "SalesOrder" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "SalesOrder_tenantId_idx" ON "SalesOrder"("tenantId");
UPDATE "SalesOrder" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── SalesOrderItem ─────────────────────────────────────────────────────────
ALTER TABLE "SalesOrderItem" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SalesOrderItem"
  ADD CONSTRAINT "SalesOrderItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "SalesOrderItem_tenantId_idx" ON "SalesOrderItem"("tenantId");
UPDATE "SalesOrderItem" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── Waiter ─────────────────────────────────────────────────────────────────
ALTER TABLE "Waiter" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Waiter"
  ADD CONSTRAINT "Waiter_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Waiter_tenantId_idx" ON "Waiter"("tenantId");
UPDATE "Waiter" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── GameStation ────────────────────────────────────────────────────────────
ALTER TABLE "GameStation" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "GameStation"
  ADD CONSTRAINT "GameStation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "GameStation_tenantId_idx" ON "GameStation"("tenantId");
UPDATE "GameStation" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── GameSession ────────────────────────────────────────────────────────────
ALTER TABLE "GameSession" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "GameSession"
  ADD CONSTRAINT "GameSession_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "GameSession_tenantId_idx" ON "GameSession"("tenantId");
UPDATE "GameSession" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── InvoiceCounter ─────────────────────────────────────────────────────────
ALTER TABLE "InvoiceCounter" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "InvoiceCounter"
  ADD CONSTRAINT "InvoiceCounter_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "InvoiceCounter_tenantId_idx" ON "InvoiceCounter"("tenantId");
UPDATE "InvoiceCounter" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── SystemConfig ───────────────────────────────────────────────────────────
ALTER TABLE "SystemConfig" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SystemConfig"
  ADD CONSTRAINT "SystemConfig_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "SystemConfig_tenantId_idx" ON "SystemConfig"("tenantId");
UPDATE "SystemConfig" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── Reservation ────────────────────────────────────────────────────────────
ALTER TABLE "Reservation" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Reservation_tenantId_idx" ON "Reservation"("tenantId");
UPDATE "Reservation" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;
