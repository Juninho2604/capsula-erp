/**
 * Boilerplate compartido de las server actions de reportes:
 * sesión + RBAC granular (Capa 4) + validación zod + resolución de tenant
 * desde la sesión del servidor (NUNCA del cliente) + rango Caracas→UTC.
 */

import 'server-only';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import type { PermKey } from '@/lib/constants/permissions-registry';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { reportRangeSchema, resolveRangeDates } from './range';
import type { ReportFilters } from './types';

export type PreparedFilters =
    | { ok: true; filters: ReportFilters }
    | { ok: false; message: string };

export async function prepareReportFilters(perm: PermKey, input: unknown): Promise<PreparedFilters> {
    const guard = await checkActionPermission(perm);
    if (!guard.ok) return { ok: false, message: guard.message };

    const parsed = reportRangeSchema.safeParse(input);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return { ok: false, message: `Parámetros inválidos: ${issue?.message ?? 'formato incorrecto'}` };
    }

    const range = resolveRangeDates(parsed.data);
    if ('error' in range) return { ok: false, message: range.error };

    const { tenantId } = await resolveTenantContext();
    return {
        ok: true,
        filters: {
            tenantId,
            from: range.from,
            to: range.to,
            branchIds: parsed.data.branchIds?.length ? parsed.data.branchIds : undefined,
        },
    };
}
