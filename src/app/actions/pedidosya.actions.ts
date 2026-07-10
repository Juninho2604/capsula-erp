'use server';

import prisma from '@/server/db';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { getNextCorrelativo } from '@/lib/invoice-counter';
import { nextDailyNumber } from '@/lib/sales/daily-order-number';
import { revalidatePath } from 'next/cache';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';

export interface PedidosYAItem {
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    modifiers: { modifierId?: string | null; name: string; priceAdjustment: number; hideFromKitchen?: boolean; excludedIngredientItemId?: string }[];
    notes?: string;
    lineTotal: number;
}

export interface CreatePedidosYAOrderData {
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    items: PedidosYAItem[];
    notes?: string;
    externalOrderId?: string; // ID del pedido en PedidosYA (si lo tienen)
}

async function generatePYAOrderNumber(): Promise<string> {
    return getNextCorrelativo('PEDIDOS_YA');
}

export async function createPedidosYAOrderAction(data: CreatePedidosYAOrderData) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        // Obtener área de ventas base
        let salesArea = await db.area.findFirst({ where: { name: { contains: 'Ventas' } } });
        if (!salesArea) salesArea = await db.area.findFirst();
        if (!salesArea) return { success: false, message: 'No hay área configurada' };

        const subtotal = data.items.reduce((s, i) => s + i.lineTotal, 0);
        const orderNumber = await generatePYAOrderNumber();
        const daily = await nextDailyNumber(db, tenantId, 'PEDIDOSYA');

        const notes = [
            data.externalOrderId ? `PedidosYA #${data.externalOrderId}` : '',
            data.notes || '',
        ].filter(Boolean).join(' | ') || 'PedidosYA';

        const order = await db.salesOrder.create({
            data: {
                tenantId,
                orderNumber,
                orderType: 'PEDIDOSYA',
                customerName: data.customerName || 'PedidosYA',
                customerPhone: data.customerPhone || null,
                customerAddress: data.customerAddress || null,
                status: 'CONFIRMED',
                serviceFlow: 'DIRECT_SALE',
                sourceChannel: 'POS_PEDIDOSYA',
                paymentStatus: 'PAID',
                paymentMethod: 'PY',
                kitchenStatus: 'SENT',
                sentToKitchenAt: new Date(),
                subtotal,
                discount: 0,
                total: subtotal,
                amountPaid: subtotal,
                change: 0,
                notes,
                dailyNumber: daily.dailyNumber,
                dailyLabel: daily.dailyLabel,
                createdById: session.id,
                areaId: salesArea.id,
                items: {
                    create: data.items.map(item => ({
                        tenantId,
                        menuItemId: item.menuItemId,
                        itemName: item.name,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        lineTotal: item.lineTotal,
                        modifiers: {
                            create: item.modifiers.map(m => ({
                                modifierId: m.modifierId ?? null,
                                name: m.name,
                                priceAdjustment: m.priceAdjustment,
                                excludedIngredientItemId: m.excludedIngredientItemId ?? null,
                                hideFromKitchen: m.hideFromKitchen ?? false,
                            }))
                        },
                    }))
                }
            },
            include: { items: { include: { modifiers: true } } }
        });

        // Descargar inventario por recetas (igual que POS Delivery)
        try {
            for (const item of order.items) {
                if (!item.menuItemId) continue;
                const menuItem = await db.menuItem.findUnique({
                    where: { id: item.menuItemId },
                    select: { recipeId: true, name: true }
                });
                if (!menuItem?.recipeId) continue;
                const recipe = await db.recipe.findUnique({
                    where: { id: menuItem.recipeId },
                    include: { ingredients: { include: { ingredientItem: true } } }
                });
                if (!recipe?.isActive) continue;
                for (const ingredient of recipe.ingredients) {
                    await prisma.inventoryMovement.create({
                        data: {
                            inventoryItemId: ingredient.ingredientItemId,
                            areaId: salesArea.id,
                            movementType: 'SALE',
                            quantity: -(ingredient.quantity * item.quantity),
                            unit: ingredient.unit,
                            notes: `PedidosYA ${order.orderNumber}: ${item.quantity}x ${menuItem.name}`,
                            createdById: session.id,
                        }
                    });
                }
            }
        } catch (invErr) {
            console.error('Error al descargar inventario PedidosYA:', invErr);
        }

        revalidatePath('/dashboard/sales');
        return { success: true, data: { orderNumber: order.orderNumber, id: order.id } };
    } catch (error) {
        console.error('Error creando orden PedidosYA:', error);
        return { success: false, message: 'Error al registrar pedido' };
    }
}


/**
 * Actualiza el precio PedidosYA de un producto (override manual). Mismo gate
 * gerencial que WINK (EDIT_WINK_PRICE — cubre precios de canal).
 * `pedidosYaPrice = null` borra el override → el POS PYA usa el precio del
 * restaurante (fallback §96).
 */
export async function updateMenuItemPedidosYaPriceAction(
    id: string,
    pedidosYaPrice: number | null,
): Promise<{ success: boolean; message: string }> {
    const guard = await checkActionPermission(PERM.EDIT_WINK_PRICE);
    if (!guard.ok) return { success: false, message: guard.message };

    try {
        const { tenantId } = await resolveTenantContext();
        const value = pedidosYaPrice === null || Number.isNaN(pedidosYaPrice) ? null : Number(pedidosYaPrice);
        if (value !== null && value < 0) return { success: false, message: 'El precio no puede ser negativo' };

        const res = await withTenant(tenantId).menuItem.updateMany({
            where: { id },
            data: { pedidosYaPrice: value },
        });
        if (res.count === 0) return { success: false, message: 'Producto no encontrado' };

        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/pos/pedidosya');
        return { success: true, message: 'Precio PedidosYA actualizado' };
    } catch {
        return { success: false, message: 'Error al actualizar precio PedidosYA' };
    }
}
