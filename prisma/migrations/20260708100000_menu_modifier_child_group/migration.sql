-- AlterTable
ALTER TABLE "MenuModifier" ADD COLUMN     "childGroupId" TEXT;

-- CreateIndex
CREATE INDEX "MenuModifier_childGroupId_idx" ON "MenuModifier"("childGroupId");

-- AddForeignKey
ALTER TABLE "MenuModifier" ADD CONSTRAINT "MenuModifier_childGroupId_fkey" FOREIGN KEY ("childGroupId") REFERENCES "MenuModifierGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

