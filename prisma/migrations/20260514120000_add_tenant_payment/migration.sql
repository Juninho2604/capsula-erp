-- TenantPayment: registro manual de pagos del tenant al operador SaaS.
-- NO multi-tenant a nivel app: solo SUPER_ADMIN escribe/lee.
-- Idempotente: usa IF NOT EXISTS para soportar replay.

CREATE TABLE IF NOT EXISTS "TenantPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TenantPayment_tenantId_paidAt_idx"
    ON "TenantPayment"("tenantId", "paidAt");

CREATE INDEX IF NOT EXISTS "TenantPayment_recordedById_idx"
    ON "TenantPayment"("recordedById");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TenantPayment_tenantId_fkey'
    ) THEN
        ALTER TABLE "TenantPayment"
            ADD CONSTRAINT "TenantPayment_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TenantPayment_recordedById_fkey'
    ) THEN
        ALTER TABLE "TenantPayment"
            ADD CONSTRAINT "TenantPayment_recordedById_fkey"
            FOREIGN KEY ("recordedById") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;
