'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import prisma from '@/server/db';
import { calculateRecipeCost } from '@/server/services/cost.service';
import { UnitOfMeasure } from '@/types'; // Assuming this exists, otherwise we use string

/**
 * SHANKLISH CARACAS ERP - Recipe Actions
 * 
 * Server Actions para gestión de recetas y costos
 */

export interface ActionResult {
    success: boolean;
    message: string;
    data?: any;
}

// Zod schemas — validación de boundary input. La forma exportada como tipo
// (CreateRecipeInput) se mantiene compatible con consumidores existentes.
const RecipeIngredientInputSchema = z.object({
    itemId: z.string().min(1, 'ingrediente sin id'),
    quantity: z.number().positive('cantidad debe ser > 0'),
    unit: z.string().min(1, 'unidad requerida'),
    wastePercentage: z.number().min(0).max(100, 'merma fuera de rango (0-100)'),
    notes: z.string().optional(),
});

const CreateRecipeInputSchema = z.object({
    name: z.string().trim().min(2, 'nombre demasiado corto').max(120, 'nombre demasiado largo'),
    description: z.string().max(500).optional(),
    outputQuantity: z.number().positive('outputQuantity debe ser > 0'),
    outputUnit: z.string().min(1, 'outputUnit requerida'),
    yieldPercentage: z.number().min(1, 'rendimiento mínimo 1%').max(200, 'rendimiento máximo 200%'),
    prepTime: z.number().int().min(0).optional(),
    cookTime: z.number().int().min(0).optional(),
    ingredients: z.array(RecipeIngredientInputSchema).min(1, 'al menos un ingrediente'),
    userId: z.string().min(1, 'userId requerido'),
    type: z.enum(['SUB_RECIPE', 'FINISHED_GOOD']).optional(),
    category: z.string().max(80).optional(),
});

export type CreateRecipeInput = z.infer<typeof CreateRecipeInputSchema>;

const UpdateRecipeInputSchema = CreateRecipeInputSchema.extend({
    id: z.string().min(1, 'id requerido'),
});

// ============================================================================
// READ ACTIONS
// ============================================================================

export async function getRecipesAction() {
    try {
        const recipes = await prisma.recipe.findMany({
            where: { isActive: true },
            include: {
                outputItem: {
                    include: {
                        costHistory: {
                            orderBy: { effectiveFrom: 'desc' },
                            take: 1
                        }
                    }
                },
                // createdBy: {
                //    select: { firstName: true, lastName: true }
                // }
            },
            orderBy: { name: 'asc' }
        });

        return recipes.map(recipe => {
            const currentCost = Number(recipe.outputItem.costHistory[0]?.costPerUnit || 0);
            const outputQuantity = Number(recipe.outputQuantity);
            // costPerServing: costo derivado por unidad de salida real (porción / pieza / kg)
            // Si outputQuantity es 0 o falta, cae a costPerUnit como fallback razonable.
            const costPerServing = outputQuantity > 0 ? currentCost / outputQuantity : currentCost;

            return {
                id: recipe.id,
                name: recipe.name,
                description: recipe.description,
                type: recipe.outputItem.type, // RAW_MATERIAL, SUB_RECIPE, FINISHED_GOOD
                category: recipe.outputItem.category || 'GENERAL',
                baseUnit: recipe.outputItem.baseUnit,
                outputQuantity,
                outputUnit: recipe.outputUnit,
                yieldPercentage: Number(recipe.yieldPercentage),
                costPerUnit: currentCost,
                costPerServing,
                isApproved: recipe.isApproved,
                createdBy: 'Sistema',
                updatedAt: recipe.updatedAt,
            };
        });

    } catch (error) {
        console.error('Error fetching recipes:', error);
        return [];
    }
}

export async function getRecipeByIdAction(id: string) {
    try {
        const recipe = await prisma.recipe.findUnique({
            where: { id },
            include: {
                outputItem: {
                    include: {
                        costHistory: {
                            orderBy: { effectiveFrom: 'desc' },
                            take: 1
                        }
                    }
                },
                ingredients: {
                    include: {
                        ingredientItem: {
                            include: {
                                costHistory: {
                                    orderBy: { effectiveFrom: 'desc' },
                                    take: 1
                                }
                            }
                        }
                    },
                    orderBy: { sortOrder: 'asc' }
                },
                // createdBy: {
                //    select: { firstName: true, lastName: true }
                // }
            }
        });

        if (!recipe) return null;

        const currentCost = recipe.outputItem.costHistory[0]?.costPerUnit || 0;

        return {
            ...recipe,
            outputItem: {
                ...recipe.outputItem,
                currentCost: Number(currentCost) // Helper property
            },
            ingredients: recipe.ingredients.map(ing => ({
                ...ing,
                quantity: Number(ing.quantity),
                wastePercentage: Number(ing.wastePercentage),
                currentCost: Number(ing.ingredientItem.costHistory[0]?.costPerUnit || 0)
            }))
        };

    } catch (error) {
        console.error('Error fetching recipe:', error);
        return null;
    }
}

/**
 * Gets a light list of ingredients (Raw Materials and Sub-recipes) for the selector
 */
export async function getIngredientOptionsAction() {
    try {
        const items = await prisma.inventoryItem.findMany({
            where: {
                isActive: true,
                type: { in: ['RAW_MATERIAL', 'SUB_RECIPE'] }
            },
            select: {
                id: true,
                name: true,
                type: true,
                baseUnit: true,
                costHistory: {
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1,
                    select: { costPerUnit: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        return items.map(item => ({
            id: item.id,
            name: item.name,
            type: item.type,
            baseUnit: item.baseUnit,
            currentCost: item.costHistory[0]?.costPerUnit || 0
        }));
    } catch (error) {
        console.error("Error getting ingredient options:", error);
        return [];
    }
}

// ============================================================================
// WRITE ACTIONS
// ============================================================================

/**
 * Creates a new recipe and its corresponding Output InventoryItem (if needed)
 */
export async function createRecipeAction(rawInput: CreateRecipeInput): Promise<ActionResult> {
    // Validación Zod en boundary
    const parsed = CreateRecipeInputSchema.safeParse(rawInput);
    if (!parsed.success) {
        const first = parsed.error.errors[0];
        return { success: false, message: first ? `${first.path.join('.')}: ${first.message}` : 'Input inválido' };
    }
    const input = parsed.data;

    try {

        // Generate SKU roughly
        const sku = `REC-${input.name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create the Output Inventory Item (The thing this recipe makes)
            const outputItem = await tx.inventoryItem.create({
                data: {
                    name: input.name,
                    sku: sku,
                    category: input.category,
                    type: input.type || 'SUB_RECIPE', // Default to sub-recipe if not specified
                    baseUnit: input.outputUnit,
                    description: input.description,
                    isActive: true
                }
            });

            // 2. Create the Recipe
            const recipe = await tx.recipe.create({
                data: {
                    name: input.name,
                    description: input.description,
                    outputItemId: outputItem.id,
                    outputQuantity: input.outputQuantity,
                    outputUnit: input.outputUnit,
                    yieldPercentage: input.yieldPercentage,
                    prepTime: input.prepTime,
                    cookTime: input.cookTime,
                    isApproved: true, // Auto-approve for now
                    // createdById: input.userId, // Temporarily disabled until client regen
                    ingredients: {
                        create: input.ingredients.map((ing, index) => ({
                            ingredientItemId: ing.itemId,
                            quantity: ing.quantity,
                            unit: ing.unit,
                            wastePercentage: ing.wastePercentage,
                            notes: ing.notes,
                            sortOrder: index
                        }))
                    }
                }
            });

            return { recipe, outputItem };
        });

        // 3. Calculate initial cost (outside transaction to avoid locking if complex)
        // We call the service we already fixed
        const costResult = await calculateRecipeCost(prisma, result.recipe.id);

        if (costResult) {
            await prisma.costHistory.create({
                data: {
                    inventoryItemId: result.outputItem.id,
                    costPerUnit: costResult.costPerUnit,
                    currency: 'USD',
                    isCalculated: true,
                    costBreakdown: JSON.stringify(costResult),
                    effectiveFrom: new Date(),
                    reason: 'Costo inicial de receta',
                    createdById: input.userId
                }
            });
        }

        revalidatePath('/dashboard/recetas');
        return { success: true, message: 'Receta creada exitosamente', data: { recipeId: result.recipe.id } };

    } catch (error) {
        console.error('Error creating recipe:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error al crear la receta'
        };
    }
}

export type UpdateRecipeInput = z.infer<typeof UpdateRecipeInputSchema>;

export async function updateRecipeAction(rawInput: UpdateRecipeInput): Promise<ActionResult> {
    // Validación Zod en boundary
    const parsed = UpdateRecipeInputSchema.safeParse(rawInput);
    if (!parsed.success) {
        const first = parsed.error.errors[0];
        return { success: false, message: first ? `${first.path.join('.')}: ${first.message}` : 'Input inválido' };
    }
    const input = parsed.data;

    try {

        const result = await prisma.$transaction(async (tx) => {
            // 1. Get existing recipe to know output item
            const existing = await tx.recipe.findUnique({
                where: { id: input.id },
                include: { outputItem: true }
            });
            if (!existing) throw new Error("Receta no encontrada");

            // 2. Update Output Item if name, category, or type changed
            const newType = input.type || existing.outputItem.type;
            if (existing.name !== input.name || existing.outputItem.category !== input.category || existing.outputItem.type !== newType) {
                await tx.inventoryItem.update({
                    where: { id: existing.outputItemId },
                    data: {
                        name: input.name,
                        category: input.category,
                        type: newType,
                    }
                });
            }

            // 3. Update Recipe Basic Info
            const updatedRecipe = await tx.recipe.update({
                where: { id: input.id },
                data: {
                    name: input.name,
                    description: input.description,
                    outputQuantity: input.outputQuantity,
                    outputUnit: input.outputUnit,
                    yieldPercentage: input.yieldPercentage,
                    prepTime: input.prepTime,
                    cookTime: input.cookTime,
                }
            });

            // 4. Replace Ingredients
            // Delete old
            await tx.recipeIngredient.deleteMany({
                where: { recipeId: input.id }
            });

            // Create new (createMany is faster)
            await tx.recipeIngredient.createMany({
                data: input.ingredients.map((ing, index) => ({
                    recipeId: input.id,
                    ingredientItemId: ing.itemId,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    wastePercentage: ing.wastePercentage,
                    notes: ing.notes,
                    sortOrder: index
                }))
            });

            return updatedRecipe;
        });

        // 5. Recalculate Cost
        // We trigger it but don't fail the update if cost calc fails
        try {
            await updateRecipeCostAction(input.id, input.userId);
        } catch (e) {
            console.warn("Cost update failed after recipe update", e);
        }

        revalidatePath('/dashboard/recetas');
        // Revalidate the detail page specifically
        revalidatePath(`/dashboard/recetas/${input.id}`);

        return { success: true, message: 'Receta actualizada exitosamente' };

    } catch (error) {
        console.error('Error updating recipe:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error al actualizar receta'
        };
    }
}

/**
 * Recalcula el costo de una receta y actualiza el historial
 */
export async function updateRecipeCostAction(
    recipeId: string,
    userId: string
): Promise<ActionResult> {
    try {
        console.log(`Calculando costo para receta ${recipeId}...`);

        // 1. Calcular usando el servicio
        const result = await calculateRecipeCost(prisma, recipeId);

        if (!result) {
            return {
                success: false,
                message: 'No se pudo calcular el costo. Verifique que la receta existe y es válida.'
            };
        }

        console.log(`Costo calculado: ${result.costPerUnit} (Total: ${result.totalCost})`);

        // 2. Obtener el outputItem ID de la receta
        const recipe = await prisma.recipe.findUnique({
            where: { id: recipeId },
            select: { outputItemId: true }
        });

        if (!recipe) throw new Error('Receta no encontrada');

        // 3. Guardar el nuevo costo en historial
        await prisma.costHistory.create({
            data: {
                inventoryItemId: recipe.outputItemId,
                costPerUnit: result.costPerUnit,
                currency: 'USD', // Por simplicidad asumimos USD
                isCalculated: true,
                costBreakdown: JSON.stringify(result),
                effectiveFrom: new Date(),
                reason: 'Cálculo automático de receta',
                createdById: userId
            }
        });

        // 4. Revalidar UI
        revalidatePath('/dashboard/recetas');
        revalidatePath(`/dashboard/recetas/${recipeId}`);
        revalidatePath('/dashboard/inventario'); // Si los precios del inventario se muestran

        return {
            success: true,
            message: `Costo actualizado: $${result.costPerUnit.toFixed(4)}`,
            data: result
        };

    } catch (error) {
        console.error('Error updating recipe cost:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error interno al actualizar costo'
        };
    }
}

// ============================================================================
// AUDIT (read-only, no DB writes)
// ============================================================================

/**
 * Resumen de orfandades en la relación MenuItem ↔ Recipe.
 * Solo lectura — replica la lógica del script scripts/audit-orphan-recipes.ts
 * pero como Server Action para que el dashboard pueda consumirla.
 *
 *   - menuItemsToGhostRecipe: MenuItem activo cuyo recipeId apunta a una
 *     receta que ya no existe. Causa silenciosa de descargos fallidos.
 *   - menuItemsToInactiveRecipe: MenuItem activo apuntando a Recipe con
 *     isActive = false (archivada). Igual rompe el descargo.
 *   - recipesUnused: Recetas activas sin ningún MenuItem que las
 *     referencie. No es bloqueante pero indica posible mantenimiento ocioso.
 */
export async function getOrphanRecipesSummaryAction(opts?: { recentLimit?: number }) {
    const limit = opts?.recentLimit ?? 5;

    try {
        // 1) MenuItems activos con recipeId no nulo
        const menuItemsWithRecipe = await prisma.menuItem.findMany({
            where: { isActive: true, recipeId: { not: null } },
            select: { id: true, name: true, sku: true, recipeId: true },
        });

        const referencedRecipeIds = Array.from(
            new Set(menuItemsWithRecipe.map(m => m.recipeId!).filter(Boolean)),
        );

        // 2) Recetas que efectivamente existen entre las referenciadas
        const existingRecipes = await prisma.recipe.findMany({
            where: { id: { in: referencedRecipeIds } },
            select: { id: true, isActive: true, name: true },
        });
        const recipeMap = new Map(existingRecipes.map(r => [r.id, r] as const));

        // 3) Particionar
        const ghosts = menuItemsWithRecipe.filter(m => !recipeMap.has(m.recipeId!));
        const inactive = menuItemsWithRecipe.filter(m => {
            const r = recipeMap.get(m.recipeId!);
            return r && !r.isActive;
        });

        // 4) Recetas activas no referenciadas (huérfanas inversas)
        const referencedSet = new Set(referencedRecipeIds);
        const allActiveRecipes = await prisma.recipe.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        });
        const recipesUnused = allActiveRecipes.filter(r => !referencedSet.has(r.id));

        return {
            menuItemsToGhostRecipe: ghosts.length,
            menuItemsToInactiveRecipe: inactive.length,
            recipesUnused: recipesUnused.length,
            recentGhosts: ghosts.slice(0, limit).map(m => ({ id: m.id, name: m.name, sku: m.sku })),
            recentInactive: inactive.slice(0, limit).map(m => ({
                id: m.id, name: m.name, sku: m.sku,
                recipeName: recipeMap.get(m.recipeId!)?.name ?? null,
            })),
        };
    } catch (error) {
        console.error('Error fetching orphan recipes summary:', error);
        return {
            menuItemsToGhostRecipe: 0,
            menuItemsToInactiveRecipe: 0,
            recipesUnused: 0,
            recentGhosts: [] as Array<{ id: string; name: string; sku: string }>,
            recentInactive: [] as Array<{ id: string; name: string; sku: string; recipeName: string | null }>,
        };
    }
}

/**
 * Recetas activas cuyo CostHistory snapshot está desactualizado respecto al
 * costo actual de los ingredientes. Heurística:
 *
 *   "Costo de receta desactualizado" =
 *      MAX(effectiveFrom de CostHistory de cualquier ingrediente)
 *      > effectiveFrom del CostHistory más reciente de la receta (output)
 *
 * Es decir: algún ingrediente tiene un costo más reciente que el snapshot
 * que se persistió para la receta. El operativo debería re-correr
 * "Recalcular costos" en esas recetas para que el margen y el descargo
 * usen valores correctos.
 *
 * Solo lectura — no recalcula nada, no escribe a BD.
 */
export async function getRecipesWithOutdatedCostAction(opts?: { limit?: number }) {
    const limit = opts?.limit ?? 25;

    try {
        // Cargamos recetas activas con su costHistory más reciente (snapshot)
        // y los costHistory más recientes de cada ingrediente. Una sola query
        // de Prisma; in-memory comparison para evitar SQL crudo.
        const recipes = await prisma.recipe.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                outputItem: {
                    select: {
                        id: true,
                        sku: true,
                        costHistory: {
                            orderBy: { effectiveFrom: 'desc' },
                            take: 1,
                            select: { effectiveFrom: true, costPerUnit: true },
                        },
                    },
                },
                ingredients: {
                    select: {
                        ingredientItem: {
                            select: {
                                id: true,
                                name: true,
                                costHistory: {
                                    orderBy: { effectiveFrom: 'desc' },
                                    take: 1,
                                    select: { effectiveFrom: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        const drifted = recipes
            .map(r => {
                const recipeSnapshotAt = r.outputItem.costHistory[0]?.effectiveFrom ?? null;
                let latestIngredientAt: Date | null = null;
                let latestIngredientName = '';
                for (const ing of r.ingredients) {
                    const at = ing.ingredientItem.costHistory[0]?.effectiveFrom ?? null;
                    if (at && (!latestIngredientAt || at > latestIngredientAt)) {
                        latestIngredientAt = at;
                        latestIngredientName = ing.ingredientItem.name;
                    }
                }
                if (!latestIngredientAt) return null; // sin costos de ingredientes — nada que comparar
                if (!recipeSnapshotAt) {
                    // La receta nunca tuvo cost snapshot → reportable como "sin costo".
                    return {
                        id: r.id,
                        name: r.name,
                        outputSku: r.outputItem.sku,
                        recipeSnapshotAt: null,
                        latestIngredientAt,
                        latestIngredientName,
                        driftDays: null,
                        kind: 'NO_SNAPSHOT' as const,
                    };
                }
                const driftMs = latestIngredientAt.getTime() - recipeSnapshotAt.getTime();
                if (driftMs <= 0) return null; // snapshot al día
                return {
                    id: r.id,
                    name: r.name,
                    outputSku: r.outputItem.sku,
                    recipeSnapshotAt,
                    latestIngredientAt,
                    latestIngredientName,
                    driftDays: Math.round(driftMs / 86400_000),
                    kind: 'OUTDATED' as const,
                };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
            .sort((a, b) => (b.driftDays ?? Number.MAX_SAFE_INTEGER) - (a.driftDays ?? Number.MAX_SAFE_INTEGER));

        return {
            count: drifted.length,
            outdated: drifted.filter(d => d.kind === 'OUTDATED').length,
            withoutSnapshot: drifted.filter(d => d.kind === 'NO_SNAPSHOT').length,
            top: drifted.slice(0, limit),
        };
    } catch (error) {
        console.error('Error fetching outdated recipe costs:', error);
        return {
            count: 0,
            outdated: 0,
            withoutSnapshot: 0,
            top: [] as Array<{
                id: string; name: string; outputSku: string;
                recipeSnapshotAt: Date | null; latestIngredientAt: Date;
                latestIngredientName: string; driftDays: number | null;
                kind: 'NO_SNAPSHOT' | 'OUTDATED';
            }>,
        };
    }
}

