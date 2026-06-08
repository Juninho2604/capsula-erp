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
    driverId: string | null;
    driverName: string | null;
    createdAt: string;
}

export interface DeliveryDriverRow {
    id: string;
    name: string;
    phone: string;
    branchId: string | null;
    status: string;
    isActive: boolean;
}

interface ListResult {
    success: boolean;
    message?: string;
    orders: DeliveryOrderRow[];
    branches: { id: string; name: string }[];
    drivers: DeliveryDriverRow[];
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
    if (!g.ok) {
        return { success: false, message: g.message, orders: [], branches: [], drivers: [] };
    }

    const db = withTenant(g.tenantId);

    const [orders, configs, drivers] = await Promise.all([
        db.deliveryOrder.findMany({
            where: opts?.branchId ? { branchId: opts.branchId } : {},
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: {
                branch: { select: { id: true, name: true } },
                driver: { select: { id: true, name: true } },
            },
        }),
        db.branchDeliveryConfig.findMany({
            where: { isActive: true },
            include: { branch: { select: { id: true, name: true, isActive: true } } },
        }),
        db.deliveryDriver.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
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
            driverId: o.driverId,
            driverName: o.driver?.name ?? null,
            createdAt: o.createdAt.toISOString(),
        })),
        branches: configs
            .filter(c => c.branch?.isActive)
            .map(c => ({ id: c.branch!.id, name: c.branch!.name })),
        drivers: drivers.map(d => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            branchId: d.branchId,
            status: d.status,
            isActive: d.isActive,
        })),
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

// ─── Motorizados (Fase 3) ────────────────────────────────────────────────────

export async function listDeliveryDriversAction(): Promise<{
    success: boolean;
    message?: string;
    drivers: DeliveryDriverRow[];
    branches: { id: string; name: string }[];
}> {
    const g = await guard();
    if (!g.ok) return { success: false, message: g.message, drivers: [], branches: [] };

    const db = withTenant(g.tenantId);
    const [drivers, configs] = await Promise.all([
        db.deliveryDriver.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }),
        db.branchDeliveryConfig.findMany({
            where: { isActive: true },
            include: { branch: { select: { id: true, name: true, isActive: true } } },
        }),
    ]);
    return {
        success: true,
        drivers: drivers.map(d => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            branchId: d.branchId,
            status: d.status,
            isActive: d.isActive,
        })),
        branches: configs
            .filter(c => c.branch?.isActive)
            .map(c => ({ id: c.branch!.id, name: c.branch!.name })),
    };
}

export async function createDeliveryDriverAction(input: {
    name: string;
    phone: string;
    branchId?: string | null;
}): Promise<{ success: boolean; message?: string }> {
    const g = await guard();
    if (!g.ok) return { success: false, message: g.message };

    const name = input.name?.trim();
    const phone = input.phone?.trim();
    if (!name || !phone) return { success: false, message: 'Nombre y teléfono son obligatorios.' };

    const db = withTenant(g.tenantId);
    await db.deliveryDriver.create({
        data: { tenantId: g.tenantId, name, phone, branchId: input.branchId || null },
    });
    revalidatePath('/dashboard/delivery/motorizados');
    revalidatePath('/dashboard/delivery');
    return { success: true };
}

export async function updateDeliveryDriverAction(
    id: string,
    patch: { name?: string; phone?: string; branchId?: string | null; status?: string; isActive?: boolean },
): Promise<{ success: boolean; message?: string }> {
    const g = await guard();
    if (!g.ok) return { success: false, message: g.message };

    const db = withTenant(g.tenantId);
    // Ownership: findFirst está filtrado por tenant; update por id va después.
    const existing = await db.deliveryDriver.findFirst({ where: { id }, select: { id: true } });
    if (!existing) return { success: false, message: 'Motorizado no encontrado.' };

    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) data.name = patch.name.trim();
    if (patch.phone !== undefined) data.phone = patch.phone.trim();
    if (patch.branchId !== undefined) data.branchId = patch.branchId || null;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.isActive !== undefined) data.isActive = patch.isActive;

    await db.deliveryDriver.update({ where: { id }, data });
    revalidatePath('/dashboard/delivery/motorizados');
    revalidatePath('/dashboard/delivery');
    return { success: true };
}

/**
 * Asigna un motorizado a una orden LISTA → EN_CAMINO (en un solo update
 * guardado, vía el helper central que además emite el webhook orden.en_camino).
 * Marca al motorizado ON_ROUTE.
 */
export async function assignDriverAction(
    orderId: string,
    driverId: string,
): Promise<{ success: boolean; message?: string }> {
    const g = await guard();
    if (!g.ok) return { success: false, message: g.message };

    const db = withTenant(g.tenantId);
    const [order, driver] = await Promise.all([
        db.deliveryOrder.findFirst({ where: { id: orderId }, select: ORDER_SELECT }) as Promise<LoadedOrder | null>,
        db.deliveryDriver.findFirst({ where: { id: driverId }, select: { id: true, isActive: true } }),
    ]);
    if (!order) return { success: false, message: 'Orden no encontrada.' };
    if (!driver || !driver.isActive) return { success: false, message: 'Motorizado no disponible.' };

    if (!isDeliveryState(order.status) || !canTransition(order.status as DeliveryState, 'EN_CAMINO')) {
        return {
            success: false,
            message: `Solo se asigna motorizado a una orden "lista" (actual: ${order.status}).`,
        };
    }

    const session = await getSession();
    const applied = await applyDeliveryTransition({
        tenantId: g.tenantId,
        order: toTransitionOrder(order),
        from: order.status as DeliveryState,
        to: 'EN_CAMINO',
        userId: session?.id ?? null,
        note: 'motorizado asignado',
        extraData: { driverId, assignedAt: new Date() },
    });
    if (applied) {
        await db.deliveryDriver.update({ where: { id: driverId }, data: { status: 'ON_ROUTE' } });
    }

    revalidatePath('/dashboard/delivery');
    return { success: true };
}
