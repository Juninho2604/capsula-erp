-- ============================================================================
-- §165 — ¿A dónde fue a parar la mercancía recibida por Compras?
--
-- Reporte de David: "los jefes le dan entrada a almacén desde compras… pero no
-- se está sumando al almacén". El código SÍ suma stock al recibir una orden,
-- así que la pregunta no es si sumó, sino EN QUÉ ALMACÉN sumó: el selector de
-- "Área de Almacenamiento" viene con uno puesto por defecto (el primero por
-- orden alfabético), y si nadie lo cambia, todo entra ahí.
--
-- Uso en el VPS:
--   cd /var/www/capsula-erp
--   psql "$DATABASE_URL" -f scripts/diagnostico-recepcion-compras.sql
-- ============================================================================

\echo '=== 1. Recepciones de los últimos 15 días, por almacén ==================='
-- Si TODO cae en un mismo almacén, ese es el default que nadie está cambiando.
SELECT
    a.name                        AS almacen,
    a."isActive"                  AS activo,
    COUNT(*)                      AS movimientos,
    ROUND(SUM(m.quantity)::numeric, 2) AS unidades_recibidas
FROM "InventoryMovement" m
JOIN "InventoryItem" i ON i.id = m."inventoryItemId"
-- El movimiento de compra no guarda el área; se infiere por la ubicación que
-- se tocó en la misma recepción. Por eso se cruza contra InventoryLocation.
LEFT JOIN "InventoryLocation" l ON l."inventoryItemId" = m."inventoryItemId"
LEFT JOIN "Area" a ON a.id = l."areaId"
WHERE m."movementType" = 'PURCHASE'
  AND m."createdAt" >= NOW() - INTERVAL '15 days'
GROUP BY a.name, a."isActive"
ORDER BY unidades_recibidas DESC NULLS LAST;

\echo ''
\echo '=== 2. Stock por almacén, incluidos los DESACTIVADOS ====================='
-- Un almacén desactivado no sale en los selectores, pero su stock SÍ suma en
-- los totales globales. Es la explicación candidata del descuadre histórico
-- (cebolla 200 en total vs 15 físicas).
SELECT
    a.name       AS almacen,
    a."isActive" AS activo,
    COUNT(*)     AS items_con_stock,
    ROUND(SUM(l."currentStock")::numeric, 2) AS stock_total
FROM "InventoryLocation" l
JOIN "Area" a ON a.id = l."areaId"
WHERE l."currentStock" <> 0
GROUP BY a.name, a."isActive"
ORDER BY a."isActive" DESC, stock_total DESC;

\echo ''
\echo '=== 3. Últimas 30 recepciones al detalle ================================'
-- Para contrastar contra lo que el jefe dice que recibió ese día.
SELECT
    m."createdAt"::date          AS fecha,
    i.name                       AS insumo,
    ROUND(m.quantity::numeric, 2) AS cantidad,
    m.unit                       AS unidad_movimiento,
    i."baseUnit"                 AS unidad_base,
    -- Si estas dos unidades difieren, el stock subió en la unidad equivocada.
    (m.unit IS DISTINCT FROM i."baseUnit") AS ojo_unidad_distinta,
    u."firstName" || ' ' || u."lastName" AS registro,
    m.reason
FROM "InventoryMovement" m
JOIN "InventoryItem" i ON i.id = m."inventoryItemId"
LEFT JOIN "User" u ON u.id = m."createdById"
WHERE m."movementType" = 'PURCHASE'
ORDER BY m."createdAt" DESC
LIMIT 30;

\echo ''
\echo '=== 4. Órdenes marcadas recibidas SIN movimiento de compra ==============='
-- Si algo sale acá, la orden cambió de estado pero el stock nunca se movió:
-- ese sí sería el bug que describe David en su forma literal.
SELECT
    o."orderNumber",
    o.status,
    o."receivedDate"::date AS recibida_el,
    s.name                 AS proveedor
FROM "PurchaseOrder" o
LEFT JOIN "Supplier" s ON s.id = o."supplierId"
WHERE o.status IN ('RECEIVED', 'PARTIAL')
  AND o."receivedDate" >= NOW() - INTERVAL '30 days'
  AND NOT EXISTS (
      SELECT 1 FROM "InventoryMovement" m
      WHERE m."movementType" = 'PURCHASE'
        AND m."referenceNumber" = o.id
  )
ORDER BY o."receivedDate" DESC;
