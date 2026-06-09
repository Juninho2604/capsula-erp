-- Documentos de proveedor (facturas / notas de entrega) — Compras Fase A.
-- Safe en producción viva: solo CREATE TABLE. No toca datos existentes.

-- CreateTable
CREATE TABLE "SupplierDocument" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "paymentCondition" TEXT NOT NULL DEFAULT 'CONTADO',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "documentUrl" TEXT,
    "inventoryStatus" TEXT NOT NULL DEFAULT 'NOT_ENTERED',
    "inventoryEnteredAt" TIMESTAMP(3),
    "linkedPurchaseOrderId" TEXT,
    "accountPayableId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierDocumentItem" (
    "id" TEXT NOT NULL,
    "supplierDocumentId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "SupplierDocumentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierDocument_tenantId_idx" ON "SupplierDocument"("tenantId");
CREATE INDEX "SupplierDocument_documentType_idx" ON "SupplierDocument"("documentType");
CREATE INDEX "SupplierDocument_inventoryStatus_idx" ON "SupplierDocument"("inventoryStatus");
CREATE INDEX "SupplierDocument_linkedPurchaseOrderId_idx" ON "SupplierDocument"("linkedPurchaseOrderId");
CREATE INDEX "SupplierDocument_status_idx" ON "SupplierDocument"("status");

-- CreateIndex
CREATE INDEX "SupplierDocumentItem_supplierDocumentId_idx" ON "SupplierDocumentItem"("supplierDocumentId");

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocumentItem" ADD CONSTRAINT "SupplierDocumentItem_supplierDocumentId_fkey" FOREIGN KEY ("supplierDocumentId") REFERENCES "SupplierDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
