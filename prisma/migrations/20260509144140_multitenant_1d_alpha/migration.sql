-- ============================================================================
-- Multi-tenant Step 1.D-α — tenantId + backfill en lote BAJO RIESGO
--
-- 10 modelos secundarios: InventoryItem, MenuModifierGroup, MenuModifier,
-- AuditLog, ExchangeRate, GameType, WristbandPlan, QueueTicket,
-- SkuCreationTemplate, BroadcastMessage.
--
-- Cada modelo recibe en la MISMA transacción:
--   1. ALTER TABLE ... ADD COLUMN "tenantId" TEXT NULL
--   2. ADD CONSTRAINT FK hacia Tenant(id) ON DELETE RESTRICT
--   3. CREATE INDEX en tenantId
--   4. UPDATE ... SET tenantId = 'tnt_shanklish_caracas' WHERE tenantId IS NULL
--
-- Por qué schema + backfill juntos:
--   El sub-paso 1.C aplicó el UPDATE pero la migration no quedó registrada en
--   _prisma_migrations al primer intento (problema de Vercel preview que se
--   resolvió manualmente). Combinándolos en una sola migration eliminamos
--   esa ventana de tiempo y reducimos riesgo.
--
-- Atomicidad:
--   Postgres envuelve toda la migration en transacción. Si CUALQUIER paso
--   falla, ROLLBACK completo. Vercel cancela el deploy y el sitio sigue
--   corriendo con el código anterior.
--
-- Performance:
--   ADD COLUMN nullable es metadata-only en Postgres 11+ (sin reescribir
--   filas). UPDATE en tablas <10k filas es <100ms. Total: < 1s.
--
-- Cero impacto runtime:
--   Las columnas son opcionales en Prisma. Las queries actuales no las leen
--   ni las escriben.
--
-- Rollback (si fuese necesario después):
--   ALTER TABLE "X" DROP COLUMN "tenantId" CASCADE;  (CASCADE quita FK + index)
-- ============================================================================

-- ─── InventoryItem ──────────────────────────────────────────────────────────
ALTER TABLE "InventoryItem" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "InventoryItem_tenantId_idx" ON "InventoryItem"("tenantId");
UPDATE "InventoryItem" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── MenuModifierGroup ──────────────────────────────────────────────────────
ALTER TABLE "MenuModifierGroup" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "MenuModifierGroup"
  ADD CONSTRAINT "MenuModifierGroup_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "MenuModifierGroup_tenantId_idx" ON "MenuModifierGroup"("tenantId");
UPDATE "MenuModifierGroup" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── MenuModifier ───────────────────────────────────────────────────────────
ALTER TABLE "MenuModifier" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "MenuModifier"
  ADD CONSTRAINT "MenuModifier_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "MenuModifier_tenantId_idx" ON "MenuModifier"("tenantId");
UPDATE "MenuModifier" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── AuditLog ───────────────────────────────────────────────────────────────
ALTER TABLE "AuditLog" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");
UPDATE "AuditLog" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── ExchangeRate ───────────────────────────────────────────────────────────
ALTER TABLE "ExchangeRate" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ExchangeRate"
  ADD CONSTRAINT "ExchangeRate_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ExchangeRate_tenantId_idx" ON "ExchangeRate"("tenantId");
UPDATE "ExchangeRate" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── GameType ───────────────────────────────────────────────────────────────
ALTER TABLE "GameType" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "GameType"
  ADD CONSTRAINT "GameType_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "GameType_tenantId_idx" ON "GameType"("tenantId");
UPDATE "GameType" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── WristbandPlan ──────────────────────────────────────────────────────────
ALTER TABLE "WristbandPlan" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "WristbandPlan"
  ADD CONSTRAINT "WristbandPlan_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "WristbandPlan_tenantId_idx" ON "WristbandPlan"("tenantId");
UPDATE "WristbandPlan" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── QueueTicket ────────────────────────────────────────────────────────────
ALTER TABLE "QueueTicket" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "QueueTicket"
  ADD CONSTRAINT "QueueTicket_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "QueueTicket_tenantId_idx" ON "QueueTicket"("tenantId");
UPDATE "QueueTicket" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── SkuCreationTemplate ────────────────────────────────────────────────────
ALTER TABLE "SkuCreationTemplate" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SkuCreationTemplate"
  ADD CONSTRAINT "SkuCreationTemplate_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "SkuCreationTemplate_tenantId_idx" ON "SkuCreationTemplate"("tenantId");
UPDATE "SkuCreationTemplate" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;

-- ─── BroadcastMessage ───────────────────────────────────────────────────────
ALTER TABLE "BroadcastMessage" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "BroadcastMessage"
  ADD CONSTRAINT "BroadcastMessage_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "BroadcastMessage_tenantId_idx" ON "BroadcastMessage"("tenantId");
UPDATE "BroadcastMessage" SET "tenantId" = 'tnt_shanklish_caracas' WHERE "tenantId" IS NULL;
