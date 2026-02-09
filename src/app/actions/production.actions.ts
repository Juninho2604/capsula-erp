'use server';

/**
 * SHANKLISH CARACAS ERP - Production Actions
 * 
<<<<<<< HEAD
 * Server Actions para gestión de producción desde el frontend
 * CONECTADO A BASE DE DATOS REAL CON PRISMA
 */

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
=======
 * Server Actions para gestión de producción conectadas a Prisma
 */

import { revalidatePath } from 'next/cache';
import { prisma } from '@/server/db';
>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c
import { getSession } from '@/lib/auth';

// ============================================================================
// TIPOS
// ============================================================================

export interface QuickProductionFormData {
    recipeId: string;
    actualQuantity: number;
    areaId: string; // Área donde se produce (ej: Centro de Producción)
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
<<<<<<< HEAD
// ACTION: PRODUCCIÓN RÁPIDA (CONECTADO A DB)
// ============================================================================

/**
 * Registra una producción rápida (sin orden previa)
 * - Víctor termina 20kg de Cuajada → Botón "Finalizar Producción"
 * - Sistema resta ingredientes proporcionales del área especificada
 * - Sistema suma producto terminado al área especificada
 */
export async function quickProductionAction(
    formData: QuickProductionFormData
): Promise<ProductionActionResult> {
    const session = await getSession();
    if (!session?.id) {
        return { success: false, message: 'No autorizado' };
    }
    const userId = session.id;

    try {
        // 1. Obtener la receta con sus ingredientes
        const recipe = await prisma.recipe.findUnique({
            where: { id: formData.recipeId },
            include: {
                ingredients: {
                    include: {
                        ingredientItem: true
                    }
                },
                outputItem: true
=======
// ACTION: OBTENER RECETAS DISPONIBLES PARA PRODUCCIÓN
// ============================================================================

export async function getProductionRecipesAction() {
    try {
        const recipes = await prisma.recipe.findMany({
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
        const recipe = await prisma.recipe.findUnique({
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

        // 1. Obtener receta con ingredientes
        const recipe = await prisma.recipe.findUnique({
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
>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c
            }
        });

        if (!recipe) {
            return { success: false, message: 'Receta no encontrada' };
        }

<<<<<<< HEAD
        // 2. Calcular factor de escala
        const scaleFactor = formData.actualQuantity / recipe.outputQuantity;

        // 3. Verificar stock disponible de cada ingrediente en el área
=======
        const scaleFactor = formData.actualQuantity / Number(recipe.outputQuantity);

        // 2. Verificar stock disponible
        const ingredientsToConsume: { itemId: string; name: string; quantity: number; unit: string; stockLevelId: string }[] = [];
>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c
        const stockErrors: string[] = [];
        const ingredientsToConsume: {
            itemId: string;
            name: string;
            grossQty: number;
            unit: string
        }[] = [];

        for (const ing of recipe.ingredients) {
            const required = Number(ing.quantity) * scaleFactor;
            const wastePercent = Number(ing.wastePercentage) || 0;
            const grossQty = wastePercent < 100
                ? required / (1 - wastePercent / 100)
                : required;

<<<<<<< HEAD
            // Buscar stock en el área especificada
            const location = await prisma.inventoryLocation.findUnique({
                where: {
                    inventoryItemId_areaId: {
                        inventoryItemId: ing.ingredientItemId,
                        areaId: formData.areaId
                    }
                }
            });

            const currentStock = location?.currentStock || 0;

            if (currentStock < grossQty) {
                stockErrors.push(
                    `${ing.ingredientItem.name}: necesario ${grossQty.toFixed(3)}, disponible ${currentStock.toFixed(3)}`
                );
            } else {
                ingredientsToConsume.push({
                    itemId: ing.ingredientItemId,
                    name: ing.ingredientItem.name,
                    grossQty: parseFloat(grossQty.toFixed(4)),
                    unit: ing.unit
=======
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
>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c
                });
            }
        }

        if (stockErrors.length > 0) {
            return {
                success: false,
                message: `Stock insuficiente:\n${stockErrors.join('\n')}`,
            };
        }

<<<<<<< HEAD
        // 4. Ejecutar la producción en transacción
        const result = await prisma.$transaction(async (tx) => {
            // Generar número de orden
            const count = await tx.productionOrder.count();
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const orderNumber = `PROD-${today}-${String(count + 1).padStart(4, '0')}`;

            // Crear la orden de producción
=======
        // 3. Generar número de orden
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const count = await prisma.productionOrder.count({
            where: {
                createdAt: {
                    gte: new Date(today.setHours(0, 0, 0, 0))
                }
            }
        });
        const orderNumber = `PROD-${dateStr}-${String(count + 1).padStart(4, '0')}`;

        // 4. Ejecutar transacción
        const result = await prisma.$transaction(async (tx) => {
            // 4a. Crear orden de producción
>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c
            const productionOrder = await tx.productionOrder.create({
                data: {
                    orderNumber,
                    recipeId: formData.recipeId,
                    outputItemId: recipe.outputItemId,
                    plannedQuantity: formData.actualQuantity,
                    actualQuantity: formData.actualQuantity,
<<<<<<< HEAD
                    unit: formData.unit,
                    status: 'COMPLETED',
                    startedAt: new Date(),
                    completedAt: new Date(),
                    notes: formData.notes,
                    createdById: userId,
                    actualYieldPercentage: recipe.yieldPercentage
                }
            });

            // Restar ingredientes del inventario
            for (const ing of ingredientsToConsume) {
                // Crear movimiento de salida
                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: ing.itemId,
                        movementType: 'PRODUCTION_OUT',
                        quantity: ing.grossQty,
                        unit: ing.unit,
                        createdById: userId,
                        reason: `Producción: ${recipe.name}`,
                        notes: `Orden: ${orderNumber}`
                    }
                });

                // Actualizar stock en ubicación
                await tx.inventoryLocation.update({
                    where: {
                        inventoryItemId_areaId: {
                            inventoryItemId: ing.itemId,
                            areaId: formData.areaId
                        }
                    },
                    data: {
                        currentStock: { decrement: ing.grossQty },
                        lastCountDate: new Date()
                    }
                });
            }

            // Sumar producto terminado al inventario
            await tx.inventoryMovement.create({
                data: {
                    inventoryItemId: recipe.outputItemId,
                    movementType: 'PRODUCTION_IN',
                    quantity: formData.actualQuantity,
                    unit: formData.unit,
                    createdById: userId,
                    reason: `Producción: ${recipe.name}`,
                    notes: `Orden: ${orderNumber}`
                }
            });

            // Actualizar o crear ubicación del producto terminado
            await tx.inventoryLocation.upsert({
                where: {
                    inventoryItemId_areaId: {
                        inventoryItemId: recipe.outputItemId,
                        areaId: formData.areaId
                    }
                },
                create: {
                    inventoryItemId: recipe.outputItemId,
                    areaId: formData.areaId,
                    currentStock: formData.actualQuantity,
                    lastCountDate: new Date()
                },
                update: {
                    currentStock: { increment: formData.actualQuantity },
                    lastCountDate: new Date()
                }
            });

            return { orderNumber, productionOrder };
        }, { timeout: 60000 });
=======
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
                // Actualizar stock
                await tx.inventoryLocation.update({
                    where: { id: ing.stockLevelId },
                    data: {
                        currentStock: { decrement: ing.quantity }
                    }
                });

                // Crear movimiento de salida (consumo)
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
>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c

            // 4c. Sumar producto terminado al área de producción
            // Buscar o crear el InventoryLocation para el producto
            let outputStock = await tx.inventoryLocation.findUnique({
                where: {
                    inventoryItemId_areaId: {
                        inventoryItemId: recipe.outputItemId,
                        areaId: formData.areaId
                    }
                }
            });

<<<<<<< HEAD
        console.log('🏭 PRODUCCIÓN COMPLETADA:', {
            orden: result.orderNumber,
            receta: recipe.name,
            producido: `${formData.actualQuantity} ${formData.unit}`,
            rendimiento: `${actualYield.toFixed(1)}%`,
            ingredientes: ingredientsToConsume.length,
=======
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

            // Crear movimiento de entrada (producción)
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
>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c
        });

        // 5. Revalidar páginas
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
<<<<<<< HEAD
                ingredientsConsumed: ingredientsToConsume.map(ing => ({
                    name: ing.name,
                    quantity: ing.grossQty,
                    unit: ing.unit
                })),
                actualYield: parseFloat(actualYield.toFixed(1)),
=======
                ingredientsConsumed: ingredientsToConsume.map(i => ({
                    name: i.name,
                    quantity: i.quantity,
                    unit: i.unit
                })),
                actualYield: Number(recipe.yieldPercentage),
>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c
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
<<<<<<< HEAD
// ACTION: CALCULAR INGREDIENTES NECESARIOS (CONECTADO A DB)
// ============================================================================

export async function calculateRequirementsAction(
    recipeId: string,
    quantity: number,
    areaId?: string // Opcional: si se especifica, busca stock en ese área
): Promise<{ success: boolean; requirements: IngredientRequirement[] }> {
    try {
        const recipe = await prisma.recipe.findUnique({
            where: { id: recipeId },
            include: {
                ingredients: {
                    include: {
                        ingredientItem: {
                            include: {
                                stockLevels: true
                            }
                        }
                    }
=======
// ACTION: OBTENER HISTORIAL DE PRODUCCIONES
// ============================================================================

export async function getProductionHistoryAction(filters?: {
    limit?: number;
    status?: string;
}) {
    try {
        const orders = await prisma.productionOrder.findMany({
            where: filters?.status ? { status: filters.status } : {},
            take: filters?.limit || 50,
            orderBy: { createdAt: 'desc' },
            include: {
                recipe: {
                    select: { name: true }
                },
                createdBy: {
                    select: { firstName: true, lastName: true }
>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c
                }
            }
        });

<<<<<<< HEAD
        if (!recipe) {
            return { success: false, requirements: [] };
        }

        const scaleFactor = quantity / recipe.outputQuantity;

        const requirements: IngredientRequirement[] = await Promise.all(
            recipe.ingredients.map(async (ing) => {
                const required = ing.quantity * scaleFactor;
                const gross = ing.wastePercentage < 100
                    ? required / (1 - ing.wastePercentage / 100)
                    : required;

                // Calcular stock disponible
                let available = 0;
                if (areaId) {
                    // Stock en área específica
                    const location = ing.ingredientItem.stockLevels.find(
                        sl => sl.areaId === areaId
                    );
                    available = location?.currentStock || 0;
                } else {
                    // Stock global (suma de todas las áreas)
                    available = ing.ingredientItem.stockLevels.reduce(
                        (sum, sl) => sum + sl.currentStock, 0
                    );
                }

                return {
                    itemId: ing.ingredientItemId,
                    itemName: ing.ingredientItem.name,
                    required: parseFloat(required.toFixed(4)),
                    gross: parseFloat(gross.toFixed(4)),
                    unit: ing.unit,
                    available: parseFloat(available.toFixed(3)),
                    sufficient: available >= gross,
                };
            })
        );

        return { success: true, requirements };
    } catch (error) {
        console.error('Error en calculateRequirementsAction:', error);
        return { success: false, requirements: [] };
=======
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
>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c
    }
}

// ============================================================================
<<<<<<< HEAD
// ACTION: OBTENER RECETAS DISPONIBLES PARA PRODUCCIÓN
// ============================================================================

export async function getProductionRecipesAction() {
    try {
        const recipes = await prisma.recipe.findMany({
            where: {
                isActive: true,
                isApproved: true
            },
            include: {
                outputItem: true,
                _count: {
                    select: { ingredients: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        return recipes.map(recipe => ({
            id: recipe.id,
            name: recipe.name,
            outputQuantity: recipe.outputQuantity,
            outputUnit: recipe.outputUnit,
            outputItemName: recipe.outputItem.name,
            ingredientCount: recipe._count.ingredients,
        }));
    } catch (error) {
        console.error('Error en getProductionRecipesAction:', error);
        return [];
    }
}

// ============================================================================
// ACTION: OBTENER HISTORIAL DE PRODUCCIÓN
// ============================================================================

export async function getProductionHistoryAction(limit: number = 20) {
    try {
        const orders = await prisma.productionOrder.findMany({
            where: { status: 'COMPLETED' },
            include: {
                recipe: true,
                createdBy: {
                    select: { firstName: true, lastName: true }
                }
            },
            orderBy: { completedAt: 'desc' },
            take: limit
        });

        return orders.map(order => ({
            id: order.id,
            orderNumber: order.orderNumber,
            recipeName: order.recipe.name,
            quantity: order.actualQuantity,
            unit: order.unit,
            completedAt: order.completedAt,
            createdBy: `${order.createdBy.firstName} ${order.createdBy.lastName}`,
            yieldPercentage: order.actualYieldPercentage
        }));
    } catch (error) {
        console.error('Error en getProductionHistoryAction:', error);
        return [];
    }
}

// ============================================================================
// ACTION: OBTENER ÁREAS PARA PRODUCCIÓN
// ============================================================================

=======
// ACTION: OBTENER ÁREAS DISPONIBLES PARA PRODUCCIÓN
// ============================================================================

>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c
export async function getProductionAreasAction() {
    try {
        const areas = await prisma.area.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        return areas;
    } catch (error) {
<<<<<<< HEAD
        console.error('Error en getProductionAreasAction:', error);
=======
        console.error('Error fetching areas:', error);
>>>>>>> 1cf4d73748cdbebc15fd96dbb5cc3ee900ab789c
        return [];
    }
}
