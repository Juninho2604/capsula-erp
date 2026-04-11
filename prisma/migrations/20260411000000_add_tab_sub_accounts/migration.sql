-- Migration: add_tab_sub_accounts
-- Adds TabSubAccount and SubAccountItem models.
-- Adds subAccountId FK to PaymentSplit.
-- Adds no destructive changes to existing tables.

-- ─── TabSubAccount ────────────────────────────────────────────────────────────
CREATE TABLE "TabSubAccount" (
    "id"            TEXT NOT NULL,
    "openTabId"     TEXT NOT NULL,
    "label"         TEXT NOT NULL,
    "sortOrder"     INTEGER NOT NULL DEFAULT 0,
    "status"        TEXT NOT NULL DEFAULT 'OPEN',
    "subtotal"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serviceCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "paidAt"        TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TabSubAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TabSubAccount_openTabId_status_idx" ON "TabSubAccount"("openTabId", "status");

ALTER TABLE "TabSubAccount"
    ADD CONSTRAINT "TabSubAccount_openTabId_fkey"
    FOREIGN KEY ("openTabId") REFERENCES "OpenTab"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── SubAccountItem ───────────────────────────────────────────────────────────
CREATE TABLE "SubAccountItem" (
    "id"               TEXT NOT NULL,
    "subAccountId"     TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "quantity"         INTEGER NOT NULL,
    "lineTotal"        DOUBLE PRECISION NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubAccountItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubAccountItem_subAccountId_idx" ON "SubAccountItem"("subAccountId");
CREATE INDEX "SubAccountItem_salesOrderItemId_idx" ON "SubAccountItem"("salesOrderItemId");

ALTER TABLE "SubAccountItem"
    ADD CONSTRAINT "SubAccountItem_subAccountId_fkey"
    FOREIGN KEY ("subAccountId") REFERENCES "TabSubAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubAccountItem"
    ADD CONSTRAINT "SubAccountItem_salesOrderItemId_fkey"
    FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── PaymentSplit — añadir subAccountId FK (nullable) ────────────────────────
ALTER TABLE "PaymentSplit"
    ADD COLUMN "subAccountId" TEXT;

CREATE INDEX "PaymentSplit_subAccountId_idx" ON "PaymentSplit"("subAccountId");

ALTER TABLE "PaymentSplit"
    ADD CONSTRAINT "PaymentSplit_subAccountId_fkey"
    FOREIGN KEY ("subAccountId") REFERENCES "TabSubAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
