'use server';

/**
 * Action delgada — Reportes de VENTAS (familia A).
 * Sesión + RBAC (reportes.ventas.ver) + zod en prepareReportFilters;
 * agregación en src/lib/reports/sales-reports.ts. Solo lectura.
 */

import { PERM } from '@/lib/constants/permissions-registry';
import { prepareReportFilters } from '@/lib/reports/action-helpers';
import {
    getSalesByProduct, getSalesByCategory, getSalesByWaiter, getSalesByZone,
    getSalesByChannel, getSalesByPaymentMethod, getSalesSeries, getSalesRangeTotals,
    type SalesByProductRow, type SalesByCategoryRow, type SalesByWaiterRow,
    type SalesByDimensionRow, type SalesByPaymentMethodRow, type SalesSeriesPoint,
    type SalesRangeTotals,
} from '@/lib/reports/sales-reports';

export interface VentasReportData {
    totals: SalesRangeTotals;
    byProduct: SalesByProductRow[];
    byCategory: SalesByCategoryRow[];
    byWaiter: SalesByWaiterRow[];
    byZone: SalesByDimensionRow[];
    byChannel: SalesByDimensionRow[];
    byMethod: SalesByPaymentMethodRow[];
    series: SalesSeriesPoint[];
}

export async function getVentasReportAction(input: unknown): Promise<{
    success: boolean; message?: string; data?: VentasReportData;
}> {
    try {
        const prep = await prepareReportFilters(PERM.REPORTES_VENTAS_VER, input);
        if (!prep.ok) return { success: false, message: prep.message };
        const f = prep.filters;

        const [totals, byProduct, byCategory, byWaiter, byZone, byChannel, byMethod, series] =
            await Promise.all([
                getSalesRangeTotals(f),
                getSalesByProduct(f),
                getSalesByCategory(f),
                getSalesByWaiter(f),
                getSalesByZone(f),
                getSalesByChannel(f),
                getSalesByPaymentMethod(f),
                getSalesSeries(f, 'day'),
            ]);

        return {
            success: true,
            data: { totals, byProduct, byCategory, byWaiter, byZone, byChannel, byMethod, series },
        };
    } catch (err) {
        console.error('[getVentasReportAction]', err);
        return { success: false, message: 'Error generando el reporte de ventas' };
    }
}
