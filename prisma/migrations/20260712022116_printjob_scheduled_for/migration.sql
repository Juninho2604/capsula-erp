-- §104: impresión diferida de comandas (pedidos futuros). ADD COLUMN nullable
-- + CREATE INDEX — safe en producción viva.

-- AlterTable
ALTER TABLE "PrintJob" ADD COLUMN     "scheduledFor" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PrintJob_tenantId_status_scheduledFor_idx" ON "PrintJob"("tenantId", "status", "scheduledFor");
