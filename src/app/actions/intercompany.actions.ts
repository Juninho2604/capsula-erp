'use server';

/**
 * INTERCOMPANY ACTIONS — multitenant (Lote 6.b — Fase 3 Paso D.b).
 *
 * IntercompanySettlement no tiene tenantId ni relation a Branch en el schema
 * actual. Para tenant-filter robusto necesitamos:
 *   - Añadir `fromBranch: Branch @relation(...)` y `toBranch: Branch @relation(...)`
 *     en `model IntercompanySettlement`.
 *   - Filtrar por `fromBranch.tenantId`.
 *
 * Como workaround, filtramos por `fromBranchId IN (branches del tenant)`
 * resolviendo los branch ids primero. Funciona pero es menos eficiente.
 *
 * Para Shanklish-only no cambia comportamiento (todos los settlements son del
 * mismo tenant). Cuando se active multi-tenant pleno, conviene proponer la
 * relation explícita.
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

export type IntercompanySettlementWithLines = Awaited<
    ReturnType<typeof getSettlementById>
>;

async function getTenantBranchIds(tenantId: string): Promise<string[]> {
    const db = withTenant(tenantId);
    const branches = await db.branch.findMany({ select: { id: true } });
    return branches.map(b => b.id);
}

export async function getSettlements(filters?: {
    status?: string;
    fromBranchId?: string;
    toBranchId?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    const { tenantId } = await resolveTenantContext();
    const tenantBranchIds = await getTenantBranchIds(tenantId);
    if (tenantBranchIds.length === 0) return [];

    return prisma.intercompanySettlement.findMany({
        where: {
            deletedAt: null,
            fromBranchId: { in: tenantBranchIds },
            ...(filters?.status && { status: filters.status }),
            ...(filters?.fromBranchId && { fromBranchId: filters.fromBranchId }),
            ...(filters?.toBranchId && { toBranchId: filters.toBranchId }),
        },
        include: {
            lines: true,
        },
        orderBy: { createdAt: 'desc' },
    });
}

export async function getSettlementById(id: string) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    const { tenantId } = await resolveTenantContext();
    const tenantBranchIds = await getTenantBranchIds(tenantId);
    if (tenantBranchIds.length === 0) return null;

    return prisma.intercompanySettlement.findFirst({
        where: { id, deletedAt: null, fromBranchId: { in: tenantBranchIds } },
        include: { lines: true },
    });
}

export async function createSettlement(data: {
    fromBranchId: string;
    toBranchId: string;
    periodStart: Date;
    periodEnd: Date;
    notes?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');
    if (!['OWNER', 'ADMIN_MANAGER', 'AUDITOR'].includes(session.role)) {
        throw new Error('Sin permiso para crear liquidaciones intercompany');
    }

    const { tenantId } = await resolveTenantContext();
    const tenantBranchIds = new Set(await getTenantBranchIds(tenantId));
    if (!tenantBranchIds.has(data.fromBranchId) || !tenantBranchIds.has(data.toBranchId)) {
        throw new Error('Branches origen/destino no pertenecen a este tenant');
    }

    const count = await prisma.intercompanySettlement.count({
        where: { fromBranchId: { in: Array.from(tenantBranchIds) } },
    });
    const code  = `IC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const settlement = await prisma.intercompanySettlement.create({
        data: {
            code,
            ...data,
            createdById: session.id,
        },
    });

    revalidatePath('/dashboard/intercompany');
    return { ok: true, settlement };
}

export async function approveSettlement(id: string) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');
    if (!['OWNER', 'ADMIN_MANAGER'].includes(session.role)) {
        throw new Error('Sin permiso para aprobar liquidaciones');
    }

    const { tenantId } = await resolveTenantContext();
    const tenantBranchIds = await getTenantBranchIds(tenantId);
    if (tenantBranchIds.length === 0) throw new Error('Sin branches en tenant');

    const res = await prisma.intercompanySettlement.updateMany({
        where: { id, fromBranchId: { in: tenantBranchIds } },
        data: {
            status: 'APPROVED',
            approvedById: session.id,
            approvedAt: new Date(),
        },
    });
    if (res.count === 0) {
        throw new Error('Liquidación no encontrada');
    }

    const settlement = await prisma.intercompanySettlement.findFirst({
        where: { id, fromBranchId: { in: tenantBranchIds } },
        include: { lines: true },
    });

    revalidatePath('/dashboard/intercompany');
    return { ok: true, settlement };
}
