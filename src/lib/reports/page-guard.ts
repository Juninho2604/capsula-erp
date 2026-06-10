/**
 * Guard server-side para las páginas del módulo Reportes.
 * Resuelve en una pasada: permiso de la familia, permiso de exportación,
 * nombre del tenant (encabezado de Excel/PDF) y sucursales activas.
 */

import 'server-only';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { hasPermission, type PermUser } from '@/lib/permissions/has-permission';
import { PERM, type PermKey } from '@/lib/constants/permissions-registry';

export interface ReportPageContext {
    allowed: boolean;
    canExport: boolean;
    tenantId: string;
    tenantName: string;
    branches: Array<{ id: string; name: string }>;
    /** Permisos por familia — para la navegación de la landing. */
    familyPerms: Record<'ventas' | 'operativos' | 'inventario' | 'compras' | 'gerencial' | 'fiscal', boolean>;
}

export async function getReportPageContext(perm: PermKey | null): Promise<ReportPageContext> {
    const denied: ReportPageContext = {
        allowed: false, canExport: false, tenantId: '', tenantName: '',
        branches: [],
        familyPerms: { ventas: false, operativos: false, inventario: false, compras: false, gerencial: false, fiscal: false },
    };

    const session = await getSession();
    if (!session?.id) return denied;

    const dbUser = await prisma.user.findUnique({
        where: { id: session.id },
        select: { role: true, allowedModules: true, isActive: true },
    });
    if (!dbUser?.isActive) return denied;

    const permUser: PermUser = {
        role: dbUser.role,
        allowedModules: dbUser.allowedModules,
        grantedPerms: session.grantedPerms ?? null,
        revokedPerms: session.revokedPerms ?? null,
    };

    const familyPerms = {
        ventas: hasPermission(permUser, PERM.REPORTES_VENTAS_VER),
        operativos: hasPermission(permUser, PERM.REPORTES_OPERATIVOS_VER),
        inventario: hasPermission(permUser, PERM.REPORTES_INVENTARIO_VER),
        compras: hasPermission(permUser, PERM.REPORTES_COMPRAS_VER),
        gerencial: hasPermission(permUser, PERM.REPORTES_GERENCIAL_VER),
        fiscal: hasPermission(permUser, PERM.REPORTES_FISCAL_VER),
    };

    const allowed = perm === null
        ? Object.values(familyPerms).some(Boolean)
        : hasPermission(permUser, perm);
    if (!allowed) return denied;

    const { tenantId } = await resolveTenantContext();
    const [tenant, branches] = await Promise.all([
        prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, displayName: true } }),
        prisma.branch.findMany({
            where: { tenantId, isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
    ]);

    return {
        allowed: true,
        canExport: hasPermission(permUser, PERM.REPORTES_EXPORTAR),
        tenantId,
        tenantName: tenant?.displayName || tenant?.name || 'KPSULA',
        branches,
        familyPerms,
    };
}
