'use server';

import prisma from '@/server/db';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { getNextCorrelativo } from '@/lib/invoice-counter';
import { nextDailyNumber } from '@/lib/sales/daily-order-number';
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
    modifiers: { modifierId?: string | null; name: string; priceAdjustment: number; hideFromKitchen?: boolean; excludedIngredientItemId?: string }[];
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

        // §103: re-precio autoritativo — el server recomputa desde la BD del
        // canal y corrige cualquier lineTotal desfasado del cliente.
        const { subtotal } = await repriceChannelCart(db, data.items, mi => mi.winkPrice ?? mi.price);
        const orderNumber = await generateWinkOrderNumber();
        const daily = await nextDailyNumber(db, tenantId, 'WINK');

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

/**
 * §103 — Re-precio autoritativo del carrito de canal (Wink/PedidosYA).
 * El server deja de confiar en el lineTotal del cliente: recomputa cada
 * línea desde el precio de BD del canal (+ ajustes de modificadores reales)
 * y usa SUS valores. Devuelve los items corregidos y el subtotal. Los
 * pseudo-modificadores SIN (modifierId null) valen $0 por definición.
 */
async function repriceChannelCart(
    db: ReturnType<typeof withTenant>,
    items: Array<{ menuItemId: string; quantity: number; unitPrice: number; lineTotal: number; modifiers: Array<{ modifierId?: string | null; priceAdjustment: number }> }>,
    channelPriceOf: (mi: { price: number; winkPrice: number | null; pedidosYaPrice: number | null }) => number,
): Promise<{ subtotal: number; corrected: boolean }> {
    const ids = Array.from(new Set(items.map(i => i.menuItemId)));
    const modIds = Array.from(new Set(items.flatMap(i => i.modifiers.map(m => m.modifierId).filter((x): x is string => Boolean(x)))));
    const [menuItems, mods] = await Promise.all([
        db.menuItem.findMany({ where: { id: { in: ids } }, select: { id: true, price: true, winkPrice: true, pedidosYaPrice: true } }),
        modIds.length > 0
            ? db.menuModifier.findMany({ where: { id: { in: modIds } }, select: { id: true, priceAdjustment: true } })
            : Promise.resolve([] as Array<{ id: string; priceAdjustment: number }>),
    ]);
    const priceById = new Map(menuItems.map(mi => [mi.id, channelPriceOf(mi)]));
    const modById = new Map(mods.map(m => [m.id, m.priceAdjustment]));
    let subtotal = 0;
    let corrected = false;
    for (const item of items) {
        const base = priceById.get(item.menuItemId);
        if (base == null) { subtotal += item.lineTotal; continue; } // item desconocido: no inventar
        // Los modifiers del carrito vienen "explotados" POR UNIDAD (una
        // entrada por selección de una unidad) → su suma es el ajuste por
        // unidad, y la línea = (base + ajustesUnidad) × cantidad.
        const perUnitModSum = item.modifiers.reduce((s, m) => s + (m.modifierId ? (modById.get(m.modifierId) ?? m.priceAdjustment) : 0), 0);
        const unit = Math.round(base * 100) / 100;
        const line = Math.round((base + perUnitModSum) * item.quantity * 100) / 100;
        if (Math.abs(line - item.lineTotal) > 0.01) {
            console.warn(`[§103 reprice] item ${item.menuItemId}: cliente $${item.lineTotal.toFixed(2)} → server $${line.toFixed(2)}`);
            item.lineTotal = line;
            item.unitPrice = unit;
            corrected = true;
        }
        subtotal += item.lineTotal;
    }
    return { subtotal: Math.round(subtotal * 100) / 100, corrected };
}
