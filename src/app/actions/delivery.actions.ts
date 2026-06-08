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
import { applyDeliveryTransition, type TransitionOrder } from '@/lib/delivery/transition';
import { revalidatePath } from 'next/cache';

// Campos de la orden necesarios para transicionar + imprimir la comanda.
const ORDER_SELECT = {
    id: true,
    status: true,
    branchId: true,
    correlative: true,
    customerName: true,
    customerPhone: true,
    deliveryAddress: true,
    deliveryRef: true,
    comanda: true,
    createdAt: true,
} as const;

type LoadedOrder = {
    id: string;
    status: string;
    branchId: string | null;
    correlative: string;
    customerName: string | null;
    customerPhone: string | null;
    deliveryAddress: string | null;
    deliveryRef: string | null;
    comanda: unknown;
    createdAt: Date;
};

function toTransitionOrder(o: LoadedOrder): TransitionOrder {
    return {
        id: o.id,
        branchId: o.branchId,
        correlative: o.correlative,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        deliveryAddress: o.deliveryAddress,
        deliveryRef: o.deliveryRef,
        comanda: o.comanda,
        createdAt: o.createdAt.toISOString(),
    };
}

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
    paymentProofType: string | null;
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
            paymentProofType: o.paymentProofType,
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
    const order = (await db.deliveryOrder.findFirst({
        where: { id: orderId },
        select: ORDER_SELECT,
    })) as LoadedOrder | null;
    if (!order) return { success: false, message: 'Orden no encontrada.' };

    const from = order.status;
    if (!isDeliveryState(from)) {
        return { success: false, message: `Estado actual corrupto: ${from}` };
    }
    if (!canTransition(from as DeliveryState, to)) {
        return { success: false, message: `Transición no permitida: ${from} → ${to}` };
    }

    const session = await getSession();
    await applyDeliveryTransition({
        tenantId: g.tenantId,
        order: toTransitionOrder(order),
        from: from as DeliveryState,
        to,
        userId: session?.id ?? null,
        cancelReason: to === 'CANCELADA' ? cancelReason!.trim() : null,
    });

    revalidatePath('/dashboard/delivery');
    return { success: true };
}

/**
 * Validación de pago 1-clic (PAGO_POR_VALIDAR → EN_COCINA). Atajo semántico
 * de `transitionDeliveryOrderAction` que deja claro el intent y, vía el helper
 * central, encola la impresión de la comanda en la sede asignada.
 *
 * Es la barrera antifraude: el supervisor confirma a ojo el comprobante antes
 * de mandar a cocina (el bot no puede verificar fotos).
 */
export async function validateDeliveryPaymentAction(
    orderId: string,
): Promise<{ success: boolean; message?: string }> {
    const g = await guard();
    if (!g.ok) return { success: false, message: g.message };

    const db = withTenant(g.tenantId);
    const order = (await db.deliveryOrder.findFirst({
        where: { id: orderId },
        select: ORDER_SELECT,
    })) as LoadedOrder | null;
    if (!order) return { success: false, message: 'Orden no encontrada.' };

    if (order.status !== 'PAGO_POR_VALIDAR') {
        return {
            success: false,
            message: `Solo se valida una orden en "pago por validar" (actual: ${order.status}).`,
        };
    }

    const session = await getSession();
    await applyDeliveryTransition({
        tenantId: g.tenantId,
        order: toTransitionOrder(order),
        from: 'PAGO_POR_VALIDAR',
        to: 'EN_COCINA',
        userId: session?.id ?? null,
        note: 'pago validado',
    });

    revalidatePath('/dashboard/delivery');
    return { success: true };
}
