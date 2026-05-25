-- displayName: nombre corto para headers de UI. Si null, los lugares de
-- UI hacen fallback a `name`. Para Shanklish se backfillea con "Shanklish"
-- para preservar EXACTAMENTE el visual previo en POS Delivery
-- ("Shanklish Delivery" en vez de "Shanklish Caracas Delivery") y en
-- filename de Excel arqueo ("Arqueo_Caja_Shanklish_*.xlsx" en vez de
-- "Arqueo_Caja_Shanklish_Caracas_*.xlsx").

ALTER TABLE "Tenant"
  ADD COLUMN "displayName" TEXT;

UPDATE "Tenant"
SET "displayName" = 'Shanklish'
WHERE "slug" = 'shanklish';
