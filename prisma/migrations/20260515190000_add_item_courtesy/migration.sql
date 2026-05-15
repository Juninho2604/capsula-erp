-- AddItemCourtesy
-- Permite marcar items individuales de una mesa como "cortesía de la casa".
-- Los items con isCourtesy=true se EXCLUYEN del cálculo de runningTotal,
-- balanceDue y del recibo final, pero la comanda a cocina ya se procesó
-- (la comida real ya fue preparada). Solo capitanes/sub-capitanes pueden
-- marcar (via PIN), trackeado en courtesyAuthorizedByUserId + timestamp.

ALTER TABLE "SalesOrderItem"
    ADD COLUMN "isCourtesy" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "courtesyReason" TEXT,
    ADD COLUMN "courtesyAuthorizedByLabel" TEXT,
    ADD COLUMN "courtesyAuthorizedByUserId" TEXT,
    ADD COLUMN "courtesyAuthorizedAt" TIMESTAMP(3);

CREATE INDEX "SalesOrderItem_isCourtesy_idx" ON "SalesOrderItem"("isCourtesy");

ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_courtesyAuthorizedByUserId_fkey"
    FOREIGN KEY ("courtesyAuthorizedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
