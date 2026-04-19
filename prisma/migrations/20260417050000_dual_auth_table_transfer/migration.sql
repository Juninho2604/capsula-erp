-- Dual authorization on TableTransfer:
-- Replace single authorizedById (FK→Waiter, NOT NULL)
-- with two nullable FKs: authorizedByWaiterId (Waiter captain) + authorizedByUserId (User manager)
-- and an authorizedNote text field for display.

-- 1. Drop old FK constraint
ALTER TABLE "TableTransfer" DROP CONSTRAINT "TableTransfer_authorizedById_fkey";

-- 2. Rename existing column → authorizedByWaiterId, make nullable
ALTER TABLE "TableTransfer" RENAME COLUMN "authorizedById" TO "authorizedByWaiterId";
ALTER TABLE "TableTransfer" ALTER COLUMN "authorizedByWaiterId" DROP NOT NULL;

-- 3. Add new columns
ALTER TABLE "TableTransfer" ADD COLUMN "authorizedByUserId" TEXT;
ALTER TABLE "TableTransfer" ADD COLUMN "authorizedNote"     TEXT;

-- 4. Restore Waiter FK (nullable, SET NULL on delete)
ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_authorizedByWaiterId_fkey"
    FOREIGN KEY ("authorizedByWaiterId") REFERENCES "Waiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Add User FK (nullable, SET NULL on delete)
ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_authorizedByUserId_fkey"
    FOREIGN KEY ("authorizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Index on new User FK
CREATE INDEX "TableTransfer_authorizedByUserId_idx" ON "TableTransfer"("authorizedByUserId");
