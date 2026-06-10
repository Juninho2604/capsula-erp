'use server';

/**
 * Action delgada — Reportes de COMPRAS (familia C).
 * RBAC: reportes.compras.ver. Solo lectura.
 */

import { PERM } from '@/lib/constants/permissions-registry';
import { prepareReportFilters } from '@/lib/reports/action-helpers';
import { getPurchasesReport, type PurchasesReport } from '@/lib/reports/purchases-reports';

export async function getComprasReportAction(input: unknown): Promise<{
    success: boolean; message?: string; data?: PurchasesReport;
}> {
    try {
        const prep = await prepareReportFilters(PERM.REPORTES_COMPRAS_VER, input);
        if (!prep.ok) return { success: false, message: prep.message };
        const data = await getPurchasesReport(prep.filters);
        return { success: true, data };
    } catch (err) {
        console.error('[getComprasReportAction]', err);
        return { success: false, message: 'Error generando el reporte de compras' };
    }
}
