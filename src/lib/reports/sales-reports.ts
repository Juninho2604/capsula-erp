/**
 * Servicio de reportes de VENTAS (familia A del catálogo).
 *
 * Agregaciones server-side vía $queryRaw tipado (los GROUP BY con JOIN
 * item→orden→categoría no son expresables con prisma.groupBy) — nunca se
 * traen todas las filas a memoria. Multi-tenant: cada query filtra por el
 * tenantId recibido (resuelto de la sesión en la action).
 *
 * Criterio FACTURADO (ver types.ts): status <> CANCELLED, sin PROPINA
 * COLECTIVA, ítems no anulados — espejo de revenueWhere (§20.3).
 */

import { Prisma } from '@prisma/client';
import prisma from '@/server/db';
import type { ReportFilters, DualMoney } from './types';

// ── Fragmentos SQL compartidos ───────────────────────────────────────────────

/** Filtro base de órdenes facturadas (alias `o`). */
function orderWhere(f: ReportFilters) {
    const branch = f.branchIds && f.branchIds.length > 0
        ? Prisma.sql`AND o."branchId" IN (${Prisma.join(f.branchIds)})`
        : Prisma.empty;
    return Prisma.sql`
        o."tenantId" = ${f.tenantId}
        AND o."createdAt" >= ${f.from} AND o."createdAt" <= ${f.to}
        AND o."status" <> 'CANCELLED'
        AND COALESCE(o."customerName", '') <> 'PROPINA COLECTIVA'
        ${branch}
    `;
}

// ── Ventas por producto ──────────────────────────────────────────────────────

export interface SalesByProductRow {
    menuItemId: string;
    name: string;
    category: string;
    units: number;
    revenue: number;
    /** COGS desde el snapshot SalesOrderItem.costTotal (0 en ventas previas al fix A0.1). */
    cost: number;
}

export async function getSalesByProduct(f: ReportFilters): Promise<SalesByProductRow[]> {
    const rows = await prisma.$queryRaw<Array<{
        menuItemId: string; name: string; category: string;
        units: number; revenue: number; cost: number;
    }>>(Prisma.sql`
        SELECT
            i."menuItemId"                                   AS "menuItemId",
            MAX(i."itemName")                                AS "name",
            COALESCE(MAX(c."name"), 'Sin categoría')         AS "category",
            COALESCE(SUM(i."quantity"), 0)::float            AS "units",
            COALESCE(SUM(i."lineTotal"), 0)::float           AS "revenue",
            COALESCE(SUM(COALESCE(i."costTotal", 0)), 0)::float AS "cost"
        FROM "SalesOrderItem" i
        JOIN "SalesOrder" o ON o."id" = i."orderId"
        LEFT JOIN "MenuItem" m ON m."id" = i."menuItemId"
        LEFT JOIN "MenuCategory" c ON c."id" = m."categoryId"
        WHERE ${orderWhere(f)}
          AND i."voidedAt" IS NULL
        GROUP BY i."menuItemId"
        ORDER BY "revenue" DESC
    `);
    return rows.map(r => ({ ...r, units: Number(r.units), revenue: Number(r.revenue), cost: Number(r.cost) }));
}

// ── Ventas por categoría ─────────────────────────────────────────────────────

export interface SalesByCategoryRow {
    category: string;
    units: number;
    revenue: number;
    cost: number;
    /** % del total de revenue del rango (lo calcula el servicio). */
    pctOfTotal: number;
}

export async function getSalesByCategory(f: ReportFilters): Promise<SalesByCategoryRow[]> {
    const rows = await prisma.$queryRaw<Array<{ category: string; units: number; revenue: number; cost: number }>>(Prisma.sql`
        SELECT
            COALESCE(c."name", 'Sin categoría')              AS "category",
            COALESCE(SUM(i."quantity"), 0)::float            AS "units",
            COALESCE(SUM(i."lineTotal"), 0)::float           AS "revenue",
            COALESCE(SUM(COALESCE(i."costTotal", 0)), 0)::float AS "cost"
        FROM "SalesOrderItem" i
        JOIN "SalesOrder" o ON o."id" = i."orderId"
        LEFT JOIN "MenuItem" m ON m."id" = i."menuItemId"
        LEFT JOIN "MenuCategory" c ON c."id" = m."categoryId"
        WHERE ${orderWhere(f)}
          AND i."voidedAt" IS NULL
        GROUP BY COALESCE(c."name", 'Sin categoría')
        ORDER BY "revenue" DESC
    `);
    const total = rows.reduce((s, r) => s + Number(r.revenue), 0);
    return rows.map(r => ({
        category: r.category,
        units: Number(r.units),
        revenue: Number(r.revenue),
        cost: Number(r.cost),
        pctOfTotal: total > 0 ? (Number(r.revenue) / total) * 100 : 0,
    }));
}

// ── Ventas por mesonero ──────────────────────────────────────────────────────

export interface SalesByWaiterRow {
    waiterId: string | null;
    waiterName: string;
    orders: number;
    revenue: number;
    avgTicket: number;
}

export async function getSalesByWaiter(f: ReportFilters): Promise<SalesByWaiterRow[]> {
    const rows = await prisma.$queryRaw<Array<{
        waiterId: string | null; waiterName: string; orders: number; revenue: number;
    }>>(Prisma.sql`
        SELECT
            w."id"                                                          AS "waiterId",
            COALESCE(w."firstName" || ' ' || w."lastName", 'Sin mesonero (caja/delivery)') AS "waiterName",
            COUNT(DISTINCT o."id")::float                                   AS "orders",
            COALESCE(SUM(o."total"), 0)::float                              AS "revenue"
        FROM "SalesOrder" o
        LEFT JOIN "Waiter" w ON w."id" = o."waiterProfileId"
        WHERE ${orderWhere(f)}
        GROUP BY w."id", COALESCE(w."firstName" || ' ' || w."lastName", 'Sin mesonero (caja/delivery)')
        ORDER BY "revenue" DESC
    `);
    return rows.map(r => ({
        waiterId: r.waiterId,
        waiterName: r.waiterName,
        orders: Number(r.orders),
        revenue: Number(r.revenue),
        avgTicket: Number(r.orders) > 0 ? Number(r.revenue) / Number(r.orders) : 0,
    }));
}

// ── Ventas por área/zona y por canal ─────────────────────────────────────────

export interface SalesByDimensionRow {
    key: string;
    label: string;
    orders: number;
    revenue: number;
}

/** Por zona de servicio (salón/barra/jardín). Órdenes sin zona = canal directo. */
export async function getSalesByZone(f: ReportFilters): Promise<SalesByDimensionRow[]> {
    const rows = await prisma.$queryRaw<Array<{ key: string; label: string; orders: number; revenue: number }>>(Prisma.sql`
        SELECT
            COALESCE(z."id", 'SIN_ZONA')                       AS "key",
            COALESCE(z."name", 'Sin zona (pickup/delivery)')   AS "label",
            COUNT(DISTINCT o."id")::float                      AS "orders",
            COALESCE(SUM(o."total"), 0)::float                 AS "revenue"
        FROM "SalesOrder" o
        LEFT JOIN "ServiceZone" z ON z."id" = o."serviceZoneId"
        WHERE ${orderWhere(f)}
        GROUP BY COALESCE(z."id", 'SIN_ZONA'), COALESCE(z."name", 'Sin zona (pickup/delivery)')
        ORDER BY "revenue" DESC
    `);
    return rows.map(r => ({ ...r, orders: Number(r.orders), revenue: Number(r.revenue) }));
}

/** Por canal de venta (mesa/pickup/delivery/PedidosYA/manual). */
export async function getSalesByChannel(f: ReportFilters): Promise<SalesByDimensionRow[]> {
    const rows = await prisma.$queryRaw<Array<{ key: string; orders: number; revenue: number }>>(Prisma.sql`
        SELECT
            CASE
                WHEN o."orderType" = 'PEDIDOSYA' OR o."sourceChannel" = 'POS_PEDIDOSYA' THEN 'PEDIDOSYA'
                WHEN o."orderType" = 'DELIVERY' THEN 'DELIVERY'
                WHEN o."serviceFlow" = 'OPEN_TAB' THEN 'MESA'
                WHEN o."notes" LIKE '%Venta Directa Pickup%' THEN 'PICKUP'
                WHEN o."sourceChannel" IN ('POS_RESTAURANT', 'POS_SPORTBAR') THEN 'PICKUP'
                ELSE COALESCE(o."sourceChannel", 'OTRO')
            END                                          AS "key",
            COUNT(DISTINCT o."id")::float                AS "orders",
            COALESCE(SUM(o."total"), 0)::float           AS "revenue"
        FROM "SalesOrder" o
        WHERE ${orderWhere(f)}
        GROUP BY 1
        ORDER BY "revenue" DESC
    `);
    const LABELS: Record<string, string> = {
        MESA: 'Mesas (restaurante)', PICKUP: 'Pickup / mostrador', DELIVERY: 'Delivery',
        PEDIDOSYA: 'PedidosYA', MANUAL_ENTRY: 'Carga manual', OTRO: 'Otros',
    };
    return rows.map(r => ({
        key: r.key,
        label: LABELS[r.key] ?? r.key,
        orders: Number(r.orders),
        revenue: Number(r.revenue),
    }));
}

// ── Ventas por método de pago (COBRADO, dual currency) ───────────────────────

export interface SalesByPaymentMethodRow extends DualMoney {
    method: string;
    count: number;
}

/**
 * Criterio COBRADO con tasa histórica:
 *  - Ventas directas pago único → total de la orden + totalBs persistido
 *    (fallback: total × exchangeRateValue de la orden; si ambos null y el
 *    método es Bs → usdSinTasa).
 *  - Ventas directas pago MIXTO → líneas SalesOrderPayment (amountBS/tasa
 *    de cada línea — el selector mixto apunta al total exacto).
 *  - Mesas/subcuentas → PaymentSplit PAID (total cobrado con servicio;
 *    amountBs persistido desde FASE B; histórico sin tasa → usdSinTasa).
 * Disjunto por diseño: las mesas no crean SalesOrderPayment y las directas
 * no crean PaymentSplit.
 */
export async function getSalesByPaymentMethod(f: ReportFilters): Promise<SalesByPaymentMethodRow[]> {
    const branchTab = f.branchIds && f.branchIds.length > 0
        ? Prisma.sql`AND t."branchId" IN (${Prisma.join(f.branchIds)})`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<Array<{
        method: string; count: number; usd: number; bs: number; usdsintasa: number;
    }>>(Prisma.sql`
        WITH cobros AS (
            -- Directas pago único: el total de la orden al método de la orden
            SELECT
                COALESCE(o."paymentMethod", 'CASH') AS method,
                o."total"::float                    AS usd,
                COALESCE(o."totalBs",
                         o."total" * o."exchangeRateValue")::float AS bs,
                (o."paymentMethod" IN ('CASH_BS','PDV_SHANKLISH','PDV_SUPERFERRO','MOVIL_NG','MOBILE_PAY','CARD','TRANSFER')) AS is_bs
            FROM "SalesOrder" o
            WHERE ${orderWhere(f)}
              AND o."serviceFlow" = 'DIRECT_SALE'
              AND COALESCE(o."paymentMethod", '') <> 'MULTIPLE'
              AND o."total" > 0

            UNION ALL

            -- Directas pago mixto: línea por línea con su tasa
            SELECT
                p."method",
                p."amountUSD"::float,
                p."amountBS"::float,
                (p."method" IN ('CASH_BS','PDV_SHANKLISH','PDV_SUPERFERRO','MOVIL_NG','MOBILE_PAY','CARD','TRANSFER'))
            FROM "SalesOrderPayment" p
            JOIN "SalesOrder" o ON o."id" = p."salesOrderId"
            WHERE ${orderWhere(f)}
              AND o."serviceFlow" = 'DIRECT_SALE'
              AND o."paymentMethod" = 'MULTIPLE'

            UNION ALL

            -- Mesas y subcuentas: splits cobrados (incluye 10% servicio)
            SELECT
                COALESCE(s."paymentMethod", 'CASH'),
                s."total"::float,
                COALESCE(s."amountBs", s."total" * s."exchangeRate")::float,
                (COALESCE(s."paymentMethod",'') IN ('CASH_BS','PDV_SHANKLISH','PDV_SUPERFERRO','MOVIL_NG','MOBILE_PAY','CARD','TRANSFER'))
            FROM "PaymentSplit" s
            JOIN "OpenTab" t ON t."id" = s."openTabId"
            WHERE t."tenantId" = ${f.tenantId}
              AND s."status" = 'PAID'
              AND s."paidAt" >= ${f.from} AND s."paidAt" <= ${f.to}
              ${branchTab}
        )
        SELECT
            method,
            COUNT(*)::float                                           AS count,
            COALESCE(SUM(usd), 0)::float                              AS usd,
            COALESCE(SUM(CASE WHEN is_bs THEN bs END), 0)::float      AS bs,
            COALESCE(SUM(CASE WHEN is_bs AND bs IS NULL THEN usd ELSE 0 END), 0)::float AS usdsintasa
        FROM cobros
        GROUP BY method
        ORDER BY usd DESC
    `);
    return rows.map(r => ({
        method: r.method,
        count: Number(r.count),
        usd: Number(r.usd),
        bs: Number(r.bs),
        usdSinTasa: Number(r.usdsintasa),
    }));
}

// ── Serie temporal (por día o por hora, zona Caracas) ────────────────────────

export interface SalesSeriesPoint {
    /** 'YYYY-MM-DD' (day) o '0'..'23' (hour) en zona Caracas. */
    bucket: string;
    orders: number;
    revenue: number;
}

export async function getSalesSeries(
    f: ReportFilters,
    groupBy: 'day' | 'hour',
): Promise<SalesSeriesPoint[]> {
    // createdAt se guarda en UTC (timestamp naive) → convertir a Caracas.
    const bucketExpr = groupBy === 'day'
        ? Prisma.sql`to_char((o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Caracas')::date, 'YYYY-MM-DD')`
        : Prisma.sql`to_char(date_part('hour', o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Caracas'), 'FM99')`;

    const rows = await prisma.$queryRaw<Array<{ bucket: string; orders: number; revenue: number }>>(Prisma.sql`
        SELECT
            ${bucketExpr}                          AS "bucket",
            COUNT(DISTINCT o."id")::float          AS "orders",
            COALESCE(SUM(o."total"), 0)::float     AS "revenue"
        FROM "SalesOrder" o
        WHERE ${orderWhere(f)}
        GROUP BY 1
        ORDER BY 1
    `);
    return rows.map(r => ({ bucket: r.bucket, orders: Number(r.orders), revenue: Number(r.revenue) }));
}

// ── Totales del rango (para encabezado/cuadre) ───────────────────────────────

export interface SalesRangeTotals {
    orders: number;
    revenue: number;        // FACTURADO (Σ total órdenes)
    discount: number;
    cost: number;           // Σ costTotal de ítems (COGS snapshot)
    itemsUnits: number;
}

export async function getSalesRangeTotals(f: ReportFilters): Promise<SalesRangeTotals> {
    const [head] = await prisma.$queryRaw<Array<{
        orders: number; revenue: number; discount: number;
    }>>(Prisma.sql`
        SELECT COUNT(*)::float AS orders,
               COALESCE(SUM(o."total"), 0)::float AS revenue,
               COALESCE(SUM(o."discount"), 0)::float AS discount
        FROM "SalesOrder" o
        WHERE ${orderWhere(f)}
    `);
    const [items] = await prisma.$queryRaw<Array<{ cost: number; units: number }>>(Prisma.sql`
        SELECT COALESCE(SUM(COALESCE(i."costTotal", 0)), 0)::float AS cost,
               COALESCE(SUM(i."quantity"), 0)::float AS units
        FROM "SalesOrderItem" i
        JOIN "SalesOrder" o ON o."id" = i."orderId"
        WHERE ${orderWhere(f)} AND i."voidedAt" IS NULL
    `);
    return {
        orders: Number(head?.orders ?? 0),
        revenue: Number(head?.revenue ?? 0),
        discount: Number(head?.discount ?? 0),
        cost: Number(items?.cost ?? 0),
        itemsUnits: Number(items?.units ?? 0),
    };
}
