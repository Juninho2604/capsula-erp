'use server';

/**
 * Producción — multitenant (Lote 4.d — Fase 3 Paso D.b).
 *
 * Modelos tenant-aware: Recipe, InventoryItem, Area, ProductionOrder.
 * Modelos NO tenant-aware (FK-scoped): InventoryLocation, InventoryMovement.
 *
 * Validaciones nuevas:
 *   - calculateRequirementsAction: ownership de recipeId y areaId.
 *   - quickProductionAction: ownership de recipeId y areaId antes de la tx.
 *   - manualProductionAction: ownership de outputItemId, areaId y todos los
 *     ingredient itemIds antes de la tx.
 *   - updateProductionOrderAction / deleteProductionOrderAction: update →
 *     updateMany con tenant filter.
 */

import { revalidatePath } from 'next/cache';
import { prisma } from '@/server/db';
import { getSession } from '@/lib/auth';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

// ============================================================================
// TIPOS
// ============================================================================

export interface QuickProductionFormData {
    recipeId: string;
    actualQuantity: number;
    areaId: string;
    notes?: string;
}

export interface ProductionActionResult {
    success: boolean;
    message: string;
    data?: {
        orderNumber?: string;
        productAdded?: { name: string; quantity: number; unit: string };
        ingredientsConsumed?: { name: string; quantity: number; unit: string }[];
        actualYield?: number;
    };
}

export interface IngredientRequirement {
    itemId: string;
    itemName: string;
    required: number;
    gross: number;
    unit: string;
    available: number;
    sufficient: boolean;
}

// ============================================================================
// ACTION: OBTENER RECETAS DISPONIBLES PARA PRODUCCIÓN
// ============================================================================

export async function getProductionRecipesAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const recipes = await db.recipe.findMany({
            where: { isActive: true },
            include: {
                outputItem: {
                    select: { name: true, type: true, baseUnit: true }
                },
                ingredients: true
            },
            orderBy: { name: 'asc' }
        });

        return recipes.map(recipe => ({
            id: recipe.id,
            name: recipe.name,
            outputItemId: recipe.outputItemId,
            outputItemName: recipe.outputItem.name,
            outputItemType: recipe.outputItem.type,
            outputQuantity: Number(recipe.outputQuantity),
            outputUnit: recipe.outputUnit,
            yieldPercentage: Number(recipe.yieldPercentage),
            ingredientCount: recipe.ingredients.length,
        }));
    } catch (error) {
        console.error('Error fetching recipes:', error);
        return [];
    }
}

// ============================================================================
// ACTION: CALCULAR REQUERIMIENTOS DE INGREDIENTES
// ============================================================================

export async function calculateRequirementsAction(
    recipeId: string,
    quantity: number,
    areaId: string
): Promise<{ success: boolean; requirements: IngredientRequirement[] }> {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        // findUnique no se filtra por la extension; findFirst sí.
        const recipe = await db.recipe.findFirst({
            where: { id: recipeId },
            include: {
                ingredients: {
                    include: {
                        ingredientItem: {
                            include: {
                                stockLevels: {
                                    where: { areaId }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!recipe) {
            return { success: false, requirements: [] };
        }

        const scaleFactor = quantity / Number(recipe.outputQuantity);

        const requirements: IngredientRequirement[] = recipe.ingredients.map(ing => {
            const required = Number(ing.quantity) * scaleFactor;
            const wastePercent = Number(ing.wastePercentage) || 0;
            const gross = wastePercent < 100
                ? required / (1 - wastePercent / 100)
                : required;

            // Stock disponible en el área especificada
            const stockLevel = ing.ingredientItem.stockLevels[0];
            const available = stockLevel ? Number(stockLevel.currentStock) : 0;

            return {
                itemId: ing.ingredientItemId,
                itemName: ing.ingredientItem.name,
                required: parseFloat(required.toFixed(4)),
                gross: parseFloat(gross.toFixed(4)),
                unit: ing.unit,
                available: parseFloat(available.toFixed(3)),
                sufficient: available >= gross,
            };
        });

        return { success: true, requirements };
    } catch (error) {
        console.error('Error calculating requirements:', error);
        return { success: false, requirements: [] };
    }
}

// ============================================================================
// ACTION: PRODUCCIÓN RÁPIDA (REAL - CONECTADO A BD)
// ============================================================================

export async function quickProductionAction(
    formData: QuickProductionFormData
): Promise<ProductionActionResult> {
    try {
        const session = await getSession();
        if (!session?.id) {
            return { success: false, message: 'No autorizado' };
        }
        const userId = session.id;

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        // Validar ownership de areaId (recipeId se valida implícitamente vía
        // findFirst abajo).
        const ownedArea = await db.area.findFirst({
            where: { id: formData.areaId },
            select: { id: true },
        });
        if (!ownedArea) {
            return { success: false, message: 'Área no encontrada' };
        }

        // 1. Obtener receta con ingredientes (tenant-scoped)
        const recipe = await db.recipe.findFirst({
            where: { id: formData.recipeId },
            include: {
                outputItem: true,
                ingredients: {
                    include: {
                        ingredientItem: {
                            include: {
                                stockLevels: {
                                    where: { areaId: formData.areaId }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!recipe) {
            return { success: false, message: 'Receta no encontrada' };
        }

        const scaleFactor = formData.actualQuantity / Number(recipe.outputQuantity);

        // 2. Verificar stock disponible
        const ingredientsToConsume: { itemId: string; name: string; quantity: number; unit: string; stockLevelId: string }[] = [];
        const stockErrors: string[] = [];

        for (const ing of recipe.ingredients) {
            const required = Number(ing.quantity) * scaleFactor;
            const wastePercent = Number(ing.wastePercentage) || 0;
            const grossQty = wastePercent < 100
                ? required / (1 - wastePercent / 100)
                : required;

            const stockLevel = ing.ingredientItem.stockLevels[0];
            const currentStock = stockLevel ? Number(stockLevel.currentStock) : 0;

            if (currentStock < grossQty) {
                stockErrors.push(`${ing.ingredientItem.name}: necesario ${grossQty.toFixed(3)}, disponible ${currentStock.toFixed(3)}`);
            } else if (stockLevel) {
                ingredientsToConsume.push({
                    itemId: ing.ingredientItemId,
                    name: ing.ingredientItem.name,
                    quantity: parseFloat(grossQty.toFixed(4)),
                    unit: ing.unit,
                    stockLevelId: stockLevel.id
                });
            }
        }

        if (stockErrors.length > 0) {
            return {
                success: false,
                message: `Stock insuficiente:\n${stockErrors.join('\n')}`,
            };
        }

        // 3. Generar número de orden
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const count = await db.productionOrder.count({
            where: {
                createdAt: {
                    gte: new Date(today.setHours(0, 0, 0, 0))
                }
            }
        });
        const orderNumber = `PROD-${dateStr}-${String(count + 1).padStart(4, '0')}`;

        // 4. Ejecutar transacción. Mezcla:
        //   - ProductionOrder (tenant-aware) → usamos db extendido
        //   - InventoryLocation / InventoryMovement (NO tenant-aware) → prisma raw
        const result = await db.$transaction(async (tx) => {
            // 4a. Crear orden de producción
            const productionOrder = await tx.productionOrder.create({
                data: {
                    tenantId,
                    orderNumber,
                    recipeId: formData.recipeId,
                    outputItemId: recipe.outputItemId,
                    plannedQuantity: formData.actualQuantity,
                    actualQuantity: formData.actualQuantity,
                    unit: recipe.outputUnit,
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    notes: formData.notes,
                    createdById: userId,
                    actualYieldPercentage: Number(recipe.yieldPercentage),
                }
            });

            // 4b. Descontar ingredientes del área de producción
            for (const ing of ingredientsToConsume) {
                await tx.inventoryLocation.update({
                    where: { id: ing.stockLevelId },
                    data: {
                        currentStock: { decrement: ing.quantity }
                    }
                });

                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: ing.itemId,
                        movementType: 'PRODUCTION_OUT',
                        quantity: -ing.quantity,
                        unit: ing.unit,
                        reason: `Producción: ${recipe.name}`,
                        notes: `Orden: ${orderNumber}`,
                        createdById: userId,
                    }
                });
            }

            // 4c. Sumar producto terminado al área de producción
            let outputStock = await tx.inventoryLocation.findUnique({
                where: {
                    inventoryItemId_areaId: {
                        inventoryItemId: recipe.outputItemId,
                        areaId: formData.areaId
                    }
                }
            });

            if (outputStock) {
                await tx.inventoryLocation.update({
                    where: { id: outputStock.id },
                    data: {
                        currentStock: { increment: formData.actualQuantity }
                    }
                });
            } else {
                await tx.inventoryLocation.create({
                    data: {
                        inventoryItemId: recipe.outputItemId,
                        areaId: formData.areaId,
                        currentStock: formData.actualQuantity
                    }
                });
            }

            // Movimiento de entrada (producción)
            await tx.inventoryMovement.create({
                data: {
                    inventoryItemId: recipe.outputItemId,
                    movementType: 'PRODUCTION_IN',
                    quantity: formData.actualQuantity,
                    unit: recipe.outputUnit,
                    reason: `Producción: ${recipe.name}`,
                    notes: `Orden: ${orderNumber}`,
                    createdById: userId,
                }
            });

            return productionOrder;
        });

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/inventario');
        revalidatePath('/dashboard/produccion');

        return {
            success: true,
            message: `¡Producción completada! Orden: ${result.orderNumber}`,
            data: {
                orderNumber: result.orderNumber,
                productAdded: {
                    name: recipe.outputItem.name,
                    quantity: formData.actualQuantity,
                    unit: recipe.outputUnit,
                },
                ingredientsConsumed: ingredientsToConsume.map(i => ({
                    name: i.name,
                    quantity: i.quantity,
                    unit: i.unit
                })),
                actualYield: Number(recipe.yieldPercentage),
            },
        };

    } catch (error) {
        console.error('Error en quickProductionAction:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error al registrar producción',
        };
    }
}

// ============================================================================
// ACTION: OBTENER HISTORIAL DE PRODUCCIONES
// ============================================================================

export async function getProductionHistoryAction(filters?: {
    limit?: number;
    status?: string;
}) {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const orders = await db.productionOrder.findMany({
            where: filters?.status ? { status: filters.status } : {},
            take: filters?.limit || 50,
            orderBy: { createdAt: 'desc' },
            include: {
                recipe: {
                    select: { name: true }
                },
                createdBy: {
                    select: { firstName: true, lastName: true }
                }
            }
        });

        return orders.map(order => ({
            id: order.id,
            orderNumber: order.orderNumber,
            recipeName: order.recipe.name,
            plannedQuantity: Number(order.plannedQuantity),
            actualQuantity: order.actualQuantity ? Number(order.actualQuantity) : null,
            unit: order.unit,
            status: order.status,
            createdBy: `${order.createdBy.firstName} ${order.createdBy.lastName}`,
            createdAt: order.createdAt,
            completedAt: order.completedAt,
            notes: order.notes,
        }));
    } catch (error) {
        console.error('Error fetching production history:', error);
        return [];
    }
}

// ============================================================================
// ACTION: OBTENER ÁREAS DISPONIBLES PARA PRODUCCIÓN
// ============================================================================

export async function getProductionAreasAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const areas = await db.area.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        return areas;
    } catch (error) {
        console.error('Error fetching areas:', error);
        return [];
    }
}

// ============================================================================
// ACTION: OBTENER ITEMS DE INVENTARIO PARA PRODUCCIÓN MANUAL
// ============================================================================

export async function getProductionItemsAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const items = await db.inventoryItem.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                type: true,
                baseUnit: true,
                category: true,
            },
            orderBy: { name: 'asc' }
        });
        return items;
    } catch (error) {
        console.error('Error fetching items:', error);
        return [];
    }
}

// ============================================================================
// ACTION: PRODUCCIÓN MANUAL (SIN RECETA)
// ============================================================================

export interface ManualProductionFormData {
    outputItemId: string;
    outputQuantity: number;
    outputUnit: string;
    areaId: string;
    ingredients: {
        itemId: string;
        quantity: number;
        unit: string;
    }[];
    notes?: string;
}

export async function manualProductionAction(
    formData: ManualProductionFormData
): Promise<ProductionActionResult> {
    try {
        const session = await getSession();
        if (!session?.id) {
            return { success: false, message: 'No autorizado' };
        }
        const userId = session.id;

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        // Validar ownership de areaId
        const ownedArea = await db.area.findFirst({
            where: { id: formData.areaId },
            select: { id: true },
        });
        if (!ownedArea) {
            return { success: false, message: 'Área no encontrada' };
        }

        // Obtener info del producto de salida (tenant-scoped)
        const outputItem = await db.inventoryItem.findFirst({
            where: { id: formData.outputItemId }
        });
        if (!outputItem) {
            return { success: false, message: 'Producto de salida no encontrado' };
        }

        // Verificar stock de ingredientes
        const ingredientsToConsume: { itemId: string; name: string; quantity: number; unit: string; stockLevelId: string }[] = [];
        const stockErrors: string[] = [];

        for (const ing of formData.ingredients) {
            // findFirst con tenant filter (el item debe pertenecer al tenant)
            const item = await db.inventoryItem.findFirst({
                where: { id: ing.itemId },
                include: {
                    stockLevels: {
                        where: { areaId: formData.areaId }
                    }
                }
            });

            if (!item) {
                stockErrors.push(`Item no encontrado: ${ing.itemId}`);
                continue;
            }

            const stockLevel = item.stockLevels[0];
            const currentStock = stockLevel ? Number(stockLevel.currentStock) : 0;

            if (currentStock < ing.quantity) {
                stockErrors.push(`${item.name}: necesario ${ing.quantity.toFixed(3)}, disponible ${currentStock.toFixed(3)}`);
            } else if (stockLevel) {
                ingredientsToConsume.push({
                    itemId: ing.itemId,
                    name: item.name,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    stockLevelId: stockLevel.id
                });
            } else {
                stockErrors.push(`${item.name}: no tiene stock en esta área`);
            }
        }

        if (stockErrors.length > 0) {
            return {
                success: false,
                message: `Stock insuficiente:\n${stockErrors.join('\n')}`,
            };
        }

        // Generar número de orden
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const count = await db.productionOrder.count({
            where: {
                createdAt: {
                    gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
                }
            }
        });
        const orderNumber = `PROD-${dateStr}-${String(count + 1).padStart(4, '0')}`;

        // Buscar o crear una receta temporal para esta producción manual
        let recipeId: string;
        const existingRecipe = await db.recipe.findFirst({
            where: { outputItemId: formData.outputItemId, isActive: true }
        });

        if (existingRecipe) {
            recipeId = existingRecipe.id;
        } else {
            const newRecipe = await db.recipe.create({
                data: {
                    tenantId,
                    name: `Producción manual: ${outputItem.name}`,
                    outputItemId: formData.outputItemId,
                    outputQuantity: formData.outputQuantity,
                    outputUnit: formData.outputUnit,
                    yieldPercentage: 100,
                    isApproved: true,
                    isActive: true,
                    createdById: userId,
                }
            });
            recipeId = newRecipe.id;
        }

        // Ejecutar transacción
        const result = await db.$transaction(async (tx) => {
            const productionOrder = await tx.productionOrder.create({
                data: {
                    tenantId,
                    orderNumber,
                    recipeId,
                    outputItemId: formData.outputItemId,
                    plannedQuantity: formData.outputQuantity,
                    actualQuantity: formData.outputQuantity,
                    unit: formData.outputUnit,
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    notes: formData.notes || `Producción manual`,
                    createdById: userId,
                    actualYieldPercentage: 100,
                }
            });

            // Descontar ingredientes
            for (const ing of ingredientsToConsume) {
                await tx.inventoryLocation.update({
                    where: { id: ing.stockLevelId },
                    data: { currentStock: { decrement: ing.quantity } }
                });

                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: ing.itemId,
                        movementType: 'PRODUCTION_OUT',
                        quantity: -ing.quantity,
                        unit: ing.unit,
                        reason: `Producción manual: ${outputItem.name}`,
                        notes: `Orden: ${orderNumber}`,
                        createdById: userId,
                    }
                });
            }

            // Sumar producto terminado
            let outputStock = await tx.inventoryLocation.findUnique({
                where: {
                    inventoryItemId_areaId: {
                        inventoryItemId: formData.outputItemId,
                        areaId: formData.areaId
                    }
                }
            });

            if (outputStock) {
                await tx.inventoryLocation.update({
                    where: { id: outputStock.id },
                    data: { currentStock: { increment: formData.outputQuantity } }
                });
            } else {
                await tx.inventoryLocation.create({
                    data: {
                        inventoryItemId: formData.outputItemId,
                        areaId: formData.areaId,
                        currentStock: formData.outputQuantity
                    }
                });
            }

            // Movimiento de entrada
            await tx.inventoryMovement.create({
                data: {
                    inventoryItemId: formData.outputItemId,
                    movementType: 'PRODUCTION_IN',
                    quantity: formData.outputQuantity,
                    unit: formData.outputUnit,
                    reason: `Producción manual: ${outputItem.name}`,
                    notes: `Orden: ${orderNumber}`,
                    createdById: userId,
                }
            });

            return productionOrder;
        });

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/inventario');
        revalidatePath('/dashboard/produccion');

        return {
            success: true,
            message: `¡Producción manual completada! Orden: ${result.orderNumber}`,
            data: {
                orderNumber: result.orderNumber,
                productAdded: {
                    name: outputItem.name,
                    quantity: formData.outputQuantity,
                    unit: formData.outputUnit,
                },
                ingredientsConsumed: ingredientsToConsume.map(i => ({
                    name: i.name,
                    quantity: i.quantity,
                    unit: i.unit
                })),
            },
        };
    } catch (error) {
        console.error('Error en manualProductionAction:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error al registrar producción manual',
        };
    }
}

// ============================================================================
// ACTION: EDITAR ORDEN DE PRODUCCIÓN (notas)
// ============================================================================

export async function updateProductionOrderAction(
    orderId: string,
    data: { notes?: string }
): Promise<{ success: boolean; message: string }> {
    try {
        const session = await getSession();
        if (!session?.id) {
            return { success: false, message: 'No autorizado' };
        }

        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).productionOrder.updateMany({
            where: { id: orderId },
            data: {
                notes: data.notes,
            }
        });
        if (res.count === 0) return { success: false, message: 'Orden no encontrada' };

        revalidatePath('/dashboard/produccion');

        return { success: true, message: 'Orden actualizada correctamente' };
    } catch (error) {
        console.error('Error updating production order:', error);
        return { success: false, message: 'Error al actualizar la orden' };
    }
}

// ============================================================================
// ACTION: ELIMINAR / CANCELAR ORDEN DE PRODUCCIÓN
// ============================================================================

export async function deleteProductionOrderAction(
    orderId: string
): Promise<{ success: boolean; message: string }> {
    try {
        const session = await getSession();
        if (!session?.id) {
            return { success: false, message: 'No autorizado' };
        }

        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).productionOrder.updateMany({
            where: { id: orderId },
            data: {
                status: 'CANCELLED',
                notes: 'Cancelado por el usuario',
            }
        });
        if (res.count === 0) return { success: false, message: 'Orden no encontrada' };

        revalidatePath('/dashboard/produccion');

        return { success: true, message: 'Orden cancelada correctamente' };
    } catch (error) {
        console.error('Error deleting production order:', error);
        return { success: false, message: 'Error al cancelar la orden' };
    }
}
