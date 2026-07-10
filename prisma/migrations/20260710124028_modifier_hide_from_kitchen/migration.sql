-- §95: renglón interno (padre de sub-grupo anidado) persistido en la venta.
-- ADD COLUMN con default — safe en producción viva.

-- AlterTable
ALTER TABLE "SalesOrderItemModifier" ADD COLUMN     "hideFromKitchen" BOOLEAN NOT NULL DEFAULT false;
