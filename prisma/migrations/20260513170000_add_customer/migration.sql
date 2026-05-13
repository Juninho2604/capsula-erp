-- AddCustomer
-- Crea la tabla `Customer` para guardar clientes recurrentes del POS.
-- Tenant-aware desde el día uno. idDocument único por tenant (NULL permitido
-- para clientes sin cédula, ej. turistas). Índices sobre fullName y phone
-- para autocomplete rápido en el POS Delivery.

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tnt_shanklish_caracas',
    "fullName" TEXT NOT NULL,
    "idDocument" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastOrderAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- Unique compuesto (tenantId, idDocument). Postgres trata múltiples NULLs
-- como distintos, así que varios clientes sin cédula NO chocan.
CREATE UNIQUE INDEX "Customer_tenantId_idDocument_key" ON "Customer"("tenantId", "idDocument");

CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");
CREATE INDEX "Customer_tenantId_fullName_idx" ON "Customer"("tenantId", "fullName");
CREATE INDEX "Customer_tenantId_phone_idx" ON "Customer"("tenantId", "phone");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
