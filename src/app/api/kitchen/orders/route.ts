import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { withTenant } from '@/lib/prisma-tenant-client';
import { prisma } from '@/lib/prisma';
import { filterKitchenModifiers } from '@/lib/print/kitchen-modifiers';

export const dynamic = 'force-dynamic';

// Categorías que van a BARRA (solo Bebidas)
const BAR_CATEGORIES = ['Bebidas'];

// GET: Obtener órdenes pendientes para cocina o barra
// ?station=kitchen (default) → excluye Bebidas
// ?station=bar              → solo Bebidas
//
// CRÍTICO: requiere sesión activa y filtra por tenant del usuario. Antes
// retornaba órdenes de TODOS los tenants sin auth — IDOR cross-tenant.
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const { searchParams } = new URL(request.url);
        const station = searchParams.get('station') ?? 'kitchen'; // 'kitchen' | 'bar'
        const isBar = station === 'bar';

        const orders = await db.salesOrder.findMany({
            where: {
                status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] },
                kitchenStatus: 'SENT',
                createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                // §104: pedidos FUTUROS aparecen en el display (y su
                // auto-impresión) recién al llegar su hora — igual que la
                // comanda física diferida.
                OR: [
                    { scheduledDeliveryTime: null },
                    { scheduledDeliveryTime: { lte: new Date() } },
                ],
            },
            include: {
                items: {
                    include: {
                        menuItem: { include: { category: true } },
                        // §90/§93: la relación `modifier` trae childGroupId/groupId
                        // para ocultar el PADRE de un sub-grupo anidado (ej. la
                        // ración "Pincho Mixto") — cocina ve solo las varas.
                        modifiers: { include: { modifier: { select: { groupId: true, childGroupId: true } } } }
                    }
                },
                tableOrStation: true
            },
            orderBy: { createdAt: 'asc' }
        });

        const formattedOrders = orders
            .map(order => {
                // Filtrar items por estación
                const stationItems = order.items.filter(item => {
                    const catName = item.menuItem?.category?.name ?? '';
                    const isBeverage = BAR_CATEGORIES.includes(catName);
                    return isBar ? isBeverage : !isBeverage;
                });

                if (stationItems.length === 0) return null; // orden sin items para esta estación

                return {
                    id: order.id,
                    orderNumber: order.orderNumber,
                    orderType: order.orderType,
                    customerName: order.customerName,
                    tableName: order.tableOrStation?.name ?? null,
                    status: order.status,
                    createdAt: order.createdAt.toISOString(),
                    items: stationItems.map(item => ({
                        name: item.menuItem?.name || item.itemName || 'Item',
                        quantity: item.quantity,
                        // §93: sin el padre del sub-grupo — solo la selección definitiva
                        modifiers: filterKitchenModifiers(item.modifiers).map(mod => ({ name: mod.name })),
                        notes: item.notes
                    }))
                };
            })
            .filter(Boolean);

        return NextResponse.json({ orders: formattedOrders });
    } catch (error) {
        console.error('Error fetching kitchen orders:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// PATCH: Actualizar estado de orden — solo del tenant del usuario.
export async function PATCH(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const { tenantId } = await resolveTenantContext();

        const body = await request.json();
        const { orderId, status } = body;

        if (!orderId || !status) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        // Validar ownership: la orden debe pertenecer al tenant del session.
        // updateMany con filtro de tenant evita IDOR cross-tenant.
        // Al marcar READY se estampa kitchenReadyAt (tiempos de cocina —
        // Reportes FASE B).
        const result = await prisma.salesOrder.updateMany({
            where: { id: orderId, tenantId },
            data: {
                status,
                ...(status === 'READY' ? { kitchenReadyAt: new Date() } : {}),
            },
        });

        if (result.count === 0) {
            return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating order:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
