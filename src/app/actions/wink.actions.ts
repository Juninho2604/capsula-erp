'use server';

import prisma from '@/server/db';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { getNextCorrelativo } from '@/lib/invoice-counter';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';
import { revalidatePath } from 'next/cache';

interface ActionResult {
    success: boolean;
    message?: string;
    data?: unknown;
}

export interface WinkItem {
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    modifiers: { modifierId: string; name: string; priceAdjustment: number }[];
    notes?: string;
    lineTotal: number;
}

export interface CreateWinkOrderData {
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    items: WinkItem[];
    notes?: string;
    externalOrderId?: string; // ID del pedido en WINK (si lo tienen)
}

async function generateWinkOrderNumber(): Promise<string> {
    return getNextCorrelativo('WINK');
}

/**
 * Registra una venta del canal WINK. Espejo de createPedidosYAOrderAction:
 * crea un SalesOrder PAGADO (WINK gestiona el cobro), descuenta inventario por
 * receta y deja el registro para reportes. orderType/sourceChannel = WINK para
 * que el Reporte Z / fin de día lo cuenten en `byType.wink`.
 */
export async function createWinkOrderAction(data: CreateWinkOrderData) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        let salesArea = await db.area.findFirst({ where: { name: { contains: 'Ventas' } } });
        if (!salesArea) salesArea = await db.area.findFirst();
        if (!salesArea) return { success: false, message: 'No hay área configurada' };

        const subtotal = data.items.reduce((s, i) => s + i.lineTotal, 0);
        const orderNumber = await generateWinkOrderNumber();

        const notes = [
            data.externalOrderId ? `WINK #${data.externalOrderId}` : '',
            data.notes || '',
        ].filter(Boolean).join(' | ') || 'WINK';

        const order = await db.salesOrder.create({
            data: {
                tenantId,
                orderNumber,
                orderType: 'WINK',
                customerName: data.customerName || 'WINK',
                customerPhone: data.customerPhone || null,
                customerAddress: data.customerAddress || null,
                status: 'CONFIRMED',
                serviceFlow: 'DIRECT_SALE',
                sourceChannel: 'POS_WINK',
                paymentStatus: 'PAID',
                paymentMethod: 'WINK',
                kitchenStatus: 'SENT',
                sentToKitchenAt: new Date(),
                subtotal,
                discount: 0,
                total: subtotal,
                amountPaid: subtotal,
                change: 0,
                notes,
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
                                modifierId: m.modifierId,
                                name: m.name,
                                priceAdjustment: m.priceAdjustment,
                            }))
                        },
                    }))
                }
            },
            include: { items: { include: { modifiers: true } } }
        });

        // Descargar inventario por recetas (igual que POS Delivery / PedidosYA)
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
                            notes: `WINK ${order.orderNumber}: ${item.quantity}x ${menuItem.name}`,
                            createdById: session.id,
                        }
                    });
                }
            }
        } catch (invErr) {
            console.error('Error al descargar inventario WINK:', invErr);
        }

        revalidatePath('/dashboard/sales');
        return { success: true, data: { orderNumber: order.orderNumber, id: order.id } };
    } catch (error) {
        console.error('Error creando orden WINK:', error);
        return { success: false, message: 'Error al registrar pedido' };
    }
}

/**
 * Actualiza el precio WINK de un producto. Solo gerentes (EDIT_WINK_PRICE).
 * `winkPrice = null` borra el override → el POS WINK vuelve a usar el precio base.
 */
export async function updateMenuItemWinkPriceAction(
    id: string,
    winkPrice: number | null,
): Promise<ActionResult> {
    const guard = await checkActionPermission(PERM.EDIT_WINK_PRICE);
    if (!guard.ok) return { success: false, message: guard.message };

    try {
        const { tenantId } = await resolveTenantContext();
        const value = winkPrice === null || Number.isNaN(winkPrice) ? null : Number(winkPrice);
        if (value !== null && value < 0) return { success: false, message: 'El precio no puede ser negativo' };

        const res = await withTenant(tenantId).menuItem.updateMany({
            where: { id },
            data: { winkPrice: value },
        });
        if (res.count === 0) return { success: false, message: 'Producto no encontrado' };

        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/pos/wink');
        return { success: true, message: 'Precio WINK actualizado' };
    } catch (error) {
        return { success: false, message: 'Error al actualizar precio WINK' };
    }
}

/** ¿El usuario actual puede editar precios WINK? (para gating de UI). */
export async function canEditWinkPriceAction(): Promise<boolean> {
    const guard = await checkActionPermission(PERM.EDIT_WINK_PRICE);
    return guard.ok;
}
