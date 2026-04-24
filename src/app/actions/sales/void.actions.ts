'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';

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
