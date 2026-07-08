-- CreateTable
CREATE TABLE "MenuModifierIngredient" (
    "id" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "ingredientItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "MenuModifierIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuModifierIngredient_ingredientItemId_idx" ON "MenuModifierIngredient"("ingredientItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuModifierIngredient_modifierId_ingredientItemId_key" ON "MenuModifierIngredient"("modifierId", "ingredientItemId");

-- AddForeignKey
ALTER TABLE "MenuModifierIngredient" ADD CONSTRAINT "MenuModifierIngredient_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "MenuModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuModifierIngredient" ADD CONSTRAINT "MenuModifierIngredient_ingredientItemId_fkey" FOREIGN KEY ("ingredientItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

