'use server';

import prisma from '@/server/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';

// ============================================================================
// TIPOS
// ============================================================================

export interface MenuItemData {
    name: string;
    description?: string;
    price: number;
    categoryId: string;
    sku?: string;
    isActive?: boolean;
}

export interface ActionResult {
    success: boolean;
    message: string;
    data?: any;
}

// ============================================================================
// LECTURA
// ============================================================================

export async function getFullMenuAction() {
    try {
        const categories = await prisma.menuCategory.findMany({
            include: {
                items: {
                    orderBy: { name: 'asc' }
                }
            },
            orderBy: { sortOrder: 'asc' }
        });
        return { success: true, data: categories };
    } catch (error) {
        console.error('Error fetching menu:', error);
        return { success: false, message: 'Error al cargar el menú' };
    }
}

export async function getCategoriesAction() {
    try {
        const categories = await prisma.menuCategory.findMany({
            orderBy: { sortOrder: 'asc' }
        });
        return { success: true, data: categories };
    } catch (error) {
        return { success: false, message: 'Error al cargar categorías' };
    }
}

// ============================================================================
// ESCRITURA
// ============================================================================

export async function createMenuItemAction(data: MenuItemData): Promise<ActionResult> {
    try {
        const session = await getSession();
        // if (!session || session.role !== 'OWNER' ...) // Validación de permisos idealmente

        // Generar SKU automático si no viene
        let sku = data.sku;
        if (!sku) {
            const prefix = data.name.substring(0, 3).toUpperCase();
            const count = await prisma.menuItem.count();
            sku = `${prefix}-${String(count + 1).padStart(3, '0')}`;
        }

        const newItem = await prisma.menuItem.create({
            data: {
                name: data.name,
                description: data.description,
                price: parseFloat(data.price.toString()),
                categoryId: data.categoryId,
                sku: sku,
                isActive: data.isActive ?? true,
            }
        });

        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/delivery');

        return { success: true, message: 'Producto creado exitosamente', data: newItem };
    } catch (error) {
        console.error('Error creating item:', error);
        return { success: false, message: 'Error al crear el producto' };
    }
}

export async function updateMenuItemPriceAction(id: string, newPrice: number): Promise<ActionResult> {
    try {
        await prisma.menuItem.update({
            where: { id },
            data: { price: parseFloat(newPrice.toString()) }
        });

        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/delivery');

        return { success: true, message: 'Precio actualizado' };
    } catch (error) {
        return { success: false, message: 'Error al actualizar precio' };
    }
}

export async function toggleMenuItemStatusAction(id: string, isActive: boolean): Promise<ActionResult> {
    try {
        await prisma.menuItem.update({
            where: { id },
            data: { isActive }
        });

        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/pos/restaurante');

        return { success: true, message: isActive ? 'Producto activado' : 'Producto desactivado' };
    } catch (error) {
        return { success: false, message: 'Error al cambiar estado' };
    }
}

// ============================================================================
// UTILIDAD: SEED CATEGORÍAS (Si está vacío)
// ============================================================================

export async function ensureBasicCategoriesAction() {
    const count = await prisma.menuCategory.count();
    if (count === 0) {
        const basicCats = [
            { name: 'Shawarmas', sortOrder: 1, icon: '🥙' },
            { name: 'Platos Mixtos', sortOrder: 2, icon: '🍛' },
            { name: 'Raciones', sortOrder: 3, icon: '🥟' },
            { name: 'Ensaladas', sortOrder: 4, icon: '🥗' },
            { name: 'Bebidas', sortOrder: 5, icon: '🥤' }
        ];

        for (const cat of basicCats) {
            await prisma.menuCategory.create({ data: cat });
        }
        return { success: true, message: 'Categorías base creadas' };
    }
    return { success: true, message: 'Categorías ya existen' };
}
