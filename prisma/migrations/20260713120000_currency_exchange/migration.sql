-- CreateTable
CREATE TABLE "CurrencyExchange" (
    "id" TEXT NOT NULL,
    "exchangeDate" TIMESTAMP(3) NOT NULL,
    "currencyOut" TEXT NOT NULL DEFAULT 'USD',
    "amountOut" DOUBLE PRECISION NOT NULL,
    "currencyIn" TEXT NOT NULL DEFAULT 'BS',
    "amountIn" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "fromAccountId" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "CurrencyExchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyExchangeDestination" (
    "id" TEXT NOT NULL,
    "currencyExchangeId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,

    CONSTRAINT "CurrencyExchangeDestination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurrencyExchange_tenantId_idx" ON "CurrencyExchange"("tenantId");

-- CreateIndex
CREATE INDEX "CurrencyExchange_exchangeDate_idx" ON "CurrencyExchange"("exchangeDate");

-- CreateIndex
CREATE INDEX "CurrencyExchange_status_idx" ON "CurrencyExchange"("status");

-- CreateIndex
CREATE INDEX "CurrencyExchange_fromAccountId_idx" ON "CurrencyExchange"("fromAccountId");

-- CreateIndex
CREATE INDEX "CurrencyExchangeDestination_currencyExchangeId_idx" ON "CurrencyExchangeDestination"("currencyExchangeId");

-- CreateIndex
CREATE INDEX "CurrencyExchangeDestination_bankAccountId_idx" ON "CurrencyExchangeDestination"("bankAccountId");

-- AddForeignKey
ALTER TABLE "CurrencyExchange" ADD CONSTRAINT "CurrencyExchange_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyExchange" ADD CONSTRAINT "CurrencyExchange_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyExchange" ADD CONSTRAINT "CurrencyExchange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyExchangeDestination" ADD CONSTRAINT "CurrencyExchangeDestination_currencyExchangeId_fkey" FOREIGN KEY ("currencyExchangeId") REFERENCES "CurrencyExchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyExchangeDestination" ADD CONSTRAINT "CurrencyExchangeDestination_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

