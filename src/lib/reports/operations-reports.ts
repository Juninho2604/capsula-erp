/**
 * Servicio de reportes OPERATIVOS (familia B del catálogo).
 *  - Cierres por día (Z histórico resumido; el detalle completo de un día
 *    sigue en getDailyZReportAction).
 *  - Turnos de caja (X): cierres de CashRegister + ventas vinculadas por
 *    cashRegisterId (solo data posterior a la migración FASE B; el legado
 *    no tiene vínculo orden→turno y se reporta con los totales guardados).
 *  - Anulaciones (órdenes e ítems) con motivo y autorizador.
 *  - Descuentos y cortesías con autorizador + descuentos por promoción.
 *  - Transferencias de mesa con los PINs involucrados.
 */

import { Prisma } from '@prisma/client';
import prisma from '@/server/db';
import type { ReportFilters } from './types';

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

// ── Cierres por día (Z resumido histórico) ───────────────────────────────────

export interface DailyClosureRow {
    /** 'YYYY-MM-DD' zona Caracas. */
    day: string;
    orders: number;
    facturado: number;
    /** Cobrado: splits PAID + directas (criterio de getSalesByPaymentMethod). */
    cobrado: number;
    serviceCharge: number;
    propinas: number;
    anuladasCount: number;
    anuladasTotal: number;
}

export async function getDailyClosures(f: ReportFilters): Promise<DailyClosureRow[]> {
    const dayExpr = (col: Prisma.Sql) =>
        Prisma.sql`to_char((${col} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Caracas')::date, 'YYYY-MM-DD')`;
    // Filtro de sucursal para las sub-queries que no usan orderWhere
    // (splits van por OpenTab.branchId; PKP/anuladas por SalesOrder.branchId)
    const branchOrder = f.branchIds && f.branchIds.length > 0
        ? Prisma.sql`AND o."branchId" IN (${Prisma.join(f.branchIds)})`
        : Prisma.empty;
    const branchTab = f.branchIds && f.branchIds.length > 0
        ? Prisma.sql`AND t."branchId" IN (${Prisma.join(f.branchIds)})`
        : Prisma.empty;

    const [facturado, splits, directas, propinasPkp, anuladas] = await Promise.all([
        prisma.$queryRaw<Array<{ day: string; orders: number; total: number }>>(Prisma.sql`
            SELECT ${dayExpr(Prisma.sql`o."createdAt"`)} AS day,
                   COUNT(*)::float AS orders,
                   COALESCE(SUM(o."total"), 0)::float AS total
            FROM "SalesOrder" o
            WHERE ${orderWhere(f)}
            GROUP BY 1 ORDER BY 1
        `),
        prisma.$queryRaw<Array<{ day: string; cobrado: number; service: number; tips: number }>>(Prisma.sql`
            SELECT ${dayExpr(Prisma.sql`s."paidAt"`)} AS day,
                   COALESCE(SUM(s."total"), 0)::float AS cobrado,
                   COALESCE(SUM(s."serviceChargeAmount"), 0)::float AS service,
                   COALESCE(SUM(s."tipAmount"), 0)::float AS tips
            FROM "PaymentSplit" s
            JOIN "OpenTab" t ON t."id" = s."openTabId"
            WHERE t."tenantId" = ${f.tenantId}
              AND s."status" = 'PAID'
              AND s."paidAt" >= ${f.from} AND s."paidAt" <= ${f.to}
              ${branchTab}
            GROUP BY 1 ORDER BY 1
        `),
        prisma.$queryRaw<Array<{ day: string; cobrado: number }>>(Prisma.sql`
            SELECT ${dayExpr(Prisma.sql`o."createdAt"`)} AS day,
                   COALESCE(SUM(o."total"), 0)::float AS cobrado
            FROM "SalesOrder" o
            WHERE ${orderWhere(f)} AND o."serviceFlow" = 'DIRECT_SALE'
            GROUP BY 1 ORDER BY 1
        `),
        prisma.$queryRaw<Array<{ day: string; tips: number }>>(Prisma.sql`
            SELECT ${dayExpr(Prisma.sql`o."createdAt"`)} AS day,
                   COALESCE(SUM(o."amountPaid"), 0)::float AS tips
            FROM "SalesOrder" o
            WHERE o."tenantId" = ${f.tenantId}
              AND o."createdAt" >= ${f.from} AND o."createdAt" <= ${f.to}
              AND o."customerName" = 'PROPINA COLECTIVA'
              AND o."status" <> 'CANCELLED'
              ${branchOrder}
            GROUP BY 1 ORDER BY 1
        `),
        prisma.$queryRaw<Array<{ day: string; count: number; total: number }>>(Prisma.sql`
            SELECT ${dayExpr(Prisma.sql`o."voidedAt"`)} AS day,
                   COUNT(*)::float AS count,
                   COALESCE(SUM(o."total"), 0)::float AS total
            FROM "SalesOrder" o
            WHERE o."tenantId" = ${f.tenantId}
              AND o."voidedAt" >= ${f.from} AND o."voidedAt" <= ${f.to}
              ${branchOrder}
            GROUP BY 1 ORDER BY 1
        `),
    ]);

    const byDay = new Map<string, DailyClosureRow>();
    const day = (d: string): DailyClosureRow => {
        let row = byDay.get(d);
        if (!row) {
            row = { day: d, orders: 0, facturado: 0, cobrado: 0, serviceCharge: 0, propinas: 0, anuladasCount: 0, anuladasTotal: 0 };
            byDay.set(d, row);
        }
        return row;
    };
    for (const r of facturado) { const x = day(r.day); x.orders = Number(r.orders); x.facturado = Number(r.total); }
    for (const r of splits) { const x = day(r.day); x.cobrado += Number(r.cobrado); x.serviceCharge += Number(r.service); x.propinas += Number(r.tips); }
    for (const r of directas) { const x = day(r.day); x.cobrado += Number(r.cobrado); }
    for (const r of propinasPkp) { const x = day(r.day); x.propinas += Number(r.tips); }
    for (const r of anuladas) { const x = day(r.day); x.anuladasCount = Number(r.count); x.anuladasTotal = Number(r.total); }

    return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

// ── Turnos de caja (Reporte X) ───────────────────────────────────────────────

export interface CashShiftRow {
    id: string;
    registerName: string;
    shiftDate: string;          // ISO
    shiftType: string;
    status: string;
    openedBy: string;
    closedBy: string | null;
    openedAt: string;
    closedAt: string | null;
    openingCashUsd: number;
    openingCashBs: number;
    closingCashUsd: number | null;
    closingCashBs: number | null;
    /** Totales GUARDADOS al cierre (fórmula legacy — ver DIAGNOSTICO BUG #4). */
    storedTotalSales: number | null;
    storedExpected: number | null;
    storedDifference: number | null;
    /** Ventas VINCULADAS por cashRegisterId (solo data post-FASE B). */
    linkedOrders: number;
    linkedSalesUsd: number;
    linkedByMethod: Array<{ method: string; usd: number }>;
}

export async function getCashShifts(f: ReportFilters): Promise<CashShiftRow[]> {
    const registers = await prisma.cashRegister.findMany({
        where: {
            tenantId: f.tenantId,
            OR: [
                { openedAt: { gte: f.from, lte: f.to } },
                { shiftDate: { gte: f.from, lte: f.to } },
            ],
        },
        include: {
            openedBy: { select: { firstName: true, lastName: true } },
            closedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { openedAt: 'desc' },
        take: 200,
    });

    const ids = registers.map(r => r.id);
    const linked = ids.length
        ? await prisma.$queryRaw<Array<{ cashRegisterId: string; method: string; orders: number; usd: number }>>(Prisma.sql`
            SELECT o."cashRegisterId" AS "cashRegisterId",
                   COALESCE(o."paymentMethod", 'CASH') AS method,
                   COUNT(*)::float AS orders,
                   COALESCE(SUM(o."total"), 0)::float AS usd
            FROM "SalesOrder" o
            WHERE o."tenantId" = ${f.tenantId}
              AND o."cashRegisterId" IN (${Prisma.join(ids)})
              AND o."status" <> 'CANCELLED'
              AND COALESCE(o."customerName", '') <> 'PROPINA COLECTIVA'
            GROUP BY o."cashRegisterId", COALESCE(o."paymentMethod", 'CASH')
        `)
        : [];

    const linkedByRegister = new Map<string, Array<{ method: string; orders: number; usd: number }>>();
    for (const row of linked) {
        const arr = linkedByRegister.get(row.cashRegisterId) ?? [];
        arr.push({ method: row.method, orders: Number(row.orders), usd: Number(row.usd) });
        linkedByRegister.set(row.cashRegisterId, arr);
    }

    return registers.map(r => {
        const lk = linkedByRegister.get(r.id) ?? [];
        return {
            id: r.id,
            registerName: r.registerName,
            shiftDate: r.shiftDate.toISOString(),
            shiftType: r.shiftType,
            status: r.status,
            openedBy: `${r.openedBy.firstName} ${r.openedBy.lastName}`.trim(),
            closedBy: r.closedBy ? `${r.closedBy.firstName} ${r.closedBy.lastName}`.trim() : null,
            openedAt: r.openedAt.toISOString(),
            closedAt: r.closedAt?.toISOString() ?? null,
            openingCashUsd: r.openingCashUsd,
            openingCashBs: r.openingCashBs,
            closingCashUsd: r.closingCashUsd,
            closingCashBs: r.closingCashBs,
            storedTotalSales: r.totalSalesUsd,
            storedExpected: r.expectedCash,
            storedDifference: r.difference,
            linkedOrders: lk.reduce((s, x) => s + x.orders, 0),
            linkedSalesUsd: lk.reduce((s, x) => s + x.usd, 0),
            linkedByMethod: lk.map(x => ({ method: x.method, usd: x.usd })).sort((a, b) => b.usd - a.usd),
        };
    });
}

// ── Anulaciones (órdenes e ítems) ────────────────────────────────────────────

export interface VoidedOrderRow {
    orderNumber: string;
    voidedAt: string;
    total: number;
    customerName: string | null;
    voidReason: string | null;
    voidedBy: string | null;
    createdBy: string;
    orderType: string;
}

export interface VoidedItemRow {
    orderNumber: string;
    voidedAt: string;
    itemName: string;
    quantity: number;
    lineTotal: number;
    voidReason: string | null;
    authorizedBy: string;   // Waiter capitán o User gerente
    replaced: boolean;
}

export interface VoidsReport {
    orders: VoidedOrderRow[];
    items: VoidedItemRow[];
    totals: { ordersCount: number; ordersTotal: number; itemsCount: number; itemsTotal: number };
}

export async function getVoidsReport(f: ReportFilters): Promise<VoidsReport> {
    const [orders, items] = await Promise.all([
        prisma.salesOrder.findMany({
            where: {
                tenantId: f.tenantId,
                voidedAt: { gte: f.from, lte: f.to },
                ...(f.branchIds?.length ? { branchId: { in: f.branchIds } } : {}),
            },
            select: {
                orderNumber: true, voidedAt: true, total: true, customerName: true,
                voidReason: true, orderType: true,
                voidedBy: { select: { firstName: true, lastName: true } },
                createdBy: { select: { firstName: true, lastName: true } },
            },
            orderBy: { voidedAt: 'desc' },
            take: 500,
        }),
        prisma.salesOrderItem.findMany({
            where: {
                tenantId: f.tenantId,
                voidedAt: { gte: f.from, lte: f.to },
            },
            select: {
                itemName: true, quantity: true, lineTotal: true, voidReason: true,
                voidedAt: true, replacedByItemId: true,
                voidedByWaiter: { select: { firstName: true, lastName: true } },
                voidedByUser: { select: { firstName: true, lastName: true } },
                order: { select: { orderNumber: true } },
            },
            orderBy: { voidedAt: 'desc' },
            take: 500,
        }),
    ]);

    const orderRows: VoidedOrderRow[] = orders.map(o => ({
        orderNumber: o.orderNumber,
        voidedAt: o.voidedAt!.toISOString(),
        total: o.total,
        customerName: o.customerName,
        voidReason: o.voidReason,
        voidedBy: o.voidedBy ? `${o.voidedBy.firstName} ${o.voidedBy.lastName}`.trim() : null,
        createdBy: `${o.createdBy.firstName} ${o.createdBy.lastName}`.trim(),
        orderType: o.orderType,
    }));

    const itemRows: VoidedItemRow[] = items.map(i => ({
        orderNumber: i.order.orderNumber,
        voidedAt: i.voidedAt!.toISOString(),
        itemName: i.itemName,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        voidReason: i.voidReason,
        authorizedBy: i.voidedByWaiter
            ? `Capitán: ${i.voidedByWaiter.firstName} ${i.voidedByWaiter.lastName}`.trim()
            : i.voidedByUser
                ? `Gerente: ${i.voidedByUser.firstName} ${i.voidedByUser.lastName}`.trim()
                : '—',
        replaced: Boolean(i.replacedByItemId),
    }));

    return {
        orders: orderRows,
        items: itemRows,
        totals: {
            ordersCount: orderRows.length,
            ordersTotal: orderRows.reduce((s, r) => s + r.total, 0),
            itemsCount: itemRows.length,
            itemsTotal: itemRows.reduce((s, r) => s + r.lineTotal, 0),
        },
    };
}

// ── Descuentos y cortesías ───────────────────────────────────────────────────

export interface DiscountRow {
    orderNumber: string;
    createdAt: string;
    discountType: string;
    discountReason: string | null;
    discount: number;
    total: number;
    authorizedBy: string | null;
    createdBy: string;
}

export interface DiscountsReport {
    rows: DiscountRow[];
    byType: Array<{ discountType: string; count: number; amount: number }>;
    promos: Array<{ promotionName: string; units: number; amount: number }>;
    totals: { count: number; amount: number; promoAmount: number };
}

export async function getDiscountsReport(f: ReportFilters): Promise<DiscountsReport> {
    const [orders, promoRows] = await Promise.all([
        prisma.salesOrder.findMany({
            where: {
                tenantId: f.tenantId,
                createdAt: { gte: f.from, lte: f.to },
                status: { not: 'CANCELLED' },
                discount: { gt: 0 },
                ...(f.branchIds?.length ? { branchId: { in: f.branchIds } } : {}),
            },
            select: {
                orderNumber: true, createdAt: true, discountType: true, discountReason: true,
                discount: true, total: true,
                authorizedBy: { select: { firstName: true, lastName: true } },
                createdBy: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        }),
        prisma.$queryRaw<Array<{ name: string; units: number; amount: number }>>(Prisma.sql`
            SELECT COALESCE(i."appliedPromotionName", 'Promoción') AS name,
                   COALESCE(SUM(i."quantity"), 0)::float AS units,
                   COALESCE(SUM(COALESCE(i."promotionDiscount", 0)), 0)::float AS amount
            FROM "SalesOrderItem" i
            JOIN "SalesOrder" o ON o."id" = i."orderId"
            WHERE ${orderWhere(f)}
              AND i."voidedAt" IS NULL
              AND i."appliedPromotionId" IS NOT NULL
            GROUP BY 1 ORDER BY amount DESC
        `),
    ]);

    const rows: DiscountRow[] = orders.map(o => ({
        orderNumber: o.orderNumber,
        createdAt: o.createdAt.toISOString(),
        discountType: o.discountType ?? 'OTRO',
        discountReason: o.discountReason,
        discount: o.discount,
        total: o.total,
        authorizedBy: o.authorizedBy ? `${o.authorizedBy.firstName} ${o.authorizedBy.lastName}`.trim() : null,
        createdBy: `${o.createdBy.firstName} ${o.createdBy.lastName}`.trim(),
    }));

    const byTypeMap = new Map<string, { count: number; amount: number }>();
    for (const r of rows) {
        const e = byTypeMap.get(r.discountType) ?? { count: 0, amount: 0 };
        e.count += 1; e.amount += r.discount;
        byTypeMap.set(r.discountType, e);
    }

    const promos = promoRows.map(p => ({ promotionName: p.name, units: Number(p.units), amount: Number(p.amount) }));

    return {
        rows,
        byType: Array.from(byTypeMap.entries())
            .map(([discountType, v]) => ({ discountType, ...v }))
            .sort((a, b) => b.amount - a.amount),
        promos,
        totals: {
            count: rows.length,
            amount: rows.reduce((s, r) => s + r.discount, 0),
            promoAmount: promos.reduce((s, p) => s + p.amount, 0),
        },
    };
}

// ── Transferencias de mesa ───────────────────────────────────────────────────

export interface TableTransferRow {
    transferredAt: string;
    tabCode: string;
    fromWaiter: string;
    toWaiter: string;
    fromTable: string | null;
    toTable: string | null;
    authorizedBy: string;
    reason: string | null;
}

export async function getTableTransfers(f: ReportFilters): Promise<TableTransferRow[]> {
    // TableTransfer no tiene tenantId — se aísla vía openTab.tenantId (§43.3).
    const rows = await prisma.tableTransfer.findMany({
        where: {
            transferredAt: { gte: f.from, lte: f.to },
            openTab: {
                tenantId: f.tenantId,
                ...(f.branchIds?.length ? { branchId: { in: f.branchIds } } : {}),
            },
        },
        select: {
            transferredAt: true, reason: true, authorizedNote: true,
            openTab: { select: { tabCode: true } },
            fromWaiter: { select: { firstName: true, lastName: true } },
            toWaiter: { select: { firstName: true, lastName: true } },
            fromTable: { select: { name: true } },
            toTable: { select: { name: true } },
            authorizedByWaiter: { select: { firstName: true, lastName: true } },
            authorizedByUser: { select: { firstName: true, lastName: true } },
        },
        orderBy: { transferredAt: 'desc' },
        take: 300,
    });

    return rows.map(t => ({
        transferredAt: t.transferredAt.toISOString(),
        tabCode: t.openTab.tabCode,
        fromWaiter: `${t.fromWaiter.firstName} ${t.fromWaiter.lastName}`.trim(),
        toWaiter: `${t.toWaiter.firstName} ${t.toWaiter.lastName}`.trim(),
        fromTable: t.fromTable?.name ?? null,
        toTable: t.toTable?.name ?? null,
        authorizedBy: t.authorizedNote
            ?? (t.authorizedByWaiter ? `Capitán: ${t.authorizedByWaiter.firstName} ${t.authorizedByWaiter.lastName}` : null)
            ?? (t.authorizedByUser ? `Gerente: ${t.authorizedByUser.firstName} ${t.authorizedByUser.lastName}` : null)
            ?? '—',
        reason: t.reason,
    }));
}
