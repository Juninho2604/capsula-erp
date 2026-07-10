-- SIN estilo Xetux (§94): ambas columnas son ADD COLUMN safe en producción viva.

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "allowSin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SalesOrderItemModifier" ADD COLUMN     "excludedIngredientItemId" TEXT;
