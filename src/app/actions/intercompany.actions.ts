'use server';

/**
 * INTERCOMPANY ACTIONS
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestión de liquidaciones y trazabilidad entre negocios.
 *
 * TODO: Copiar la lógica de Table-Pong repo:
 *   src/app/actions/intercompany.actions.ts  (o equivalente en el repo origen)
 *
 * Funciones a implementar:
 *   getSettlements(filters)         — listar liquidaciones con paginación
 *   getSettlementById(id)           — detalle de una liquidación
 *   createSettlement(data)          — crear nueva liquidación
 *   addSettlementLine(settlementId, lineData)
 *   removeSettlementLine(lineId)
 *   submitSettlement(id)            — enviar a aprobación (DRAFT → PENDING_APPROVAL)
 *   approveSettlement(id)           — aprobar liquidación
 *   markSettlementPaid(id)          — registrar pago
 *   disputeSettlement(id, reason)   — marcar como disputada
 *
 *   getItemMappings()               — listar mapeos de items intercompany
 *   upsertItemMapping(data)         — crear o actualizar un mapeo
 *   deleteItemMapping(id)           — eliminar mapeo
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ─── Types ───────────────────────────────────────────────────────────────────

export type IntercompanySettlementWithLines = Awaited<
    ReturnType<typeof getSettlementById>
>;

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getSettlements(filters?: {
    status?: string;
    fromBranchId?: string;
    toBranchId?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    return prisma.intercompanySettlement.findMany({
        where: {
            deletedAt: null,
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

    return prisma.intercompanySettlement.findUnique({
        where: { id, deletedAt: null },
        include: { lines: true },
    });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

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

    const count = await prisma.intercompanySettlement.count();
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

    const settlement = await prisma.intercompanySettlement.update({
        where: { id },
        data: {
            status: 'APPROVED',
            approvedById: session.id,
            approvedAt: new Date(),
        },
    });

    revalidatePath('/dashboard/intercompany');
    return { ok: true, settlement };
}
