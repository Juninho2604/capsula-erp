'use server';

/**
 * Server actions del módulo Gestión de Deliverys (lectura para el tablero).
 *
 * Aislado: NO toca SalesOrder / Report Z / inventario. Solo lee/transiciona
 * DeliveryOrder. La escritura desde el bot va por la API REST
 * (/api/v1/delivery/*); estas actions sirven a la UI del dashboard.
 */

import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { withTenant } from '@/lib/prisma-tenant-client';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { MODULE_ROLE_ACCESS } from '@/lib/constants/modules-registry';
import {
    canTransition,
    isDeliveryState,
    type DeliveryState,
} from '@/lib/delivery/state-machine';
import { revalidatePath } from 'next/cache';

const DELIVERY_ROLES = MODULE_ROLE_ACCESS['delivery'] ?? [];

export interface DeliveryOrderRow {
    id: string;
    correlative: string;
    status: string;
    channel: string;
    branchId: string | null;
    branchName: string | null;
    customerName: string | null;
    customerPhone: string | null;
    deliveryAddress: string | null;
    totalUsd: number | null;
    totalBs: number | null;
    paymentProofPath: string | null;
    createdAt: string;
}

interface ListResult {
    success: boolean;
    message?: string;
    orders: DeliveryOrderRow[];
    branches: { id: string; name: string }[];
}

async function guard(): Promise<
    { ok: true; tenantId: string } | { ok: false; message: string }
> {
    const session = await getSession();
    if (!session) return { ok: false, message: 'Sin sesión.' };
    if (!DELIVERY_ROLES.includes(session.role)) {
        return { ok: false, message: 'Sin permiso para el módulo de delivery.' };
    }
    const { tenantId } = await resolveTenantContext();
    if (!(await tenantFeatureEnabled(tenantId, 'deliveryOps'))) {
        return { ok: false, message: 'El módulo de delivery no está habilitado.' };
    }
    return { ok: true, tenantId };
}

export async function listDeliveryOrdersAction(opts?: {
    branchId?: string | null;
}): Promise<ListResult> {
    const g = await guard();
    if (!g.ok) return { success: false, message: g.message, orders: [], branches: [] };

    const db = withTenant(g.tenantId);

    const [orders, configs] = await Promise.all([
        db.deliveryOrder.findMany({
            where: opts?.branchId ? { branchId: opts.branchId } : {},
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: { branch: { select: { id: true, name: true } } },
        }),
        db.branchDeliveryConfig.findMany({
            where: { isActive: true },
            include: { branch: { select: { id: true, name: true, isActive: true } } },
        }),
    ]);

    return {
        success: true,
        orders: orders.map(o => ({
            id: o.id,
            correlative: o.correlative,
            status: o.status,
            channel: o.channel,
            branchId: o.branchId,
            branchName: o.branch?.name ?? null,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            deliveryAddress: o.deliveryAddress,
            totalUsd: o.totalUsd,
            totalBs: o.totalBs,
            paymentProofPath: o.paymentProofPath,
            createdAt: o.createdAt.toISOString(),
        })),
        branches: configs
            .filter(c => c.branch?.isActive)
            .map(c => ({ id: c.branch!.id, name: c.branch!.name })),
    };
}

/**
 * Cambia el estado de una orden desde la UI, validando la transición.
 * `cancelReason` es obligatorio si `to === 'CANCELADA'`.
 *
 * Fase 1: solo persiste la transición + evento de auditoría. Los efectos
 * laterales (encolar PrintJob al pasar a EN_COCINA, webhooks) llegan en
 * Fase 2/3.
 */
export async function transitionDeliveryOrderAction(
    orderId: string,
    to: string,
    cancelReason?: string,
): Promise<{ success: boolean; message?: string }> {
    const g = await guard();
    if (!g.ok) return { success: false, message: g.message };

    if (!isDeliveryState(to)) {
        return { success: false, message: `Estado inválido: ${to}` };
    }
    if (to === 'CANCELADA' && !cancelReason?.trim()) {
        return { success: false, message: 'La cancelación requiere un motivo.' };
    }

    const db = withTenant(g.tenantId);
    const order = await db.deliveryOrder.findFirst({
        where: { id: orderId },
        select: { id: true, status: true },
    });
    if (!order) return { success: false, message: 'Orden no encontrada.' };

    const from = order.status;
    if (!isDeliveryState(from)) {
        return { success: false, message: `Estado actual corrupto: ${from}` };
    }
    if (!canTransition(from as DeliveryState, to)) {
        return { success: false, message: `Transición no permitida: ${from} → ${to}` };
    }

    const session = await getSession();
    await db.deliveryOrder.update({
        where: { id: order.id },
        data: {
            status: to,
            ...(to === 'CANCELADA' ? { cancelReason: cancelReason!.trim() } : {}),
            events: {
                create: {
                    fromState: from,
                    toState: to,
                    userId: session?.id ?? null,
                    note: to === 'CANCELADA' ? cancelReason!.trim() : null,
                },
            },
        },
    });

    revalidatePath('/dashboard/delivery');
    return { success: true };
}
