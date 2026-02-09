'use server';

/**
 * SHANKLISH CARACAS ERP - Production Actions
 * 
 * Server Actions para gestión de producción desde el frontend
 * CONECTADO A BASE DE DATOS REAL CON PRISMA
 */

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';

// ============================================================================
// TIPOS
// ============================================================================

export interface QuickProductionFormData {
    recipeId: string;
    recipeName: string;
    actualQuantity: number;
    unit: string;
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
            }
        });

        if (!recipe) {
            return { success: false, message: 'Receta no encontrada' };
        }

        // 2. Calcular factor de escala
        const scaleFactor = formData.actualQuantity / recipe.outputQuantity;

        // 3. Verificar stock disponible de cada ingrediente en el área
        const stockErrors: string[] = [];
        const ingredientsToConsume: {
            itemId: string;
            name: string;
            grossQty: number;
            unit: string
        }[] = [];

        for (const ing of recipe.ingredients) {
            const requiredQty = ing.quantity * scaleFactor;
            const grossQty = ing.wastePercentage < 100
                ? requiredQty / (1 - ing.wastePercentage / 100)
                : requiredQty;

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
                });
            }
        }

        // Si hay errores de stock, no procesar
        if (stockErrors.length > 0) {
            return {
                success: false,
                message: `Stock insuficiente:\n${stockErrors.join('\n')}`,
            };
        }

        // 4. Ejecutar la producción en transacción
        const result = await prisma.$transaction(async (tx) => {
            // Generar número de orden
            const count = await tx.productionOrder.count();
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const orderNumber = `PROD-${today}-${String(count + 1).padStart(4, '0')}`;

            // Crear la orden de producción
            const productionOrder = await tx.productionOrder.create({
                data: {
                    orderNumber,
                    recipeId: formData.recipeId,
                    outputItemId: recipe.outputItemId,
                    plannedQuantity: formData.actualQuantity,
                    actualQuantity: formData.actualQuantity,
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

        // Calcular rendimiento real
        const expectedQty = recipe.outputQuantity * scaleFactor * (recipe.yieldPercentage / 100);
        const actualYield = (formData.actualQuantity / expectedQty) * 100;

        console.log('🏭 PRODUCCIÓN COMPLETADA:', {
            orden: result.orderNumber,
            receta: recipe.name,
            producido: `${formData.actualQuantity} ${formData.unit}`,
            rendimiento: `${actualYield.toFixed(1)}%`,
            ingredientes: ingredientsToConsume.length,
        });

        // Revalidar páginas
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
                    unit: formData.unit,
                },
                ingredientsConsumed: ingredientsToConsume.map(ing => ({
                    name: ing.name,
                    quantity: ing.grossQty,
                    unit: ing.unit
                })),
                actualYield: parseFloat(actualYield.toFixed(1)),
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
                }
            }
        });

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
    }
}

// ============================================================================
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

export async function getProductionAreasAction() {
    try {
        const areas = await prisma.area.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        return areas;
    } catch (error) {
        console.error('Error en getProductionAreasAction:', error);
        return [];
    }
}
