-- Comisiones configurables por contraparte (natural/jurídica) e dirección.
-- Safe en producción viva: solo ADD COLUMN con DEFAULT 0.

ALTER TABLE "BankAccount" ADD COLUMN "commInNaturalPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "BankAccount" ADD COLUMN "commInJuridicaPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "BankAccount" ADD COLUMN "commOutNaturalPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "BankAccount" ADD COLUMN "commOutJuridicaPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "PosTerminal" ADD COLUMN "commNaturalPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PosTerminal" ADD COLUMN "commJuridicaPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill: la comisión legada del PDV pasa a ser la tasa de persona natural.
UPDATE "PosTerminal" SET "commNaturalPct" = "commissionPct" WHERE "commissionPct" > 0;
