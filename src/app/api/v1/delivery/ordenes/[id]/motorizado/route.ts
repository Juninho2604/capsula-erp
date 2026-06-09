/**
 * POST /api/v1/delivery/ordenes/{id}/motorizado
 *
 * Asigna un motorizado a la orden → estado EN_CAMINO. Lo llama n8n cuando el
 * primer motorizado responde "YO" en el grupo de WhatsApp (workflow #2).
 *
 * Body: { motorizado_id }. El helper central emite el webhook orden.en_camino.
 *
 * Auth: X-API-Key (máquina). Requiere flag `deliveryOps`.
 */

import { NextResponse } from 'next/server';
import prisma from '@/server/db';
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

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = authenticateDeliveryApi(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await tenantFeatureEnabled(auth.tenantId, 'deliveryOps'))) {
        return NextResponse.json({ error: 'delivery_ops disabled' }, { status: 403 });
    }

    let body: { motorizado_id?: string };
    try {
        body = (await req.json()) as { motorizado_id?: string };
    } catch {
        return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
    }
    const driverId = (body.motorizado_id ?? '').trim();
    if (!driverId) return NextResponse.json({ error: 'Falta motorizado_id' }, { status: 400 });

    const { id } = await params;
    const db = withTenant(auth.tenantId);
    const [order, driver] = await Promise.all([
        db.deliveryOrder.findFirst({ where: { id }, select: ORDER_SELECT }),
        db.deliveryDriver.findFirst({
            where: { id: driverId },
            select: { id: true, name: true, phone: true, isActive: true },
        }),
    ]);
    if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    if (!driver || !driver.isActive) {
        return NextResponse.json({ error: 'Motorizado no disponible' }, { status: 404 });
    }

    if (!isDeliveryState(order.status) || !canTransition(order.status, 'EN_CAMINO')) {
        return NextResponse.json(
            { error: `No se puede asignar motorizado en estado ${order.status}` },
            { status: 409 },
        );
    }

    const applied = await applyDeliveryTransition({
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
        from: order.status as DeliveryState,
        to: 'EN_CAMINO',
        note: 'motorizado asignado (n8n)',
        extraData: { driverId, assignedAt: new Date() },
    });
    if (applied) {
        await prisma.deliveryDriver.update({ where: { id: driverId }, data: { status: 'ON_ROUTE' } });
    }

    return NextResponse.json({
        orden_id: order.id,
        estado: 'EN_CAMINO',
        motorizado: { id: driver.id, nombre: driver.name, telefono: driver.phone },
    });
}
