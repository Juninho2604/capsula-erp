-- CreateTable
CREATE TABLE "SatisfactionSurvey" (
    "id" TEXT NOT NULL,
    "openTabId" TEXT,
    "tabCode" TEXT,
    "tableName" TEXT,
    "waiterName" TEXT,
    "rating" TEXT NOT NULL,
    "foodRating" TEXT,
    "serviceRating" TEXT,
    "ambianceRating" TEXT,
    "comment" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "SatisfactionSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SatisfactionSurvey_tenantId_idx" ON "SatisfactionSurvey"("tenantId");

-- CreateIndex
CREATE INDEX "SatisfactionSurvey_createdAt_idx" ON "SatisfactionSurvey"("createdAt");

-- CreateIndex
CREATE INDEX "SatisfactionSurvey_rating_idx" ON "SatisfactionSurvey"("rating");

-- CreateIndex
CREATE INDEX "SatisfactionSurvey_openTabId_idx" ON "SatisfactionSurvey"("openTabId");

-- AddForeignKey
ALTER TABLE "SatisfactionSurvey" ADD CONSTRAINT "SatisfactionSurvey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisfactionSurvey" ADD CONSTRAINT "SatisfactionSurvey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

