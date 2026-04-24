-- Add client-selected tip fields to OpenTab
-- tipPercent: selected percentage (0, 10, 15, 20), null = not yet selected
-- tipAmount:  tipPercent/100 × runningSubtotal, null = not yet selected
ALTER TABLE "OpenTab" ADD COLUMN "tipPercent" DOUBLE PRECISION;
ALTER TABLE "OpenTab" ADD COLUMN "tipAmount"  DOUBLE PRECISION;
