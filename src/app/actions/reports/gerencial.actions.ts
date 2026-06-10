'use server';

/**
 * Action delgada — Reportes GERENCIALES (familia E).
 * RBAC: reportes.gerencial.ver — SOLO roles administrativos
 * (OWNER/ADMIN_MANAGER/AUDITOR por base; ver permissions-registry).
 * Solo lectura.
 */

import { z } from 'zod';
import { PERM } from '@/lib/constants/permissions-registry';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { prepareReportFilters } from '@/lib/reports/action-helpers';
import {
    getExecutiveDayKpis, getMenuEngineering, type ExecutiveDayKpis,
} from '@/lib/reports/management-reports';
import type { MenuEngineeringResult } from '@/lib/reports/menu-engineering';
import prisma from '@/server/db';

const daySchema = z.object({
    /** Día Caracas 'YYYY-MM-DD'. Default: hoy. */
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    branchIds: z.array(z.string().min(1)).max(20).optional(),
});

export async function getExecutiveDashboardAction(input?: unknown): Promise<{
    success: boolean; message?: string; data?: ExecutiveDayKpis;
}> {
    try {
        // El dashboard ejecutivo es la portada del módulo: lo puede ver
        // cualquiera con AL MENOS la familia ventas; los reportes gerenciales
        // profundos (ingeniería de menú) exigen reportes.gerencial.ver.
        const guard = await checkActionPermission(PERM.REPORTES_VENTAS_VER);
        if (!guard.ok) return { success: false, message: guard.message };

        const parsed = daySchema.safeParse(input ?? {});
        if (!parsed.success) return { success: false, message: 'Parámetros inválidos' };

        const { tenantId } = await resolveTenantContext();
        const date = parsed.data.day ? new Date(parsed.data.day + 'T12:00:00') : new Date();
        const data = await getExecutiveDayKpis(tenantId, date, parsed.data.branchIds);
        return { success: true, data };
    } catch (err) {
        console.error('[getExecutiveDashboardAction]', err);
        return { success: false, message: 'Error generando el dashboard ejecutivo' };
    }
}

export async function getMenuEngineeringAction(input: unknown): Promise<{
    success: boolean; message?: string; data?: MenuEngineeringResult;
}> {
    try {
        const prep = await prepareReportFilters(PERM.REPORTES_GERENCIAL_VER, input);
        if (!prep.ok) return { success: false, message: prep.message };
        const data = await getMenuEngineering(prep.filters);
        return { success: true, data };
    } catch (err) {
        console.error('[getMenuEngineeringAction]', err);
        return { success: false, message: 'Error generando la ingeniería de menú' };
    }
}

/** Sucursales activas del tenant para el selector de los reportes. */
export async function getReportBranchesAction(): Promise<{
    success: boolean; message?: string; data?: Array<{ id: string; name: string }>;
}> {
    try {
        const guard = await checkActionPermission(PERM.REPORTES_VENTAS_VER);
        if (!guard.ok) return { success: false, message: guard.message };
        const { tenantId } = await resolveTenantContext();
        const branches = await prisma.branch.findMany({
            where: { tenantId, isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        return { success: true, data: branches };
    } catch (err) {
        console.error('[getReportBranchesAction]', err);
        return { success: false, message: 'Error cargando sucursales' };
    }
}
