-- ============================================================================
-- Multi-tenant Step 1.B — Añadir tenantId nullable a 6 modelos no críticos
--
-- Modelos: MenuCategory, MenuItem, Recipe, Supplier, ExpenseCategory,
-- ProductFamily.
--
-- Cambios:
--   1. ALTER TABLE ... ADD COLUMN "tenantId" TEXT (nullable, sin default)
--   2. ADD CONSTRAINT FK hacia Tenant(id) con ON DELETE RESTRICT
--   3. CREATE INDEX en tenantId para queries futuras filtradas por tenant
--
-- Por qué estos 6:
--   - No están en la ruta crítica del POS (cajeros/meseros no las tocan).
--   - Si la migration falla, el peor caso es error en edición de menú/recetas
--     pero la operación de venta sigue funcionando.
--
-- Atomicidad:
--   Postgres envuelve toda esta migration en una transacción (Prisma migrate
--   deploy). Si cualquier ALTER falla, ROLLBACK completo y la BD queda como
--   estaba. Vercel cancela el deploy y el sitio sigue corriendo con el código
--   anterior (que no necesitaba estos cambios).
--
-- Cero impacto runtime:
--   Las columnas son nullable. El código actual no las lee ni escribe.
--   Al hacer `prisma generate`, el client tendrá `tenantId?: string | null`
--   pero ningún query existente lo requiere.
--
-- Performance:
--   ADD COLUMN nullable sin default es metadata-only en Postgres 11+ (cero
--   reescrituras de filas). CREATE INDEX en tablas con < 10k filas es
--   instantáneo.
--
-- Rollback (si fuese necesario después):
--   ALTER TABLE ... DROP COLUMN "tenantId" CASCADE;
-- ============================================================================

-- ─── MenuCategory ───────────────────────────────────────────────────────────
ALTER TABLE "MenuCategory" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "MenuCategory"
  ADD CONSTRAINT "MenuCategory_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "MenuCategory_tenantId_idx" ON "MenuCategory"("tenantId");

-- ─── MenuItem ───────────────────────────────────────────────────────────────
ALTER TABLE "MenuItem" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "MenuItem_tenantId_idx" ON "MenuItem"("tenantId");

-- ─── Recipe ─────────────────────────────────────────────────────────────────
ALTER TABLE "Recipe" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "Recipe"
  ADD CONSTRAINT "Recipe_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Recipe_tenantId_idx" ON "Recipe"("tenantId");

-- ─── Supplier ───────────────────────────────────────────────────────────────
ALTER TABLE "Supplier" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "Supplier"
  ADD CONSTRAINT "Supplier_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- ─── ExpenseCategory ────────────────────────────────────────────────────────
ALTER TABLE "ExpenseCategory" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "ExpenseCategory"
  ADD CONSTRAINT "ExpenseCategory_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ExpenseCategory_tenantId_idx" ON "ExpenseCategory"("tenantId");

-- ─── ProductFamily ──────────────────────────────────────────────────────────
ALTER TABLE "ProductFamily" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "ProductFamily"
  ADD CONSTRAINT "ProductFamily_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ProductFamily_tenantId_idx" ON "ProductFamily"("tenantId");
