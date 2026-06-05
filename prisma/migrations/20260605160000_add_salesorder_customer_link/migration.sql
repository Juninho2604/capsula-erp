-- Vínculo CRM SalesOrder → Customer (cartera de clientes).
-- Safe en producción viva: ADD COLUMN nullable + FK SET NULL + índice.
ALTER TABLE "SalesOrder" ADD COLUMN "customerId" TEXT;

CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
