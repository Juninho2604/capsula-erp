-- Add POS navigation fields to MenuItem
ALTER TABLE "MenuItem" ADD COLUMN "posGroup" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "posSubcategory" TEXT;
