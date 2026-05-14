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
                            select: { id: true, name: true }
                        }
                    }
                },
                menuItems: {
                    include: {
                        menuItem: { select: { id: true, name: true } }
                    }
                }
            }
        });
        return { success: true, data: groups };
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
