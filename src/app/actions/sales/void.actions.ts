'use server';

/**
 * Anular orden de venta — multitenant (Lote 5.a — Fase 3 Paso D.b).
 *
 * Modelos tenant-aware: SalesOrder, Recipe, MenuModifier.
 * Modelos NO tenant-aware (FK-scoped): InventoryMovement, InventoryLocation.
 *
 * El orderId entra del cliente → validamos ownership con db.findFirst.
 * Las ops de inventario heredan tenant scope vía inventoryItemId/areaId
 * que vienen del propio order (ya validado).
 */

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { expandDirectDischarge } from '@/lib/inventory/direct-discharge';
import { loadDirectDischargeMap } from '@/lib/inventory/direct-discharge-loader';

export async function voidSalesOrderAction(params: {
    orderId: string;
    voidReason: string;
    authorizedById: string;
    authorizedByName: string;
}): Promise<{ success: boolean; message: string }> {
    const guard = await checkActionPermission(PERM.VOID_ORDER);
    if (!guard.ok) return { success: false, message: guard.message };

    try {
        const { user } = guard;
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        // findUnique → findFirst con tenant filter
        const order = await db.salesOrder.findFirst({
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

        const restoreRecipe = async (recipeId: string, qty: number, label: string) => {
            const recipe = await db.recipe.findFirst({
                where: { id: recipeId },
                include: { ingredients: true }
            });
            if (!recipe || !recipe.isActive) return;

            // §124 — reversión debe espejar el descargo: expandir sub-recetas de
            // descarga directa en sus materias primas. Mapa vacío → no-op.
            const directMap = await loadDirectDischargeMap(
                db,
                recipe.ingredients.map(i => i.ingredientItemId),
            );
            const restoreIngredients = expandDirectDischarge(
                recipe.ingredients.map(i => ({ ingredientItemId: i.ingredientItemId, quantity: i.quantity, unit: i.unit })),
                directMap,
            );

            for (const ingredient of restoreIngredients) {
                const totalQty = ingredient.quantity * qty;
                await prisma.inventoryMovement.create({
                    data: {
                        inventoryItemId: ingredient.ingredientItemId,
                        movementType: 'ADJUSTMENT_IN',
                        quantity: totalQty,
                        unit: ingredient.unit as any,
                        notes: `Anulación ${order.orderNumber}: ${label}`,
                        reason: `Anulado por ${params.authorizedByName}: ${params.voidReason}`,
                        createdById: user.id,
                    }
                });
                await prisma.inventoryLocation.upsert({
                    where: { inventoryItemId_areaId: { inventoryItemId: ingredient.ingredientItemId, areaId: order.areaId } },
                    update: { currentStock: { increment: totalQty } },
                    create: { inventoryItemId: ingredient.ingredientItemId, areaId: order.areaId, currentStock: totalQty }
                });
            }
        };

        try {
            for (const item of order.items) {
                if (item.menuItem?.recipeId) {
                    await restoreRecipe(item.menuItem.recipeId, item.quantity, `${item.quantity}x ${item.menuItem.name}`);
                }

                for (const modifier of (item.modifiers || [])) {
                    if (!modifier.modifierId) continue;
                    const menuModifier = await db.menuModifier.findFirst({
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

        await db.salesOrder.updateMany({
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
