'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';

export interface SalesFilter {
    startDate?: Date;
    endDate?: Date;
    orderType?: string;
}

export interface ZReportData {
    period: string;
    totalOrders: number;
    grossTotal: number;
    totalDiscounts: number;
    discountBreakdown: {
        divisas: number;
        cortesias: number;
        other: number;
    };
    netTotal: number;
    paymentBreakdown: {
        cash: number;
        card: number;
        transfer: number;
        mobile: number;
        zelle: number;
        other: number;
    };
    ordersByStatus: Record<string, number>;
}

export async function getSalesHistoryAction(limit = 100) {
    try {
        const orders = await prisma.salesOrder.findMany({
            take: limit * 3, // fetch more to allow grouping
            orderBy: { createdAt: 'desc' },
            include: {
                authorizedBy: { select: { firstName: true, lastName: true } },
                createdBy: { select: { firstName: true, lastName: true } },
                voidedBy: { select: { firstName: true, lastName: true } },
                openTab: { select: { tabCode: true, customerLabel: true, customerPhone: true, runningSubtotal: true, runningDiscount: true, runningTotal: true, paymentSplits: { select: { splitLabel: true } } } },
                items: {
                    include: {
                        modifiers: { select: { name: true, priceAdjustment: true } }
                    }
                }
            }
        });

        // Agrupar órdenes RESTAURANT por openTabId (misma mesa = una sola venta)
        const byTab = new Map<string | null, typeof orders>();
        for (const o of orders) {
            const key = o.orderType === 'RESTAURANT' && o.openTabId ? o.openTabId : null;
            if (key === null) {
                byTab.set(`single-${o.id}`, [o]);
            } else {
                const existing = byTab.get(key) || [];
                existing.push(o);
                byTab.set(key, existing);
            }
        }

        // Construir lista: una fila por mesa (consolidada) o por orden individual
        const result: any[] = [];
        const seenTabs = new Set<string>();
        for (const o of orders) {
            if (o.orderType === 'RESTAURANT' && o.openTabId && !seenTabs.has(o.openTabId)) {
                seenTabs.add(o.openTabId);
                const group = byTab.get(o.openTabId) || [o];
                const sorted = [...group].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                const first = sorted[0];
                const last = sorted[sorted.length - 1];
                const tab = first.openTab;
                const total = tab?.runningTotal ?? sorted.reduce((s, x) => s + x.total, 0);
                const subtotal = tab?.runningSubtotal ?? sorted.reduce((s, x) => s + x.subtotal, 0);
                const discount = tab?.runningDiscount ?? sorted.reduce((s, x) => s + x.discount, 0);
                const allItems = sorted.flatMap(x => (x.items || []).map((it: any) => ({
                    ...it,
                    itemName: it.itemName,
                    lineTotal: it.lineTotal,
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                    modifiers: (it.modifiers || []).map((m: any) => m.name)
                })));
                const splits = tab?.paymentSplits || [];
                const serviceFeeIncluded = splits.length > 0
                    ? splits.some((s: { splitLabel?: string }) => (s.splitLabel || '').includes('| +10% serv'))
                    : true;
                result.push({
                    id: `tab-${o.openTabId}`,
                    _consolidated: true,
                    orderType: 'RESTAURANT',
                    serviceFeeIncluded,
                    _orderIds: sorted.map(x => x.id),
                    orderNumber: tab?.tabCode || first.orderNumber,
                    orderNumbers: sorted.map(x => x.orderNumber),
                    createdAt: last.createdAt,
                    customerName: tab?.customerLabel || first.customerName,
                    customerPhone: tab?.customerPhone || first.customerPhone,
                    createdBy: first.createdBy,
                    paymentMethod: first.paymentMethod,
                    subtotal,
                    discount,
                    total,
                    items: allItems,
                    orders: sorted,
                    status: sorted.some(x => x.status === 'CANCELLED') ? 'CANCELLED' : first.status,
                    voidReason: sorted.find(x => x.voidReason)?.voidReason,
                    voidedAt: sorted.find(x => x.voidedAt)?.voidedAt,
                    voidedBy: sorted.find(x => x.voidedBy)?.voidedBy,
                });
            } else if (!o.openTabId || o.orderType !== 'RESTAURANT') {
                result.push({ ...o, _consolidated: false });
            }
        }
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return { success: true, data: result.slice(0, limit) };
    } catch (error) {
        console.error('Error fetching sales:', error);
        return { success: false, message: 'Error cargando historial' };
    }
}

export async function getDailyZReportAction(): Promise<{ success: boolean; data?: ZReportData; message?: string }> {
    try {
        const today = new Date();
        const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

        const todaysOrders = await prisma.salesOrder.findMany({
            where: {
                createdAt: { gte: startOfDay, lte: endOfDay },
                status: { not: 'CANCELLED' }
            }
        });

        let grossTotal = 0;
        let totalDiscounts = 0;
        let discountDivisas = 0;
        let discountCortesias = 0;
        let paymentCash = 0;
        let paymentCard = 0;
        let paymentTransfer = 0;
        let paymentMobile = 0;
        let paymentZelle = 0;

        for (const order of todaysOrders) {
            grossTotal += order.subtotal;
            totalDiscounts += order.discount;

            if (order.discountType === 'DIVISAS_33') discountDivisas += order.discount;
            else if (order.discountType === 'CORTESIA_100' || order.discountType === 'CORTESIA') discountCortesias += order.discount;

            const paid = order.total;
            const pm = order.paymentMethod?.toUpperCase() || 'UNKNOWN';

            if (pm === 'CASH' || pm === 'CASH_USD') paymentCash += paid;
            else if (pm === 'CARD' || pm === 'BS_POS') paymentCard += paid;
            else if (pm === 'TRANSFER' || pm === 'BANK_TRANSFER') paymentTransfer += paid;
            else if (pm === 'MOBILE_PAY' || pm === 'PAGO_MOVIL') paymentMobile += paid;
            else if (pm === 'ZELLE') paymentZelle += paid;
            else paymentMobile += paid;
        }

        const netTotal = grossTotal - totalDiscounts;

        return {
            success: true,
            data: {
                period: today.toLocaleDateString(),
                totalOrders: todaysOrders.length,
                grossTotal,
                totalDiscounts,
                discountBreakdown: {
                    divisas: discountDivisas,
                    cortesias: discountCortesias,
                    other: totalDiscounts - discountDivisas - discountCortesias
                },
                netTotal,
                paymentBreakdown: { cash: paymentCash, card: paymentCard, transfer: paymentTransfer, mobile: paymentMobile, zelle: paymentZelle, other: 0 },
                ordersByStatus: {}
            }
        };
    } catch (error) {
        console.error('Error generating Z report:', error);
        return { success: false, message: 'Error generando reporte Z' };
    }
}

// ============================================================================
// ANULACIÓN DE VENTA
// ============================================================================

export async function voidSalesOrderAction(params: {
    orderId: string;
    voidReason: string;
    authorizedById: string;
    authorizedByName: string;
}): Promise<{ success: boolean; message: string }> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        // 1. Obtener orden con items + modificadores
        const order = await prisma.salesOrder.findUnique({
            where: { id: params.orderId },
            include: {
                items: {
                    include: {
                        menuItem: { select: { recipeId: true, name: true } },
                        modifiers: { select: { modifierId: true, name: true } }
                    }
                }
            }
        });

        if (!order) return { success: false, message: 'Orden no encontrada' };
        if (order.status === 'CANCELLED') return { success: false, message: 'Esta orden ya está anulada' };

        // Helper: restaurar ingredientes de una receta al stock
        const restoreRecipe = async (recipeId: string, qty: number, label: string) => {
            const recipe = await prisma.recipe.findUnique({
                where: { id: recipeId },
                include: { ingredients: true }
            });
            if (!recipe || !recipe.isActive) return;

            for (const ingredient of recipe.ingredients) {
                const totalQty = ingredient.quantity * qty;
                await prisma.inventoryMovement.create({
                    data: {
                        inventoryItemId: ingredient.ingredientItemId,
                        movementType: 'ADJUSTMENT_IN',
                        quantity: totalQty,
                        unit: ingredient.unit as any,
                        notes: `Anulación ${order.orderNumber}: ${label}`,
                        reason: `Anulado por ${params.authorizedByName}: ${params.voidReason}`,
                        createdById: session.id,
                    }
                });
                await prisma.inventoryLocation.upsert({
                    where: { inventoryItemId_areaId: { inventoryItemId: ingredient.ingredientItemId, areaId: order.areaId } },
                    update: { currentStock: { increment: totalQty } },
                    create: { inventoryItemId: ingredient.ingredientItemId, areaId: order.areaId, currentStock: totalQty }
                });
            }
        };

        // 2. Revertir inventario (receta base + modificadores vinculados)
        try {
            for (const item of order.items) {
                // 2a. Receta base
                if (item.menuItem?.recipeId) {
                    await restoreRecipe(item.menuItem.recipeId, item.quantity, `${item.quantity}x ${item.menuItem.name}`);
                }

                // 2b. Modificadores vinculados (Nivel 2)
                for (const modifier of (item.modifiers || [])) {
                    if (!modifier.modifierId) continue;
                    const menuModifier = await prisma.menuModifier.findUnique({
                        where: { id: modifier.modifierId },
                        select: { linkedMenuItem: { select: { name: true, recipeId: true } } }
                    });
                    if (menuModifier?.linkedMenuItem?.recipeId) {
                        await restoreRecipe(
                            menuModifier.linkedMenuItem.recipeId,
                            item.quantity,
                            `modificador ${modifier.name} (${item.menuItem?.name})`
                        );
                    }
                }
            }
        } catch (invError) {
            console.error('Error revirtiendo inventario en anulación:', invError);
        }

        // 3. Marcar como CANCELLED con trazabilidad completa
        await prisma.salesOrder.update({
            where: { id: params.orderId },
            data: {
                status: 'CANCELLED',
                paymentStatus: 'REFUNDED',
                voidedAt: new Date(),
                voidedById: params.authorizedById !== 'demo-master-id' ? params.authorizedById : undefined,
                voidReason: `[${params.authorizedByName}] ${params.voidReason}`
            }
        });

        revalidatePath('/dashboard/sales');
        revalidatePath('/dashboard/inventory');

        return { success: true, message: `Orden ${order.orderNumber} anulada correctamente` };

    } catch (error) {
        console.error('Error anulando orden:', error);
        return { success: false, message: 'Error interno al anular la orden' };
    }
}
