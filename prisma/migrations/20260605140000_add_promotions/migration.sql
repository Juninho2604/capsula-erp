-- Promotion: happy hour por horario (descuento automático por día/hora).
-- Safe en producción viva: CREATE TABLE + ADD COLUMN nullable.

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "maxDiscountPerUnit" DOUBLE PRECISION,
    "applicableCategoryIds" TEXT DEFAULT '[]',
    "applicableItemIds" TEXT DEFAULT '[]',
    "daysOfWeek" TEXT DEFAULT '[]',
    "startTime" TEXT,
    "endTime" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Promotion_tenantId_idx" ON "Promotion"("tenantId");
CREATE INDEX "Promotion_isActive_idx" ON "Promotion"("isActive");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SalesOrderItem: snapshot de promoción aplicada (auditoría). Nullable.
ALTER TABLE "SalesOrderItem" ADD COLUMN "appliedPromotionId" TEXT;
ALTER TABLE "SalesOrderItem" ADD COLUMN "appliedPromotionName" TEXT;
ALTER TABLE "SalesOrderItem" ADD COLUMN "originalUnitPrice" DOUBLE PRECISION;
ALTER TABLE "SalesOrderItem" ADD COLUMN "promotionDiscount" DOUBLE PRECISION;
