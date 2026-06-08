/**
 * PATCH /api/v1/delivery/ordenes/{id}
 *
 * Cambia el estado de una orden con validación de transiciones. Lo usa n8n
 * (la UI del dashboard usa server actions). Body: { estado, cancel_reason? }.
 *
 * Al pasar a EN_COCINA, el helper central encola la impresión de la comanda.
 *
 * Auth: X-API-Key (máquina). Requiere flag `deliveryOps`.
 */

import { NextResponse } from 'next/server';
import { authenticateDeliveryApi } from '@/lib/delivery/auth';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { withTenant } from '@/lib/prisma-tenant-client';
import { canTransition, isDeliveryState, type DeliveryState } from '@/lib/delivery/state-machine';
import { applyDeliveryTransition } from '@/lib/delivery/transition';

export const dynamic = 'force-dynamic';

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

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = authenticateDeliveryApi(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await tenantFeatureEnabled(auth.tenantId, 'deliveryOps'))) {
        return NextResponse.json({ error: 'delivery_ops disabled' }, { status: 403 });
    }

    let body: { estado?: string; cancel_reason?: string };
    try {
        body = (await req.json()) as { estado?: string; cancel_reason?: string };
    } catch {
        return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
    }

    const to = (body.estado ?? '').trim().toUpperCase();
    if (!isDeliveryState(to)) {
        return NextResponse.json({ error: `estado inválido: ${body.estado}` }, { status: 400 });
    }
    if (to === 'CANCELADA' && !body.cancel_reason?.trim()) {
        return NextResponse.json({ error: 'cancel_reason requerido para CANCELADA' }, { status: 400 });
    }

    const { id } = await params;
    const db = withTenant(auth.tenantId);
    const order = await db.deliveryOrder.findFirst({ where: { id }, select: ORDER_SELECT });
    if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

    const from = order.status;
    if (!isDeliveryState(from)) {
        return NextResponse.json({ error: `estado actual corrupto: ${from}` }, { status: 409 });
    }
    if (!canTransition(from, to)) {
        return NextResponse.json(
            { error: `transición no permitida: ${from} → ${to}` },
            { status: 409 },
        );
    }

    await applyDeliveryTransition({
        tenantId: auth.tenantId,
        order: {
            id: order.id,
            branchId: order.branchId,
            correlative: order.correlative,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            deliveryAddress: order.deliveryAddress,
            deliveryRef: order.deliveryRef,
            comanda: order.comanda,
            createdAt: order.createdAt.toISOString(),
        },
        from,
        to,
        cancelReason: to === 'CANCELADA' ? body.cancel_reason!.trim() : null,
    });

    return NextResponse.json({ orden_id: order.id, estado: to });
}
