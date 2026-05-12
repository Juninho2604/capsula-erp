-- ============================================================================
-- §38 — Print Agent: tabla PrintJob + enums
--
-- Cola de trabajos de impresión despachados por el Print Agent (daemon
-- Node.js que corre en una PC del restaurante y habla ESC/POS a las
-- impresoras térmicas AON por TCP/IP).
--
-- El ERP encola (status=PENDING), el agent pollea cada ~1s, reclama
-- (PENDING → PRINTING), imprime, y reporta (COMPLETED o FAILED).
-- ============================================================================

CREATE TYPE "PrintJobType" AS ENUM (
    'RECEIPT',
    'PRECUENTA',
    'KITCHEN',
    'VOID_KITCHEN'
);

CREATE TYPE "PrintJobStatus" AS ENUM (
    'PENDING',
    'PRINTING',
    'COMPLETED',
    'FAILED'
);

CREATE TABLE "PrintJob" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "type"         "PrintJobType" NOT NULL,
    "station"      TEXT,
    "payload"      JSONB NOT NULL,
    "status"       "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "retries"      INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt"    TIMESTAMP(3),
    "completedAt"  TIMESTAMP(3),
    "enqueuedById" TEXT,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrintJob_tenantId_status_createdAt_idx"
    ON "PrintJob"("tenantId", "status", "createdAt");

CREATE INDEX "PrintJob_tenantId_completedAt_idx"
    ON "PrintJob"("tenantId", "completedAt");

ALTER TABLE "PrintJob"
    ADD CONSTRAINT "PrintJob_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrintJob"
    ADD CONSTRAINT "PrintJob_enqueuedById_fkey"
    FOREIGN KEY ("enqueuedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
