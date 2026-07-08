'use server';

/**
 * Modificadores y grupos de modificadores — multitenant (Lote 3.b — Fase 3 Paso D.b).
 *
 * Modelos tenant-aware: MenuModifierGroup, MenuModifier, MenuItem.
 * Modelos NO tenant-aware (pivot): MenuItemModifierGroup. Su scope viene de
 * las FKs a MenuItem y MenuModifierGroup, así que antes de link/unlink
 * validamos que ambos pertenecen al tenant.
 *
 * Patrón:
 *   - findMany / create / aggregate → `db.X.Y` (extension filtra/inyecta tenantId)
 *   - update({ where: { id } }) → `db.X.updateMany({ where: { id } })` para
 *     que la extension inyecte tenantId (uniques globales).
 *   - upsert / delete sobre pivot → validar ownership de ambos FK ids primero.
 */

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

/**
 * Obtiene todos los grupos de modificadores con sus modificadores
 * y el MenuItem vinculado para descargo de inventario (si aplica)
 */
export async function getModifierGroupsWithItemsAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const groups = await db.menuModifierGroup.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
                modifiers: {
                    where: { deletedAt: null },
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        linkedMenuItem: {
                            select: { id: true, name: true, recipeId: true }
                        },
                        ingredients: {
                            select: {
                                id: true,
                                ingredientItemId: true,
                                quantity: true,
                                unit: true,
                                ingredientItem: { select: { name: true } },
                            },
                        },
                    }
                },
                menuItems: {
                    include: {
                        menuItem: { select: { id: true, name: true } }
                    }
                }
            }
        });

        // ── Auditoría de descargo por modificador ─────────────────────────
        // MenuItem.recipeId es escalar (sin relación) → batch-fetch de las
        // recetas vinculadas para reportar QUÉ descuenta cada modificador.
        const linkedRecipeIds = Array.from(new Set(
            groups.flatMap(g => g.modifiers)
                .map(m => m.linkedMenuItem?.recipeId)
                .filter((id): id is string => Boolean(id))
        ));
        const recipes = linkedRecipeIds.length > 0
            ? await db.recipe.findMany({
                where: { id: { in: linkedRecipeIds } },
                select: {
                    id: true,
                    name: true,
                    isActive: true,
                    deletedAt: true,
                    ingredients: {
                        select: {
                            quantity: true,
                            unit: true,
                            ingredientItem: { select: { name: true } },
                        },
                    },
                },
            })
            : [];
        const recipesById = new Map(recipes.map(r => [r.id, r]));

        type DeductionStatus = 'OK' | 'NO_LINK' | 'NO_RECIPE' | 'RECIPE_INACTIVE';
        const withDeduction = groups.map(g => ({
            ...g,
            modifiers: g.modifiers.map(m => {
                // Receta PROPIA del modificador (§80) tiene prioridad sobre el
                // MenuItem vinculado — mismo criterio que el descargo del POS.
                if (m.ingredients.length > 0) {
                    return {
                        ...m,
                        deduction: {
                            status: 'OK' as DeductionStatus,
                            source: 'OWN' as const,
                            recipeName: null,
                            ingredients: m.ingredients.map(ing => ({
                                name: ing.ingredientItem.name,
                                quantity: ing.quantity,
                                unit: ing.unit,
                            })),
                        },
                    };
                }
                const recipeId = m.linkedMenuItem?.recipeId ?? null;
                const recipe = recipeId ? recipesById.get(recipeId) : undefined;
                let status: DeductionStatus;
                if (!m.linkedMenuItemId) status = 'NO_LINK';
                else if (!recipe) status = 'NO_RECIPE';
                else if (!recipe.isActive || recipe.deletedAt) status = 'RECIPE_INACTIVE';
                else status = 'OK';
                return {
                    ...m,
                    deduction: {
                        status,
                        source: 'LINKED' as const,
                        recipeName: recipe?.name ?? null,
                        ingredients: status === 'OK'
                            ? recipe!.ingredients.map(ing => ({
                                name: ing.ingredientItem.name,
                                quantity: ing.quantity,
                                unit: ing.unit,
                            }))
                            : [],
                    },
                };
            }),
        }));

        return { success: true, data: withDeduction };
    } catch (error) {
        console.error('Error fetching modifier groups:', error);
        return { success: false, message: 'Error cargando grupos de modificadores' };
    }
}

/**
 * Vincula (o desvincula) un modificador a un MenuItem para descargo de inventario.
 * @param modifierId - ID del MenuModifier
 * @param menuItemId - ID del MenuItem a vincular, o null para desvincular
 */
export async function linkModifierToMenuItemAction(modifierId: string, menuItemId: string | null) {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        // Si se pasa menuItemId, validar que pertenece al tenant antes de
        // referenciarlo. Si es null, la unset es segura.
        if (menuItemId) {
            const owned = await db.menuItem.findFirst({ where: { id: menuItemId } });
            if (!owned) return { success: false, message: 'MenuItem no encontrado' };
        }
        const res = await db.menuModifier.updateMany({
            where: { id: modifierId },
            data: { linkedMenuItemId: menuItemId }
        });
        if (res.count === 0) return { success: false, message: 'Modificador no encontrado' };
        revalidatePath('/dashboard/menu/modificadores');
        return { success: true };
    } catch (error) {
        console.error('Error linking modifier to menu item:', error);
        return { success: false, message: 'Error al vincular modificador' };
    }
}

/**
 * Obtiene todos los MenuItems activos para el selector de vinculación
 */
export async function getMenuItemsForModifierLinkAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const items = await db.menuItem.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                recipeId: true,
                category: { select: { name: true } }
            },
            orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }]
        });
        return { success: true, data: items };
    } catch (error) {
        return { success: false, message: 'Error cargando items del menú' };
    }
}

/**
 * Actualiza disponibilidad de un modificador
 */
export async function toggleModifierAvailabilityAction(modifierId: string, isAvailable: boolean) {
    try {
        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).menuModifier.updateMany({
            where: { id: modifierId },
            data: { isAvailable }
        });
        if (res.count === 0) return { success: false, message: 'Modificador no encontrado' };
        revalidatePath('/dashboard/menu/modificadores');
        return { success: true };
    } catch (error) {
        return { success: false, message: 'Error actualizando modificador' };
    }
}

// ============================================================================
// RECETA PROPIA DEL MODIFICADOR (§80)
// ============================================================================

const MODIFIER_INGREDIENT_UNITS = ['KG', 'G', 'L', 'ML', 'UNIT', 'PORTION'] as const;

/**
 * Reemplaza (replace-all) la receta propia de un modificador: ingredientes
 * directos de inventario que el POS descuenta con PRIORIDAD sobre el
 * MenuItem vinculado. Lista vacía = quitar receta propia (vuelve al fallback).
 *
 * MenuModifierIngredient no tiene tenantId (hereda por FK, patrón
 * RecipeIngredient) → validamos ownership del modifier y de CADA insumo
 * antes de tocar el pivot con el cliente crudo.
 */
export async function setModifierIngredientsAction(
    modifierId: string,
    ingredients: Array<{ ingredientItemId: string; quantity: number; unit: string }>,
) {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const modifier = await db.menuModifier.findFirst({ where: { id: modifierId } });
        if (!modifier) return { success: false, message: 'Modificador no encontrado' };

        // Validación de payload
        const seen = new Set<string>();
        for (const ing of ingredients) {
            if (!ing.ingredientItemId) return { success: false, message: 'Insumo inválido' };
            if (seen.has(ing.ingredientItemId)) {
                return { success: false, message: 'Insumo repetido en la receta' };
            }
            seen.add(ing.ingredientItemId);
            if (!Number.isFinite(ing.quantity) || ing.quantity <= 0) {
                return { success: false, message: 'La cantidad debe ser mayor a 0' };
            }
            if (!MODIFIER_INGREDIENT_UNITS.includes(ing.unit as typeof MODIFIER_INGREDIENT_UNITS[number])) {
                return { success: false, message: `Unidad inválida: ${ing.unit}` };
            }
        }

        // Ownership de cada insumo (InventoryItem es tenant-aware)
        if (ingredients.length > 0) {
            const ids = ingredients.map(i => i.ingredientItemId);
            const owned = await db.inventoryItem.findMany({
                where: { id: { in: ids }, deletedAt: null },
                select: { id: true },
            });
            if (owned.length !== ids.length) {
                return { success: false, message: 'Uno o más insumos no existen' };
            }
        }

        await prisma.$transaction([
            prisma.menuModifierIngredient.deleteMany({ where: { modifierId } }),
            ...(ingredients.length > 0
                ? [prisma.menuModifierIngredient.createMany({
                    data: ingredients.map(ing => ({
                        modifierId,
                        ingredientItemId: ing.ingredientItemId,
                        quantity: ing.quantity,
                        unit: ing.unit,
                    })),
                })]
                : []),
        ]);

        revalidatePath('/dashboard/menu/modificadores');
        return { success: true };
    } catch (error) {
        console.error('Error setting modifier ingredients:', error);
        return { success: false, message: 'Error guardando receta del modificador' };
    }
}

/**
 * Insumos activos del tenant para el picker de receta propia del modificador.
 */
export async function getInventoryItemsForModifierRecipeAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const items = await withTenant(tenantId).inventoryItem.findMany({
            where: { isActive: true, deletedAt: null },
            select: { id: true, name: true, sku: true, baseUnit: true, type: true },
            orderBy: { name: 'asc' },
        });
        return { success: true, data: items };
    } catch (error) {
        return { success: false, message: 'Error cargando insumos' };
    }
}

// ============================================================================
// CRUD GRUPOS
// ============================================================================

export async function createModifierGroupAction(data: {
    name: string;
    description?: string;
    isRequired: boolean;
    minSelections: number;
    maxSelections: number;
}) {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const maxSort = await db.menuModifierGroup.aggregate({ _max: { sortOrder: true } });
        const group = await db.menuModifierGroup.create({
            data: {
                tenantId,
                name: data.name.trim(),
                description: data.description?.trim() || null,
                isRequired: data.isRequired,
                minSelections: data.minSelections,
                maxSelections: data.maxSelections,
                sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
            },
            include: {
                modifiers: { include: { linkedMenuItem: { select: { id: true, name: true } } } },
                menuItems: { include: { menuItem: { select: { id: true, name: true } } } }
            }
        });
        revalidatePath('/dashboard/menu/modificadores');
        return { success: true, data: group };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Error creando grupo' };
    }
}

export async function updateModifierGroupAction(id: string, data: {
    name?: string;
    description?: string | null;
    isRequired?: boolean;
    minSelections?: number;
    maxSelections?: number;
}) {
    try {
        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).menuModifierGroup.updateMany({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name.trim() }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
                ...(data.minSelections !== undefined && { minSelections: data.minSelections }),
                ...(data.maxSelections !== undefined && { maxSelections: data.maxSelections }),
            }
        });
        if (res.count === 0) return { success: false, message: 'Grupo no encontrado' };
        revalidatePath('/dashboard/menu/modificadores');
        return { success: true };
    } catch (error) {
        return { success: false, message: 'Error actualizando grupo' };
    }
}

export async function deleteModifierGroupAction(id: string) {
    try {
        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).menuModifierGroup.updateMany({
            where: { id },
            data: { isActive: false }
        });
        if (res.count === 0) return { success: false, message: 'Grupo no encontrado' };
        revalidatePath('/dashboard/menu/modificadores');
        return { success: true };
    } catch (error) {
        return { success: false, message: 'Error eliminando grupo' };
    }
}

// ============================================================================
// CRUD MODIFICADORES
// ============================================================================

export async function addModifierAction(data: {
    groupId: string;
    name: string;
    priceAdjustment: number;
    linkedMenuItemId?: string | null;
}) {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        // Validar ownership de groupId y linkedMenuItemId si se pasa
        const ownedGroup = await db.menuModifierGroup.findFirst({ where: { id: data.groupId } });
        if (!ownedGroup) return { success: false, message: 'Grupo no encontrado' };
        if (data.linkedMenuItemId) {
            const ownedItem = await db.menuItem.findFirst({ where: { id: data.linkedMenuItemId } });
            if (!ownedItem) return { success: false, message: 'MenuItem no encontrado' };
        }
        const maxSort = await db.menuModifier.aggregate({
            where: { groupId: data.groupId },
            _max: { sortOrder: true }
        });
        const modifier = await db.menuModifier.create({
            data: {
                tenantId,
                groupId: data.groupId,
                name: data.name.trim(),
                priceAdjustment: data.priceAdjustment,
                linkedMenuItemId: data.linkedMenuItemId || null,
                sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
            },
            include: { linkedMenuItem: { select: { id: true, name: true } } }
        });
        revalidatePath('/dashboard/menu/modificadores');
        return { success: true, data: modifier };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Error creando modificador' };
    }
}

export async function updateModifierNamePriceAction(id: string, name: string, priceAdjustment: number) {
    try {
        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).menuModifier.updateMany({
            where: { id },
            data: { name: name.trim(), priceAdjustment }
        });
        if (res.count === 0) return { success: false, message: 'Modificador no encontrado' };
        revalidatePath('/dashboard/menu/modificadores');
        return { success: true };
    } catch (error) {
        return { success: false, message: 'Error actualizando modificador' };
    }
}

export async function deleteModifierAction(id: string) {
    try {
        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).menuModifier.updateMany({
            where: { id },
            data: { isAvailable: false, deletedAt: new Date() }
        });
        if (res.count === 0) return { success: false, message: 'Modificador no encontrado' };
        revalidatePath('/dashboard/menu/modificadores');
        return { success: true };
    } catch (error) {
        return { success: false, message: 'Error eliminando modificador' };
    }
}

// ============================================================================
// VINCULAR GRUPO A MENU ITEM (para que aparezca en POS)
// ============================================================================

export async function linkGroupToMenuItemAction(modifierGroupId: string, menuItemId: string) {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        // Validar ownership de ambos FKs antes de crear pivot.
        const [item, group] = await Promise.all([
            db.menuItem.findFirst({ where: { id: menuItemId } }),
            db.menuModifierGroup.findFirst({ where: { id: modifierGroupId } }),
        ]);
        if (!item || !group) return { success: false, message: 'Item o grupo no encontrado' };

        await prisma.menuItemModifierGroup.upsert({
            where: { menuItemId_modifierGroupId: { menuItemId, modifierGroupId } },
            create: { menuItemId, modifierGroupId },
            update: {}
        });
        revalidatePath('/dashboard/menu/modificadores');
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Error vinculando grupo a plato' };
    }
}

export async function unlinkGroupFromMenuItemAction(modifierGroupId: string, menuItemId: string) {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        // Validar ownership antes de delete del pivot.
        const [item, group] = await Promise.all([
            db.menuItem.findFirst({ where: { id: menuItemId } }),
            db.menuModifierGroup.findFirst({ where: { id: modifierGroupId } }),
        ]);
        if (!item || !group) return { success: false, message: 'Item o grupo no encontrado' };

        await prisma.menuItemModifierGroup.delete({
            where: { menuItemId_modifierGroupId: { menuItemId, modifierGroupId } }
        });
        revalidatePath('/dashboard/menu/modificadores');
        return { success: true };
    } catch (error) {
        return { success: false, message: 'Error desvinculando grupo de plato' };
    }
}
