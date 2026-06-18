-- Canal WINK: precio override por producto (null = usar `price` base).
-- ADD COLUMN NULLABLE → seguro en producción viva (no requiere backfill).
ALTER TABLE "MenuItem" ADD COLUMN "winkPrice" DOUBLE PRECISION;
