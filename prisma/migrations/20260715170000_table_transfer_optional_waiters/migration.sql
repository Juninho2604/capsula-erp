-- DropForeignKey
ALTER TABLE "TableTransfer" DROP CONSTRAINT "TableTransfer_fromWaiterId_fkey";

-- DropForeignKey
ALTER TABLE "TableTransfer" DROP CONSTRAINT "TableTransfer_toWaiterId_fkey";

-- AlterTable
ALTER TABLE "TableTransfer" ALTER COLUMN "fromWaiterId" DROP NOT NULL,
ALTER COLUMN "toWaiterId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_fromWaiterId_fkey" FOREIGN KEY ("fromWaiterId") REFERENCES "Waiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_toWaiterId_fkey" FOREIGN KEY ("toWaiterId") REFERENCES "Waiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

