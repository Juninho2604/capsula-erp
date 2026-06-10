'use server';

/**
 * Action delgada — Reportes de INVENTARIO (familia D): kardex por rango.
 * Las existencias valorizadas siguen en reports.actions.ts (§51.C) y la
 * variación semanal en §51.B — esta action cubre el kardex.
 * RBAC: reportes.inventario.ver. Solo lectura.
 */

import { z } from 'zod';
import { PERM } from '@/lib/constants/permissions-registry';
import { prepareReportFilters } from '@/lib/reports/action-helpers';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getKardex, getKardexFilterOptions, type KardexReport } from '@/lib/reports/inventory-reports';

const kardexExtraSchema = z.object({
    inventoryItemId: z.string().min(1).optional(),
    areaId: z.string().min(1).optional(),
    movementType: z.enum([
        'PURCHASE', 'SALE', 'PRODUCTION_IN', 'PRODUCTION_OUT',
        'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER', 'WASTE',
    ]).optional(),
    page: z.number().int().min(1).max(10_000).optional(),
    pageSize: z.number().int().min(10).max(200).optional(),
});

export async function getKardexReportAction(input: unknown): Promise<{
    success: boolean; message?: string; data?: KardexReport;
}> {
    try {
        const prep = await prepareReportFilters(PERM.REPORTES_INVENTARIO_VER, input);
        if (!prep.ok) return { success: false, message: prep.message };

        const extra = kardexExtraSchema.safeParse(input);
        if (!extra.success) {
            return { success: false, message: `Parámetros inválidos: ${extra.error.issues[0]?.message}` };
        }

        const data = await getKardex({ ...prep.filters, ...extra.data });
        return { success: true, data };
    } catch (err) {
        console.error('[getKardexReportAction]', err);
        return { success: false, message: 'Error generando el kardex' };
    }
}

export async function getKardexFilterOptionsAction(): Promise<{
    success: boolean; message?: string;
    data?: { items: Array<{ id: string; sku: string; name: string }>; areas: Array<{ id: string; name: string }> };
}> {
    try {
        const guard = await checkActionPermission(PERM.REPORTES_INVENTARIO_VER);
        if (!guard.ok) return { success: false, message: guard.message };
        const { tenantId } = await resolveTenantContext();
        const data = await getKardexFilterOptions(tenantId);
        return { success: true, data };
    } catch (err) {
        console.error('[getKardexFilterOptionsAction]', err);
        return { success: false, message: 'Error cargando filtros' };
    }
}
