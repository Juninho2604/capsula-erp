/**
 * Servicio de reportes GERENCIALES (familia E del catálogo).
 *  - Dashboard ejecutivo del día: ventas (dual), tickets, ticket promedio,
 *    comensales, top 5 productos, ventas por hora, comparativo vs mismo día
 *    de la semana pasada.
 *  - Ingeniería de menú: matriz popularidad × margen (clasificación pura en
 *    menu-engineering.ts, testeada).
 */

import { Prisma } from '@prisma/client';
import prisma from '@/server/db';
import { getCaracasDayRange, getCaracasDateStamp } from '@/lib/datetime';
import type { ReportFilters, DualMoney } from './types';
import { emptyDualMoney } from './types';
import {
    getSalesByProduct, getSalesByPaymentMethod, getSalesSeries, getSalesRangeTotals,
    type SalesByProductRow, type SalesSeriesPoint,
} from './sales-reports';
import { classifyMenuEngineering, type MenuEngineeringResult } from './menu-engineering';

// ── Dashboard ejecutivo del día ──────────────────────────────────────────────

export interface ExecutiveDayKpis {
    /** Día consultado ('YYYY-MM-DD' Caracas). */
    day: string;
    facturado: number;
    cobrado: DualMoney;
    orders: number;
    avgTicket: number;
    /** Σ guestCount de mesas abiertas en el día (solo mesas — delivery/pickup no registran comensales). */
    guests: number;
    propinas: number;
    anuladas: { count: number; total: number };
    topProducts: SalesByProductRow[];
    salesByHour: SalesSeriesPoint[];
    /** Mismo día de la semana pasada para el comparativo. */
    lastWeek: {
        day: string;
        facturado: number;
        orders: number;
        avgTicket: number;
    };
}

export async function getExecutiveDayKpis(
    tenantId: string,
    /** Fecha base del día (cualquier hora); default hoy Caracas. */
    date: Date = new Date(),
    branchIds?: string[],
): Promise<ExecutiveDayKpis> {
    const { start, end } = getCaracasDayRange(date);
    const lastWeekDate = new Date(date.getTime() - 7 * 86_400_000);
    const lw = getCaracasDayRange(lastWeekDate);

    const f: ReportFilters = { tenantId, from: start, to: end, branchIds };
    const fLw: ReportFilters = { tenantId, from: lw.start, to: lw.end, branchIds };

    const [totals, byMethod, topProducts, salesByHour, guestsRow, propinasAgg, anuladasAgg, lwTotals] = await Promise.all([
        getSalesRangeTotals(f),
        getSalesByPaymentMethod(f),
        getSalesByProduct(f),
        getSalesSeries(f, 'hour'),
        prisma.$queryRaw<Array<{ guests: number }>>(Prisma.sql`
            SELECT COALESCE(SUM(t."guestCount"), 0)::float AS guests
            FROM "OpenTab" t
            WHERE t."tenantId" = ${tenantId}
              AND t."openedAt" >= ${start} AND t."openedAt" <= ${end}
              AND t."status" <> 'CANCELLED'
              ${branchIds?.length ? Prisma.sql`AND t."branchId" IN (${Prisma.join(branchIds)})` : Prisma.empty}
        `),
        prisma.salesOrder.aggregate({
            where: {
                tenantId,
                createdAt: { gte: start, lte: end },
                customerName: 'PROPINA COLECTIVA',
                status: { not: 'CANCELLED' },
                ...(branchIds?.length ? { branchId: { in: branchIds } } : {}),
            },
            _sum: { amountPaid: true },
        }),
        prisma.salesOrder.aggregate({
            where: {
                tenantId,
                voidedAt: { gte: start, lte: end },
                ...(branchIds?.length ? { branchId: { in: branchIds } } : {}),
            },
            _count: { id: true },
            _sum: { total: true },
        }),
        getSalesRangeTotals(fLw),
    ]);

    const cobrado = byMethod.reduce<DualMoney>((acc, m) => ({
        usd: acc.usd + m.usd,
        bs: acc.bs + m.bs,
        usdSinTasa: acc.usdSinTasa + m.usdSinTasa,
    }), emptyDualMoney());

    // Propinas de splits del día (mesas) + PKP colectivas
    const [splitTips] = await prisma.$queryRaw<Array<{ tips: number }>>(Prisma.sql`
        SELECT COALESCE(SUM(s."tipAmount"), 0)::float AS tips
        FROM "PaymentSplit" s
        JOIN "OpenTab" t ON t."id" = s."openTabId"
        WHERE t."tenantId" = ${tenantId}
          AND s."status" = 'PAID'
          AND s."paidAt" >= ${start} AND s."paidAt" <= ${end}
          ${branchIds?.length ? Prisma.sql`AND t."branchId" IN (${Prisma.join(branchIds)})` : Prisma.empty}
    `);

    return {
        day: getCaracasDateStamp(date),
        facturado: totals.revenue,
        cobrado,
        orders: totals.orders,
        avgTicket: totals.orders > 0 ? totals.revenue / totals.orders : 0,
        guests: Number(guestsRow[0]?.guests ?? 0),
        propinas: Number(splitTips?.tips ?? 0) + (propinasAgg._sum.amountPaid ?? 0),
        anuladas: { count: anuladasAgg._count.id, total: anuladasAgg._sum.total ?? 0 },
        topProducts: topProducts.slice(0, 5),
        salesByHour,
        lastWeek: {
            day: getCaracasDateStamp(lastWeekDate),
            facturado: lwTotals.revenue,
            orders: lwTotals.orders,
            avgTicket: lwTotals.orders > 0 ? lwTotals.revenue / lwTotals.orders : 0,
        },
    };
}

// ── Ingeniería de menú ───────────────────────────────────────────────────────

export async function getMenuEngineering(f: ReportFilters): Promise<MenuEngineeringResult> {
    const products = await getSalesByProduct(f);
    return classifyMenuEngineering(products);
}
