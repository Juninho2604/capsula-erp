'use server';

/**
 * Action delgada — Reportes OPERATIVOS (familia B).
 * RBAC: reportes.operativos.ver. Solo lectura.
 */

import { PERM } from '@/lib/constants/permissions-registry';
import { prepareReportFilters } from '@/lib/reports/action-helpers';
import {
    getDailyClosures, getCashShifts, getVoidsReport, getDiscountsReport, getTableTransfers,
    type DailyClosureRow, type CashShiftRow, type VoidsReport, type DiscountsReport,
    type TableTransferRow,
} from '@/lib/reports/operations-reports';

export interface OperativosReportData {
    closures: DailyClosureRow[];
    shifts: CashShiftRow[];
    voids: VoidsReport;
    discounts: DiscountsReport;
    transfers: TableTransferRow[];
}

export async function getOperativosReportAction(input: unknown): Promise<{
    success: boolean; message?: string; data?: OperativosReportData;
}> {
    try {
        const prep = await prepareReportFilters(PERM.REPORTES_OPERATIVOS_VER, input);
        if (!prep.ok) return { success: false, message: prep.message };
        const f = prep.filters;

        const [closures, shifts, voids, discounts, transfers] = await Promise.all([
            getDailyClosures(f),
            getCashShifts(f),
            getVoidsReport(f),
            getDiscountsReport(f),
            getTableTransfers(f),
        ]);

        return { success: true, data: { closures, shifts, voids, discounts, transfers } };
    } catch (err) {
        console.error('[getOperativosReportAction]', err);
        return { success: false, message: 'Error generando el reporte operativo' };
    }
}
